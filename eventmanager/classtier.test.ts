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

  test("restricted events require an exact class match", () => {
    expect(isEligible(ClassTier.G1, ClassTier.G1)).toBe(true);
    expect(isEligible(ClassTier.G2, ClassTier.G1)).toBe(false);
    expect(isEligible(null, ClassTier.OP)).toBe(false);
  });
});
