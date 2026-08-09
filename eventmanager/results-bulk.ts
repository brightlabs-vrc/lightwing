import { api, APIError, Header } from "encore.dev/api";
import { prisma } from "./prisma";
import { requireEventPermission } from "../auth/rbac";
import { scorecalc } from "~encore/clients";
import { resolvePoints } from "./scoring";
import { invalidateEventCaches } from "./cache-utils";
import { buildRaceResultUpsert, type RaceResultInput } from "./result-upsert";
import { SCORING_POINTS } from "../lib/constants";
import {
  requireRace,
  requireMembershipForResult,
  listResults,
  type RaceResultView,
} from "./results";

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
  { expose: true, auth: true, method: "PUT", path: "/api/events/:eventId/races/:raceId/results" },
  async (params: ReplaceRaceResultsParams): Promise<{ results: RaceResultView[] }> => {
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
      let pointsToPersist = entry.points ?? 0;
      if (event.scoringType === SCORING_POINTS) { // Points-based
        pointsToPersist = resolvePoints({
          scoringRulesMode: event.scoringRulesMode,
          customScoringTables: event.customScoringTables,
          grade: race.grade,
          position: entry.position ?? null,
          resultStatus: entry.resultStatus ?? null,
        });
      }

      await prisma.raceResult.upsert(
        buildRaceResultUpsert(params.raceId, entry, pointsToPersist)
      );
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

    await invalidateEventCaches(params.eventId);

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
  { expose: true, auth: true, method: "POST", path: "/api/events/:eventId/races/:raceId/results" },
  async (params: MergeRaceResultsParams): Promise<{ results: RaceResultView[] }> => {
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
    await validateResultInputs(params.eventId, params.raceId, params.results);

    for (const entry of params.results) {
      let pointsToPersist = entry.points ?? 0;
      if (event.scoringType === SCORING_POINTS) { // Points-based
        pointsToPersist = resolvePoints({
          scoringRulesMode: event.scoringRulesMode,
          customScoringTables: event.customScoringTables,
          grade: race.grade,
          position: entry.position ?? null,
          resultStatus: entry.resultStatus ?? null,
        });
      }

      await prisma.raceResult.upsert(
        buildRaceResultUpsert(params.raceId, entry, pointsToPersist)
      );
    }

    const affectedUserIds = params.results.map((entry) => entry.userId);
    if (affectedUserIds.length > 0) {
      await scorecalc.submitCalc({ eventId: params.eventId, userIds: affectedUserIds });
    }

    await invalidateEventCaches(params.eventId);

    return listResults(params.raceId);
  },
);

// Validates a bulk standings payload: rejects duplicate userIds and asserts each
// participant exists and is a member of the event/race.
export async function validateResultInputs(
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
