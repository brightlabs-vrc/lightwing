// Shared type definitions for the frontend

export type ClassTier = 'PRE_OP' | 'OP' | 'G3' | 'G2' | 'G1'

export const CLASS_TIER_LABELS: Record<ClassTier, string> = {
  PRE_OP: 'PRE-OP',
  OP: 'OP',
  G3: 'G3',
  G2: 'G2',
  G1: 'G1',
}
