import { randomUUID } from "node:crypto";
import { api, APIError, Header } from "encore.dev/api";
import { prisma } from "./prisma";
import { requireEventPermission } from "../auth/rbac";

// Per-race results. Event admins assign points to participants on a specific
// RaceEvent; the event-level EventPointsEntry aggregate is then recomputed as
// the sum of that participant's RaceResult.points across every race in the
// event, keeping the existing points overview in sync.
export interface RaceResultView {
  id: string;
  raceEventId: string;
  userId: string;
  position: number | null;
  points: number;
  createdAt: string;
  updatedAt: string;
}

interface AssignRaceResultParams {
  eventId: string;
  raceId: string;
  userId: string;
  authorization: Header<"Authorization">;
  position?: number | null;
  points: number;
}

// Assigns (or updates) a participant's result on a race. Gated by event-update
// permission on the parent event (event admins, with site-admin override).
export const assignRaceResult = api(
  { expose: true, method: "PUT", path: "/events/:eventId/races/:raceId/results/:userId" },
  async (params: AssignRaceResultParams): Promise<RaceResultView> => {
    await requireEventPermission(prisma, {
      authorization: params.authorization,
      eventId: params.eventId,
      action: "update",
    });

    const race = await prisma.raceEvent.findUnique({ where: { id: params.raceId } });
    if (!race || race.eventId !== params.eventId) {
      throw APIError.notFound("race not found");
    }

    const user = await prisma.user.findUnique({ where: { id: params.userId } });
    if (!user) {
      throw APIError.notFound("user not found");
    }

    // A result must belong to an actual participant of the parent event.
    // Guarding here prevents dangling results (and cross-event leakage) for
    // users who were never registered for the event.
    const member = await prisma.eventMember.findUnique({
      where: { eventId_userId: { eventId: params.eventId, userId: params.userId } },
    });
    if (!member) {
      throw APIError.failedPrecondition("user is not a member of this event");
    }

    const result = await prisma.raceResult.upsert({
      where: { raceEventId_userId: { raceEventId: params.raceId, userId: params.userId } },
      create: {
        id: randomUUID(),
        raceEventId: params.raceId,
        userId: params.userId,
        position: params.position ?? null,
        points: params.points,
      },
      update: {
        position: params.position === undefined ? undefined : params.position,
        points: params.points,
      },
    });

    await recomputeEventPoints(params.eventId, params.userId);

    return toRaceResultView(result);
  },
);

interface ListRaceResultsParams {
  eventId: string;
  raceId: string;
}

// Lists the results recorded for a single race, ordered by finishing position.
export const listRaceResults = api(
  { expose: true, method: "GET", path: "/events/:eventId/races/:raceId/results" },
  async ({ eventId, raceId }: ListRaceResultsParams): Promise<{ results: RaceResultView[] }> => {
    const race = await prisma.raceEvent.findUnique({ where: { id: raceId } });
    if (!race || race.eventId !== eventId) {
      throw APIError.notFound("race not found");
    }

    const results = await prisma.raceResult.findMany({
      where: { raceEventId: raceId },
      orderBy: [{ position: "asc" }, { points: "desc" }],
    });
    return { results: results.map(toRaceResultView) };
  },
);

// Recomputes the event-level points aggregate for a participant as the sum of
// their per-race points across the event, upserting the EventPointsEntry row.
async function recomputeEventPoints(eventId: string, userId: string): Promise<void> {
  const aggregate = await prisma.raceResult.aggregate({
    where: { userId, raceEvent: { eventId } },
    _sum: { points: true },
  });
  const total = aggregate._sum.points ?? 0;

  await prisma.eventPointsEntry.upsert({
    where: { eventId_userId: { eventId, userId } },
    create: { id: randomUUID(), eventId, userId, points: total },
    update: { points: total },
  });
}

type RaceResultRow = {
  id: string;
  raceEventId: string;
  userId: string;
  position: number | null;
  points: number;
  createdAt: Date;
  updatedAt: Date;
};

function toRaceResultView(result: RaceResultRow): RaceResultView {
  return {
    id: result.id,
    raceEventId: result.raceEventId,
    userId: result.userId,
    position: result.position,
    points: result.points,
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
  };
}
