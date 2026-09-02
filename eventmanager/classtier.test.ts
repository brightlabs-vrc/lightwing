import { describe, expect, test } from "vitest";
import { ClassTier } from "@prisma/client";
import {
  CLASS_TIER_LABELS,
  CLASS_TIER_ORDER,
  getEligibleClassRestrictions,
  isEligible,
} from "./classtier";

describe("class tiers", () => {
  test("are ordered from PRE-OP up to G1", () => {
    expect(CLASS_TIER_ORDER).toEqual([
      ClassTier.PRE_OP,
      ClassTier.OP,
      ClassTier.G3,
      ClassTier.G2,
      ClassTier.G1,
    ]);
  });

  test("PRE_OP renders with a hyphen", () => {
    expect(CLASS_TIER_LABELS.PRE_OP).toBe("PRE-OP");
  });
});

describe("isEligible", () => {
  test("open events accept anyone, including unclassified participants", () => {
    expect(isEligible(null, null)).toBe(true);
    expect(isEligible(ClassTier.G2, null)).toBe(true);
  });

  test("G1 eligibility: can enter G1 and G2, and unrestricted/PRE_OP/OP", () => {
    expect(isEligible(ClassTier.G1, ClassTier.G1)).toBe(true);
    expect(isEligible(ClassTier.G1, ClassTier.G2)).toBe(true);
    expect(isEligible(ClassTier.G1, ClassTier.G3)).toBe(false);
    expect(isEligible(ClassTier.G1, ClassTier.OP)).toBe(true); // Treated as null/unrestricted
    expect(isEligible(ClassTier.G1, ClassTier.PRE_OP)).toBe(true); // Treated as null/unrestricted
  });

  test("G2 eligibility: can enter G2 and G3, and unrestricted/PRE_OP/OP", () => {
    expect(isEligible(ClassTier.G2, ClassTier.G2)).toBe(true);
    expect(isEligible(ClassTier.G2, ClassTier.G3)).toBe(true);
    expect(isEligible(ClassTier.G2, ClassTier.G1)).toBe(false);
    expect(isEligible(ClassTier.G2, ClassTier.OP)).toBe(true); // Treated as null/unrestricted
    expect(isEligible(ClassTier.G2, ClassTier.PRE_OP)).toBe(true); // Treated as null/unrestricted
  });

  test("G3 eligibility: can enter G3 and unrestricted/PRE_OP/OP", () => {
    expect(isEligible(ClassTier.G3, ClassTier.G3)).toBe(true);
    expect(isEligible(ClassTier.G3, ClassTier.OP)).toBe(true); // Treated as null/unrestricted
    expect(isEligible(ClassTier.G3, ClassTier.G2)).toBe(false);
    expect(isEligible(ClassTier.G3, ClassTier.G1)).toBe(false);
    expect(isEligible(ClassTier.G3, ClassTier.PRE_OP)).toBe(true); // Treated as null/unrestricted
  });

  test("PRE_OP eligibility: can enter PRE_OP and OP, and unrestricted, but not restricted graded classes", () => {
    expect(isEligible(ClassTier.PRE_OP, ClassTier.PRE_OP)).toBe(true);
    expect(isEligible(ClassTier.PRE_OP, ClassTier.OP)).toBe(true);
    expect(isEligible(ClassTier.PRE_OP, ClassTier.G3)).toBe(false);
    expect(isEligible(ClassTier.PRE_OP, ClassTier.G2)).toBe(false);
    expect(isEligible(ClassTier.PRE_OP, ClassTier.G1)).toBe(false);
  });

  test("OP eligibility: can enter OP and PRE_OP, and unrestricted, but not restricted graded classes", () => {
    expect(isEligible(ClassTier.OP, ClassTier.OP)).toBe(true);
    expect(isEligible(ClassTier.OP, ClassTier.PRE_OP)).toBe(true);
    expect(isEligible(ClassTier.OP, ClassTier.G3)).toBe(false);
    expect(isEligible(ClassTier.OP, ClassTier.G2)).toBe(false);
    expect(isEligible(ClassTier.OP, ClassTier.G1)).toBe(false);
  });

  test("null participant checks", () => {
    expect(isEligible(null, ClassTier.OP)).toBe(true); // Treated as null restriction
    expect(isEligible(null, ClassTier.G3)).toBe(false);
  });
});

describe("getEligibleClassRestrictions", () => {
  const allTiers: (ClassTier | null)[] = [null, ClassTier.PRE_OP, ClassTier.OP, ClassTier.G3, ClassTier.G2, ClassTier.G1];

  test("produces allowedRestrictions perfectly matching isEligible for all combinations", () => {
    for (const pTier of allTiers) {
      const { allowedRestrictions } = getEligibleClassRestrictions(pTier);
      const allowedSet = new Set(allowedRestrictions);

      for (const rTier of allTiers) {
        const expected = isEligible(pTier, rTier);
        const actual = allowedSet.has(rTier);
        expect(actual).toBe(expected);
      }
    }
  });
});
