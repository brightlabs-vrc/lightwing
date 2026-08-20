import { randomUUID } from "node:crypto";
import { api, APIError, Header } from "encore.dev/api";
import { prisma } from "./prisma";
import { requireEventPermission } from "../auth/rbac";
import { scorecalc } from "~encore/clients";
import { resolvePoints, isAutoDeferGrade } from "./scoring";
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
  resultStatus: string | null;
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
  resultStatus?: string | null;
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
        resultStatus: params.resultStatus ?? null,
      });
    }

    const result = await prisma.raceResult.upsert(
      buildRaceResultUpsert(params.raceId, params, pointsToPersist)
    );

    await applyAutoDeferralsForEvent(params.eventId, params.raceId);

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

    await applyAutoDeferralsForEvent(params.eventId, params.raceId);

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
  resultStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// Auto-deferral logic for event race results:
// If someone places 1st in an auto-deferral race (e.g. OP grade) and doesn't have a grade yet
// (user.classTier is null or 'PRE_OP' or 'OP'), and they are signed up for multiple races in this event,
// automatically mark their results in OTHER races in this event as "DEFERRED" if they don't already have
// another explicit outcome or if they were set as DEFERRED.
// Conversely, if a user no longer places 1st in any auto-deferral race in this event, any DEFERRED results
// that were auto-assigned should be reverted (set resultStatus to null).
export async function applyAutoDeferralsForEvent(eventId: string, modifiedRaceId?: string): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      members: {
        select: { userId: true },
      },
      raceEvents: {
        include: {
          results: {
            include: {
              user: {
                select: { id: true, classTier: true },
              },
            },
          },
          raceMembers: {
            select: { userId: true },
          },
        },
      },
    },
  });

  if (!event || event.scoringType !== SCORING_POINTS) {
    return;
  }

  // Find all users who currently qualify for auto-deferral in this event.
  // Qualification criteria:
  // 1) User placed 1st (position === 1) in a race whose grade has autoDefer === true.
  // 2) User doesn't have a grade yet or is ungraded (classTier is null, "PRE_OP", or "OP").
  const winningUserIds = new Set<string>();

  for (const race of event.raceEvents) {
    const autoDefer = isAutoDeferGrade({
      scoringRulesMode: event.scoringRulesMode,
      customScoringTables: event.customScoringTables,
      grade: race.grade,
    });
    if (!autoDefer) continue;

    for (const res of race.results) {
      if (res.position === 1 && res.resultStatus !== "DSQ" && res.resultStatus !== "DNF" && res.resultStatus !== "DNS") {
        const tier = res.user.classTier;
        const isUngraded = !tier || tier === "PRE_OP" || tier === "OP";
        if (isUngraded) {
          winningUserIds.add(res.userId);
        }
      }
    }
  }

  // Iterate over all races and participants in this event.
  for (const race of event.raceEvents) {
    // Collect all registered users for this race (either via RaceResult or RaceEventMember, or EventMember if non-granular)
    const raceUserIds = new Set<string>();
    if (!event.granularParticipation) {
      for (const em of event.members) {
        raceUserIds.add(em.userId);
      }
    }
    for (const res of race.results) {
      raceUserIds.add(res.userId);
    }
    for (const rm of race.raceMembers) {
      raceUserIds.add(rm.userId);
    }

    for (const userId of raceUserIds) {
      const existingResult = race.results.find((r) => r.userId === userId);
      const isWinner = winningUserIds.has(userId);

      if (isWinner) {
        // If this user is a winner, check if this race is NOT one of the races they won 1st place in.
        const autoDeferThisRace = isAutoDeferGrade({
          scoringRulesMode: event.scoringRulesMode,
          customScoringTables: event.customScoringTables,
          grade: race.grade,
        });
        const wonThisRace = autoDeferThisRace && existingResult?.position === 1;

        if (!wonThisRace) {
          // They should be marked DEFERRED in this other race if resultStatus is null or 'DEFERRED'.
          // (We don't overwrite explicit DSQ, DNF, DNS).
          if (!existingResult) {
            // Create a RaceResult with resultStatus = 'DEFERRED' and 0 points
            await prisma.raceResult.create({
              data: {
                id: randomUUID(),
                raceEventId: race.id,
                userId,
                points: 0,
                resultStatus: "DEFERRED",
              },
            });
          } else if (!existingResult.resultStatus || existingResult.resultStatus === "DEFERRED") {
            if (existingResult.resultStatus !== "DEFERRED" || existingResult.points !== 0) {
              await prisma.raceResult.update({
                where: { id: existingResult.id },
                data: {
                  resultStatus: "DEFERRED",
                  points: 0,
                },
              });
            }
          }
        }
      } else {
        // User is NOT a winner of any auto-deferral race in this event anymore.
        // If they have a result in this race with resultStatus === 'DEFERRED',
        // revert it ONLY IF this race is NOT the race currently being modified by the admin.
        if (modifiedRaceId && race.id === modifiedRaceId) {
          continue;
        }

        if (existingResult && existingResult.resultStatus === "DEFERRED") {
          // Recompute points based on position if position exists
          const restoredPoints = resolvePoints({
            scoringRulesMode: event.scoringRulesMode,
            customScoringTables: event.customScoringTables,
            grade: race.grade,
            position: existingResult.position,
            resultStatus: null,
          });

          await prisma.raceResult.update({
            where: { id: existingResult.id },
            data: {
              resultStatus: null,
              points: restoredPoints,
            },
          });
        }
      }
    }
  }
}

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
    resultStatus: result.resultStatus ?? null,
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
  };
}
