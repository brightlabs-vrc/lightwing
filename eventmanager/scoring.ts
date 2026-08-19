import { APIError } from "encore.dev/api";

export type RaceGrade = "OP" | "GIII" | "GII" | "GI";
export type GradeScoringTable = Record<number, number>;
export type EventScoringTables = Record<RaceGrade, GradeScoringTable>;
export type ScoringRulesMode = "STANDARD" | "CUSTOM";

export const DEFAULT_SCORING_TABLES: EventScoringTables = {
  OP:   { 1: 12, 2: 10, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1 },
  GIII: { 1: 15, 2: 12, 3: 10, 4: 8, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1 },
  GII:  { 1: 19, 2: 15, 3: 12, 4: 9, 5: 8, 6: 6, 7: 5, 8: 3, 9: 2, 10: 1 },
  GI:   { 1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1 },
};

export function getDefaultScoringTables(): EventScoringTables {
  return JSON.parse(JSON.stringify(DEFAULT_SCORING_TABLES));
}

// Validates a custom scoring tables payload.
// Returns a strongly-typed EventScoringTables if valid, or throws an APIError otherwise.
export function validateCustomScoringTables(input: unknown): EventScoringTables {
  if (!input || typeof input !== "object") {
    throw APIError.invalidArgument("Custom scoring tables must be an object");
  }

  const obj = input as Record<string, any>;
  const grades: RaceGrade[] = ["OP", "GIII", "GII", "GI"];
  const validatedTables: Partial<EventScoringTables> = {};

  for (const grade of grades) {
    const table = obj[grade];
    if (!table || typeof table !== "object") {
      throw APIError.invalidArgument(`Custom scoring table for grade ${grade} is missing or not an object`);
    }

    const gradeTable: GradeScoringTable = {};
    for (let pos = 1; pos <= 10; pos++) {
      const val = table[pos];
      if (val === undefined || val === null) {
        throw APIError.invalidArgument(`Custom scoring table for grade ${grade} is missing value for position ${pos}`);
      }

      const parsed = Number(val);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw APIError.invalidArgument(`Custom scoring table for grade ${grade} position ${pos} must be a non-negative integer`);
      }
      gradeTable[pos] = parsed;
    }
    validatedTables[grade] = gradeTable;
  }

  return validatedTables as EventScoringTables;
}

// Selects the scoring table for the given mode and grade.
export function getActiveScoringTable(params: {
  scoringRulesMode?: ScoringRulesMode | string | null;
  customScoringTables?: any | null;
  grade?: RaceGrade | string | null;
}): GradeScoringTable | null {
  const { scoringRulesMode, customScoringTables, grade } = params;

  if (!grade || !["OP", "GIII", "GII", "GI"].includes(grade)) {
    return null;
  }

  const activeGrade = grade as RaceGrade;

  if (scoringRulesMode === "CUSTOM" && customScoringTables) {
    try {
      const validated = validateCustomScoringTables(customScoringTables);
      return validated[activeGrade] || null;
    } catch {
      return null;
    }
  }

  return DEFAULT_SCORING_TABLES[activeGrade] || null;
}

// Resolves position to points based on event rules and race grade.
// DSQ/DNF/DNS results always resolve to 0 points regardless of position.
export function resolvePoints(params: {
  scoringRulesMode?: ScoringRulesMode | string | null;
  customScoringTables?: any | null;
  grade?: RaceGrade | string | null;
  position?: number | null;
  resultStatus?: string | null;
}): number {
  const { position, resultStatus } = params;

  // DSQ (Did Not Qualify), DNF (Did Not Finish), and DNS (Did Not Start) always resolve to 0 points
  if (resultStatus === "DSQ" || resultStatus === "DNF" || resultStatus === "DNS") {
    return 0;
  }

  if (!position || position < 1 || position > 10) {
    return 0;
  }

  const table = getActiveScoringTable(params);
  if (!table) {
    return 0;
  }

  return table[position] ?? 0;
}
