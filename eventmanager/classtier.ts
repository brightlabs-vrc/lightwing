// API-facing skill class tier type. This is a plain string-literal union rather
// than the Prisma-generated `ClassTier` enum: Encore's API schema parser cannot
// use Prisma's runtime enum object as a type ("value used as type"). The values
// are byte-for-byte identical to the Prisma enum, so they interoperate with the
// database layer without conversion.
export type ClassTier = "PRE_OP" | "OP" | "G3" | "G2" | "G1";

// Class tiers ordered from lowest to highest skill (issue #3). PRE-OP is the
// entry tier; G1 is the top grade, mirroring Netkeiba-style grading.
export const CLASS_TIER_ORDER: ClassTier[] = ["PRE_OP", "OP", "G3", "G2", "G1"];

// Human-readable labels. The enum identifiers cannot contain hyphens, so
// PRE_OP is displayed as "PRE-OP".
export const CLASS_TIER_LABELS: Record<ClassTier, string> = {
  PRE_OP: "PRE-OP",
  OP: "OP",
  G3: "G3",
  G2: "G2",
  G1: "G1",
};

// Class restrictions exist so participants are matched with others of equal
// skill.
// Eligibility rules:
// - If there is no restriction, any participant is allowed.
// - Same class: allowed.
// - One class lower: allowed.
// - Two or more classes lower: rejected.
// - `PRE_OP`: allowed only for `PRE_OP` and `OP`.
export function isEligible(
  participantTier: ClassTier | null,
  eventRestriction: ClassTier | null,
): boolean {
  // PRE_OP and OP are treated as equivalent to unrestricted / none (null)
  const normParticipant = (participantTier === "PRE_OP" || participantTier === "OP") ? null : participantTier;
  const normRestriction = (eventRestriction === "PRE_OP" || eventRestriction === "OP") ? null : eventRestriction;

  if (normRestriction === null) {
    return true;
  }
  if (normParticipant === null) {
    return false;
  }

  if (normParticipant === normRestriction) {
    return true;
  }

  const pIdx = CLASS_TIER_ORDER.indexOf(normParticipant);
  const rIdx = CLASS_TIER_ORDER.indexOf(normRestriction);

  if (pIdx === -1 || rIdx === -1) {
    return false;
  }

  // Other racers can enter their own class or one class lower.
  // Since CLASS_TIER_ORDER is ["PRE_OP", "OP", "G3", "G2", "G1"],
  // one class lower restriction means rIdx === pIdx - 1.
  return rIdx === pIdx - 1;
}
