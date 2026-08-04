import { describe, expect, test } from "vitest";
import { ClassTier } from "@prisma/client";
import {
  CLASS_TIER_LABELS,
  CLASS_TIER_ORDER,
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

  test("G1 eligibility: can enter G1 and G2, but not G3, OP, or PRE_OP", () => {
    expect(isEligible(ClassTier.G1, ClassTier.G1)).toBe(true);
    expect(isEligible(ClassTier.G1, ClassTier.G2)).toBe(true);
    expect(isEligible(ClassTier.G1, ClassTier.G3)).toBe(false);
    expect(isEligible(ClassTier.G1, ClassTier.OP)).toBe(false);
    expect(isEligible(ClassTier.G1, ClassTier.PRE_OP)).toBe(false);
  });

  test("G2 eligibility: can enter G2 and G3, but not G1, OP, or PRE_OP", () => {
    expect(isEligible(ClassTier.G2, ClassTier.G2)).toBe(true);
    expect(isEligible(ClassTier.G2, ClassTier.G3)).toBe(true);
    expect(isEligible(ClassTier.G2, ClassTier.G1)).toBe(false);
    expect(isEligible(ClassTier.G2, ClassTier.OP)).toBe(false);
    expect(isEligible(ClassTier.G2, ClassTier.PRE_OP)).toBe(false);
  });

  test("G3 eligibility: can enter G3 and OP, but not G2, G1, or PRE_OP", () => {
    expect(isEligible(ClassTier.G3, ClassTier.G3)).toBe(true);
    expect(isEligible(ClassTier.G3, ClassTier.OP)).toBe(true);
    expect(isEligible(ClassTier.G3, ClassTier.G2)).toBe(false);
    expect(isEligible(ClassTier.G3, ClassTier.G1)).toBe(false);
    expect(isEligible(ClassTier.G3, ClassTier.PRE_OP)).toBe(false);
  });

  test("PRE_OP eligibility: can enter PRE_OP and OP only", () => {
    expect(isEligible(ClassTier.PRE_OP, ClassTier.PRE_OP)).toBe(true);
    expect(isEligible(ClassTier.PRE_OP, ClassTier.OP)).toBe(true);
    expect(isEligible(ClassTier.PRE_OP, ClassTier.G3)).toBe(false);
    expect(isEligible(ClassTier.PRE_OP, ClassTier.G2)).toBe(false);
    expect(isEligible(ClassTier.PRE_OP, ClassTier.G1)).toBe(false);
  });

  test("OP eligibility: can enter OP and PRE_OP, but not G3, G2, or G1", () => {
    expect(isEligible(ClassTier.OP, ClassTier.OP)).toBe(true);
    expect(isEligible(ClassTier.OP, ClassTier.PRE_OP)).toBe(true);
    expect(isEligible(ClassTier.OP, ClassTier.G3)).toBe(false);
    expect(isEligible(ClassTier.OP, ClassTier.G2)).toBe(false);
    expect(isEligible(ClassTier.OP, ClassTier.G1)).toBe(false);
  });

  test("null participant checks", () => {
    expect(isEligible(null, ClassTier.OP)).toBe(false);
  });
});
