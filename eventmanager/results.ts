import { randomUUID } from "node:crypto";
import { api, APIError, Header } from "encore.dev/api";
import { prisma } from "./prisma";
import { requireEventPermission } from "../auth/rbac";
import { scorecalc } from "~encore/clients";

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

// One participant's entry in a bulk standings payload.
export interface RaceResultInput {
  userId: string;
  position?: number | null;
  points: number;
  gateNumber?: number | null;
  finishTime?: string | null;
  margin?: string | null;
  passingOrder?: string | null;
  final3F?: string | null;
}

interface AssignRaceResultParams {
  eventId: string;
  raceId: string;
  userId: string;
  authorization: Header<"Authorization">;
  position?: number | null;
  points: number;
  gateNumber?: number | null;
  finishTime?: string | null;
  margin?: string | null;
  passingOrder?: string | null;
  final3F?: string | null;
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
    await requireMembershipForResult(params.eventId, params.raceId, params.userId);

    const result = await prisma.raceResult.upsert({
      where: { raceEventId_userId: { raceEventId: params.raceId, userId: params.userId } },
      create: {
        id: randomUUID(),
        raceEventId: params.raceId,
        userId: params.userId,
        position: params.position ?? null,
        points: params.points,
        gateNumber: params.gateNumber ?? null,
        finishTime: params.finishTime ?? null,
        margin: params.margin ?? null,
        passingOrder: params.passingOrder ?? null,
        final3F: params.final3F ?? null,
      },
      update: {
        position: params.position === undefined ? undefined : params.position,
        points: params.points,
        gateNumber: params.gateNumber === undefined ? undefined : params.gateNumber,
        finishTime: params.finishTime === undefined ? undefined : params.finishTime,
        margin: params.margin === undefined ? undefined : params.margin,
        passingOrder: params.passingOrder === undefined ? undefined : params.passingOrder,
        final3F: params.final3F === undefined ? undefined : params.final3F,
      },
    });

    await scorecalc.submitCalc({ eventId: params.eventId, userIds: [params.userId] });

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
    await validateResultInputs(params.eventId, params.raceId, params.results);

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
          gateNumber: entry.gateNumber ?? null,
          finishTime: entry.finishTime ?? null,
          margin: entry.margin ?? null,
          passingOrder: entry.passingOrder ?? null,
          final3F: entry.final3F ?? null,
        },
        update: {
          position: entry.position === undefined ? undefined : entry.position,
          points: entry.points,
          gateNumber: entry.gateNumber === undefined ? undefined : entry.gateNumber,
          finishTime: entry.finishTime === undefined ? undefined : entry.finishTime,
          margin: entry.margin === undefined ? undefined : entry.margin,
          passingOrder: entry.passingOrder === undefined ? undefined : entry.passingOrder,
          final3F: entry.final3F === undefined ? undefined : entry.final3F,
        },
      });
    }

    if (removedUserIds.length > 0) {
      await prisma.raceResult.deleteMany({
        where: { raceEventId: params.raceId, userId: { in: removedUserIds } },
      });
    }

    const allAffectedUserIds = Array.from(new Set([...payloadUserIds, ...removedUserIds]));
    if (allAffectedUserIds.length > 0) {
      await scorecalc.submitCalc({ eventId: params.eventId, userIds: allAffectedUserIds });
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
    await validateResultInputs(params.eventId, params.raceId, params.results);

    for (const entry of params.results) {
      await prisma.raceResult.upsert({
        where: { raceEventId_userId: { raceEventId: params.raceId, userId: entry.userId } },
        create: {
          id: randomUUID(),
          raceEventId: params.raceId,
          userId: entry.userId,
          position: entry.position ?? null,
          points: entry.points,
          gateNumber: entry.gateNumber ?? null,
          finishTime: entry.finishTime ?? null,
          margin: entry.margin ?? null,
          passingOrder: entry.passingOrder ?? null,
          final3F: entry.final3F ?? null,
        },
        update: {
          position: entry.position === undefined ? undefined : entry.position,
          points: entry.points,
          gateNumber: entry.gateNumber === undefined ? undefined : entry.gateNumber,
          finishTime: entry.finishTime === undefined ? undefined : entry.finishTime,
          margin: entry.margin === undefined ? undefined : entry.margin,
          passingOrder: entry.passingOrder === undefined ? undefined : entry.passingOrder,
          final3F: entry.final3F === undefined ? undefined : entry.final3F,
        },
      });
    }

    const affectedUserIds = params.results.map((entry) => entry.userId);
    if (affectedUserIds.length > 0) {
      await scorecalc.submitCalc({ eventId: params.eventId, userIds: affectedUserIds });
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

    await scorecalc.submitCalc({ eventId: params.eventId, userIds: [params.userId] });

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

// Asserts the user exists and is registered based on granularParticipation settings.
async function requireMembershipForResult(eventId: string, raceId: string, userId: string): Promise<void> {
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

// Validates a bulk standings payload: rejects duplicate userIds and asserts each
// participant exists and is a member of the event/race.
async function validateResultInputs(
  eventId: string,
  raceId: string,
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
    await requireMembershipForResult(eventId, raceId, entry.userId);
  }
}

type RaceResultRow = {
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

function toRaceResultView(result: RaceResultRow): RaceResultView {
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
