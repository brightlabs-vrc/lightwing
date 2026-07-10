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

// One participant's entry in a bulk standings payload.
export interface RaceResultInput {
  userId: string;
  position?: number | null;
  points: number;
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
  { expose: true, auth: true, method: "PUT", path: "/events/:eventId/races/:raceId/results/:userId" },
  async (params: AssignRaceResultParams): Promise<RaceResultView> => {
    await requireEventPermission(prisma, {
      authorization: params.authorization,
      eventId: params.eventId,
      action: "update",
    });

    await requireRace(params.eventId, params.raceId);
    await requireEventMembership(params.eventId, params.userId);

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

interface ReplaceRaceResultsParams {
  eventId: string;
  raceId: string;
  authorization: Header<"Authorization">;
  results: RaceResultInput[];
}

// Full-replace bulk standings: the payload becomes the complete set of results
// for the race. Each participant is upserted; any existing result for a user not
// present in the payload is deleted. Every affected participant's event-level
// aggregate (added, changed and removed) is recomputed. Gated by event-update
// permission on the parent event.
export const replaceRaceResults = api(
  { expose: true, auth: true, method: "PUT", path: "/events/:eventId/races/:raceId/results" },
  async (params: ReplaceRaceResultsParams): Promise<{ results: RaceResultView[] }> => {
    await requireEventPermission(prisma, {
      authorization: params.authorization,
      eventId: params.eventId,
      action: "update",
    });

    await requireRace(params.eventId, params.raceId);
    await validateResultInputs(params.eventId, params.results);

    const payloadUserIds = new Set(params.results.map((entry) => entry.userId));
    const existing = await prisma.raceResult.findMany({
      where: { raceEventId: params.raceId },
      select: { userId: true },
    });
    const removedUserIds = existing
      .map((row) => row.userId)
      .filter((userId) => !payloadUserIds.has(userId));

    for (const entry of params.results) {
      await prisma.raceResult.upsert({
        where: { raceEventId_userId: { raceEventId: params.raceId, userId: entry.userId } },
        create: {
          id: randomUUID(),
          raceEventId: params.raceId,
          userId: entry.userId,
          position: entry.position ?? null,
          points: entry.points,
        },
        update: {
          position: entry.position === undefined ? undefined : entry.position,
          points: entry.points,
        },
      });
    }

    if (removedUserIds.length > 0) {
      await prisma.raceResult.deleteMany({
        where: { raceEventId: params.raceId, userId: { in: removedUserIds } },
      });
    }

    for (const userId of new Set([...payloadUserIds, ...removedUserIds])) {
      await recomputeEventPoints(params.eventId, userId);
    }

    return listResults(params.raceId);
  },
);

interface MergeRaceResultsParams {
  eventId: string;
  raceId: string;
  authorization: Header<"Authorization">;
  results: RaceResultInput[];
}

// Merge/upsert bulk standings: each participant in the payload is upserted, but
// results for users absent from the payload are left untouched (no deletion).
// Only the participants named in the payload have their event-level aggregate
// recomputed. Same gating/validation as the full-replace endpoint.
//
// POST (rather than PATCH) is used here to match the codebase's convention of
// POSTing to a collection path for additive mutations (see addEventMember on
// /events/:id/members and recordLadderMatch on /events/:id/ladder/matches),
// keeping the full-replace semantics on PUT and the additive merge on POST.
export const mergeRaceResults = api(
  { expose: true, auth: true, method: "POST", path: "/events/:eventId/races/:raceId/results" },
  async (params: MergeRaceResultsParams): Promise<{ results: RaceResultView[] }> => {
    await requireEventPermission(prisma, {
      authorization: params.authorization,
      eventId: params.eventId,
      action: "update",
    });

    await requireRace(params.eventId, params.raceId);
    await validateResultInputs(params.eventId, params.results);

    for (const entry of params.results) {
      await prisma.raceResult.upsert({
        where: { raceEventId_userId: { raceEventId: params.raceId, userId: entry.userId } },
        create: {
          id: randomUUID(),
          raceEventId: params.raceId,
          userId: entry.userId,
          position: entry.position ?? null,
          points: entry.points,
        },
        update: {
          position: entry.position === undefined ? undefined : entry.position,
          points: entry.points,
        },
      });
    }

    for (const entry of params.results) {
      await recomputeEventPoints(params.eventId, entry.userId);
    }

    return listResults(params.raceId);
  },
);

interface DeleteRaceResultParams {
  eventId: string;
  raceId: string;
  userId: string;
  authorization: Header<"Authorization">;
}

// Removes a single participant's result from a race and recomputes that
// participant's event-level aggregate. Returns 404 if no such result exists.
// Gated by event-update permission on the parent event.
export const deleteRaceResult = api(
  { expose: true, auth: true, method: "DELETE", path: "/events/:eventId/races/:raceId/results/:userId" },
  async (params: DeleteRaceResultParams): Promise<{ deleted: boolean }> => {
    await requireEventPermission(prisma, {
      authorization: params.authorization,
      eventId: params.eventId,
      action: "update",
    });

    await requireRace(params.eventId, params.raceId);

    const existing = await prisma.raceResult.findUnique({
      where: { raceEventId_userId: { raceEventId: params.raceId, userId: params.userId } },
    });
    if (!existing) {
      throw APIError.notFound("result not found");
    }

    await prisma.raceResult.delete({
      where: { raceEventId_userId: { raceEventId: params.raceId, userId: params.userId } },
    });

    await recomputeEventPoints(params.eventId, params.userId);

    return { deleted: true };
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
    await requireRace(eventId, raceId);
    return listResults(raceId);
  },
);

// Loads the full ordered result list for a race and maps it to the view shape.
async function listResults(raceId: string): Promise<{ results: RaceResultView[] }> {
  const results = await prisma.raceResult.findMany({
    where: { raceEventId: raceId },
    orderBy: [{ position: "asc" }, { points: "desc" }],
  });
  return { results: results.map(toRaceResultView) };
}

// Asserts the race exists and belongs to the given event.
async function requireRace(eventId: string, raceId: string) {
  const race = await prisma.raceEvent.findUnique({ where: { id: raceId } });
  if (!race || race.eventId !== eventId) {
    throw APIError.notFound("race not found");
  }
  return race;
}

// Asserts the user exists and is a registered member of the event. A result must
// belong to an actual participant of the parent event; guarding here prevents
// dangling results (and cross-event leakage) for users who were never
// registered for the event.
async function requireEventMembership(eventId: string, userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw APIError.notFound("user not found");
  }
  const member = await prisma.eventMember.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });
  if (!member) {
    throw APIError.failedPrecondition("user is not a member of this event");
  }
}

// Validates a bulk standings payload: rejects duplicate userIds and asserts each
// participant exists and is a member of the event.
async function validateResultInputs(
  eventId: string,
  results: RaceResultInput[],
): Promise<void> {
  const seen = new Set<string>();
  for (const entry of results) {
    if (seen.has(entry.userId)) {
      throw APIError.invalidArgument(`duplicate userId in payload: ${entry.userId}`);
    }
    seen.add(entry.userId);
  }
  for (const entry of results) {
    await requireEventMembership(eventId, entry.userId);
  }
}

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
