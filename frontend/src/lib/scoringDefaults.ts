export const DEFAULT_SCORING_TABLES: Record<string, Record<number, number>> = {
  OP:   { 1: 12, 2: 10, 3: 8,  4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1 },
  GIII: { 1: 15, 2: 12, 3: 10, 4: 8, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1 },
  GII:  { 1: 19, 2: 15, 3: 12, 4: 9, 5: 8, 6: 6, 7: 5, 8: 3, 9: 2, 10: 1 },
  GI:   { 1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1 },
} as const;

export const GRADE_KEYS = ['OP', 'GIII', 'GII', 'GI'] as const;
export type GradeKey = typeof GRADE_KEYS[number];
