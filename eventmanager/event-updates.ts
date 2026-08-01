import { api, APIError, Header } from "encore.dev/api";
import { prisma } from "./prisma";
import { requireEventPermission } from "../auth/rbac";
import { loadEvent, recomputeEventPointsInternal, type EventDetail } from "./events";
import { invalidateEventCaches } from "./cache-utils";
import { validateCustomScoringTables } from "./scoring";
import { SCORING_POINTS } from "../lib/constants";

interface UpdateEventParams {
  id: string;
  authorization: Header<"Authorization">;
  name?: string;
  description?: string | null;
  scoringRulesMode?: string | null;
  customScoringTables?: any | null;
  classRestriction?: any | null;
  granularParticipation?: boolean;
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
        granularParticipation:
          params.granularParticipation === undefined ? undefined : params.granularParticipation,
      },
    });

    if (triggerRecomputation) {
      await recomputeEventPointsInternal(params.id);
    }

    await invalidateEventCaches(params.id);

    return loadEvent(params.id);
  },
);
