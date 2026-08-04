import { randomUUID } from "node:crypto";
import { api, APIError, Header } from "encore.dev/api";
import { prisma } from "./prisma";
import { requireEventPermission } from "../auth/rbac";
import { scorecalc } from "~encore/clients";
import { resolvePoints } from "./scoring";
import { invalidateEventCaches } from "./cache-utils";
import { buildRaceResultUpsert } from "./result-upsert";
import { SCORING_POINTS } from "../lib/constants";

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
  gateNumber: number | null;
  finishTime: string | null;
  margin: string | null;
  passingOrder: string | null;
  final3F: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AssignRaceResultParams {
  eventId: string;
  raceId: string;
  userId: string;
  authorization: Header<"Authorization">;
  position?: number | null;
  points?: number | null;
  gateNumber?: number | null;
  finishTime?: string | null;
  margin?: string | null;
  passingOrder?: string | null;
  final3F?: string | null;
}

// Assigns (or updates) a participant's result on a race. Gated by event-update
// permission on the parent event (event admins, with site-admin override).
export const assignRaceResult = api(
  { expose: true, auth: true, method: "PUT", path: "/api/events/:eventId/races/:raceId/results/:userId" },
  async (params: AssignRaceResultParams): Promise<RaceResultView> => {
    await requireEventPermission(prisma, {
      authorization: params.authorization,
      eventId: params.eventId,
      action: "update",
    });

    const event = await prisma.event.findUnique({
      where: { id: params.eventId },
    });
    if (!event) {
      throw APIError.notFound("event not found");
    }

    const race = await requireRace(params.eventId, params.raceId);
    await requireMembershipForResult(params.eventId, params.raceId, params.userId);

    let pointsToPersist = params.points ?? 0;
    if (event.scoringType === SCORING_POINTS) { // Points-based
      pointsToPersist = resolvePoints({
        scoringRulesMode: event.scoringRulesMode,
        customScoringTables: event.customScoringTables,
        grade: race.grade,
        position: params.position ?? null,
      });
    }

    const result = await prisma.raceResult.upsert(
      buildRaceResultUpsert(params.raceId, params, pointsToPersist)
    );

    await scorecalc.submitCalc({ eventId: params.eventId, userIds: [params.userId] });
    await invalidateEventCaches(params.eventId);

    return toRaceResultView(result);
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
  { expose: true, auth: true, method: "DELETE", path: "/api/events/:eventId/races/:raceId/results/:userId" },
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

    await scorecalc.submitCalc({ eventId: params.eventId, userIds: [params.userId] });
    await invalidateEventCaches(params.eventId);

    return { deleted: true };
  },
);

interface ListRaceResultsParams {
  eventId: string;
  raceId: string;
}

// Lists the results recorded for a single race, ordered by finishing position.
export const listRaceResults = api(
  { expose: true, method: "GET", path: "/api/events/:eventId/races/:raceId/results" },
  async ({ eventId, raceId }: ListRaceResultsParams): Promise<{ results: RaceResultView[] }> => {
    await requireRace(eventId, raceId);
    return listResults(raceId);
  },
);

// Loads the full ordered result list for a race and maps it to the view shape.
export async function listResults(raceId: string): Promise<{ results: RaceResultView[] }> {
  const results = await prisma.raceResult.findMany({
    where: { raceEventId: raceId },
    orderBy: [{ position: "asc" }, { points: "desc" }],
  });
  return { results: results.map(toRaceResultView) };
}

// Asserts the race exists and belongs to the given event.
export async function requireRace(eventId: string, raceId: string) {
  const race = await prisma.raceEvent.findUnique({ where: { id: raceId } });
  if (!race || race.eventId !== eventId) {
    throw APIError.notFound("race not found");
  }
  return race;
}

// Asserts the user exists and is registered based on granularParticipation settings.
export async function requireMembershipForResult(eventId: string, raceId: string, userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw APIError.notFound("user not found");
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { granularParticipation: true },
  });
  if (!event) {
    throw APIError.notFound("event not found");
  }

  if (event.granularParticipation) {
    const raceMember = await prisma.raceEventMember.findUnique({
      where: { raceEventId_userId: { raceEventId: raceId, userId } },
    });
    if (!raceMember) {
      throw APIError.failedPrecondition("user is not registered for this race");
    }
  } else {
    const member = await prisma.eventMember.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (!member) {
      throw APIError.failedPrecondition("user is not a member of this event");
    }
  }
}

export type RaceResultRow = {
  id: string;
  raceEventId: string;
  userId: string;
  position: number | null;
  points: number;
  gateNumber: number | null;
  finishTime: string | null;
  margin: string | null;
  passingOrder: string | null;
  final3F: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toRaceResultView(result: RaceResultRow): RaceResultView {
  return {
    id: result.id,
    raceEventId: result.raceEventId,
    userId: result.userId,
    position: result.position,
    points: result.points,
    gateNumber: result.gateNumber,
    finishTime: result.finishTime,
    margin: result.margin,
    passingOrder: result.passingOrder,
    final3F: result.final3F,
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
  };
}
