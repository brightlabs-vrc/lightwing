import { api, APIError, Header } from "encore.dev/api";
import { prisma } from "./prisma";
import { requireEventPermission } from "../auth/rbac";
import { loadEvent, recomputeEventPointsInternal, type EventDetail } from "./events";
import { invalidateEventCaches } from "./cache-utils";
import { validateCustomScoringTables } from "./scoring";
import { SCORING_POINTS } from "../lib/constants";

import { parseOptionalPositiveInt, assertLimitCanBeReduced, ERROR_CODES } from "./participation-limits";

interface UpdateEventParams {
  id: string;
  authorization: Header<"Authorization">;
  name?: string;
  description?: string | null;
  scoringRulesMode?: string | null;
  customScoringTables?: any | null;
  classRestriction?: any | null;
  scheduledAt?: string | null;
  participantLimit?: number | null;
  maxConcurrentRaceParticipations?: number | null;
}

// Updates an event's editable fields (scoring type is immutable once set).
export const updateEvent = api(
  { expose: true, auth: true, method: "PATCH", path: "/api/events/:id" },
  async (params: UpdateEventParams): Promise<EventDetail> => {
    const existingEvent = await prisma.event.findUnique({ where: { id: params.id } });
    if (!existingEvent) {
      throw APIError.notFound("event not found");
    }
    await requireEventPermission(prisma, {
      authorization: params.authorization,
      eventId: params.id,
      action: "update",
    });

    const participantLimitParsed = parseOptionalPositiveInt(params.participantLimit, "participantLimit");
    const maxConcurrentRaceParticipationsParsed = parseOptionalPositiveInt(params.maxConcurrentRaceParticipations, "maxConcurrentRaceParticipations");

    const isGranular = existingEvent.granularParticipation;

    if (isGranular) {
      if (participantLimitParsed !== undefined && participantLimitParsed !== null) {
        throw APIError.invalidArgument("Granular events cannot have an event-level participant limit");
      }
    } else {
      if (maxConcurrentRaceParticipationsParsed !== undefined && maxConcurrentRaceParticipationsParsed !== null) {
        throw APIError.invalidArgument("Regular events cannot have a maxConcurrentRaceParticipations limit");
      }
    }

    // Capacity checks before reducing a limit
    if (!isGranular && participantLimitParsed !== undefined && participantLimitParsed !== null) {
      const currentCount = await prisma.eventMember.count({
        where: { eventId: params.id },
      });
      assertLimitCanBeReduced(
        currentCount,
        participantLimitParsed,
        ERROR_CODES.PARTICIPANT_LIMIT_BELOW_CURRENT_ENROLLMENT,
        "Participant limit cannot be lower than the current enrollment"
      );
    }

    if (isGranular && maxConcurrentRaceParticipationsParsed !== undefined && maxConcurrentRaceParticipationsParsed !== null) {
      // highest number of currently joined races for any user in this event
      const rawCounts = await prisma.raceEventMember.groupBy({
        by: ["userId"],
        where: {
          raceEvent: { eventId: params.id },
        },
        _count: {
          raceEventId: true,
        },
      });
      const maxJoined = rawCounts.reduce((max, group) => Math.max(max, group._count.raceEventId), 0);
      assertLimitCanBeReduced(
        maxJoined,
        maxConcurrentRaceParticipationsParsed,
        ERROR_CODES.PARTICIPANT_LIMIT_BELOW_CURRENT_ENROLLMENT,
        "Max races limit cannot be lower than any member's current race enrollment count"
      );
    }

    let updatedScoringRulesMode: string | undefined = undefined;
    let updatedCustomScoringTables: any | undefined = undefined;
    let triggerRecomputation = false;

    if (existingEvent.scoringType === SCORING_POINTS) {
      if (params.scoringRulesMode !== undefined) {
        updatedScoringRulesMode = params.scoringRulesMode ?? "STANDARD";
        if (updatedScoringRulesMode === "CUSTOM") {
          const tables = params.customScoringTables !== undefined ? params.customScoringTables : existingEvent.customScoringTables;
          if (!tables) {
            throw APIError.invalidArgument("customScoringTables is required when scoringRulesMode is CUSTOM");
          }
          validateCustomScoringTables(tables);
          updatedCustomScoringTables = tables;
        } else {
          updatedCustomScoringTables = null;
        }

        if (existingEvent.scoringRulesMode !== updatedScoringRulesMode) {
          triggerRecomputation = true;
        }
      }

      if (params.customScoringTables !== undefined && (updatedScoringRulesMode ?? existingEvent.scoringRulesMode) === "CUSTOM") {
        validateCustomScoringTables(params.customScoringTables);
        updatedCustomScoringTables = params.customScoringTables;

        if (JSON.stringify(existingEvent.customScoringTables) !== JSON.stringify(updatedCustomScoringTables)) {
          triggerRecomputation = true;
        }
      }
    }

    await prisma.event.update({
      where: { id: params.id },
      data: {
        name: params.name ?? undefined,
        description: params.description === undefined ? undefined : params.description,
        scoringRulesMode: updatedScoringRulesMode,
        customScoringTables: updatedCustomScoringTables,
        classRestriction:
          params.classRestriction === undefined ? undefined : params.classRestriction,
        scheduledAt: params.scheduledAt === undefined ? undefined : params.scheduledAt ? new Date(params.scheduledAt) : null,
        participantLimit: participantLimitParsed,
        maxConcurrentRaceParticipations: maxConcurrentRaceParticipationsParsed,
      },
    });

    if (triggerRecomputation) {
      await recomputeEventPointsInternal(params.id);
    }

    await invalidateEventCaches(params.id);

    return loadEvent(params.id);
  },
);
