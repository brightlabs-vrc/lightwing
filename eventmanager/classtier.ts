import { ClassTier } from "@prisma/client";

// Class tiers ordered from lowest to highest skill (issue #3). PRE-OP is the
// entry tier; G1 is the top grade, mirroring Netkeiba-style grading.
export const CLASS_TIER_ORDER: ClassTier[] = [
  ClassTier.PRE_OP,
  ClassTier.OP,
  ClassTier.G3,
  ClassTier.G2,
  ClassTier.G1,
];

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
// skill. A participant is eligible for an event when the event is open
// (no restriction) or their class tier exactly matches the event's restriction.
export function isEligible(
  participantTier: ClassTier | null,
  eventRestriction: ClassTier | null,
): boolean {
  if (eventRestriction === null) {
    return true;
  }
  return participantTier === eventRestriction;
}
