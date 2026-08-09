import { vi } from "vitest";

// Mock ~encore/clients before importing files that use it
vi.mock("~encore/clients", () => ({
  scorecalc: {
    submitCalc: async () => {},
  },
}));

import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, test } from "vitest";
import { prisma } from "./prisma";
import {
  getDefaultScoringTables,
  validateCustomScoringTables,
  resolvePoints,
} from "./scoring";
import { createEvent, recomputeEventPointsInternal } from "./events";
import { addEventMember } from "./event-members";
import { updateEvent } from "./event-updates";
import { createRaceEvent, updateRaceEvent } from "./raceevents";
import { assignRaceResult } from "./results";
import { replaceRaceResults, mergeRaceResults } from "./results-bulk";

const createdUserIds: string[] = [];
const createdEventIds: string[] = [];
const createdSessionTokens: string[] = [];

async function createUser(id: string, siteRole: "USER" | "SITE_ADMIN" = "USER") {
  const user = await prisma.user.create({
    data: {
      id,
      name: `User ${id}`,
      email: `${id}@example.com`,
      siteRole,
    },
  });
  createdUserIds.push(id);
  return user;
}

async function createSession(userId: string) {
  const token = `token-${randomUUID()}`;
  createdSessionTokens.push(token);
  await prisma.session.create({
    data: {
      id: `session-${randomUUID()}`,
      token,
      userId,
      expiresAt: new Date(Date.now() + 60_000 * 60),
    },
  });
  return token;
}

afterEach(async () => {
  if (createdSessionTokens.length > 0) {
    await prisma.session.deleteMany({ where: { token: { in: createdSessionTokens } } });
    createdSessionTokens.length = 0;
  }

  if (createdEventIds.length > 0) {
    await prisma.raceResult.deleteMany({ where: { raceEvent: { eventId: { in: createdEventIds } } } });
    await prisma.raceEventMember.deleteMany({ where: { raceEvent: { eventId: { in: createdEventIds } } } });
    await prisma.raceEvent.deleteMany({ where: { eventId: { in: createdEventIds } } });
    await prisma.eventMember.deleteMany({ where: { eventId: { in: createdEventIds } } });
    await prisma.eventPointsEntry.deleteMany({ where: { eventId: { in: createdEventIds } } });
    await prisma.eventLadderEntry.deleteMany({ where: { eventId: { in: createdEventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } });
    createdEventIds.length = 0;
  }

  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
});

describe("Points-based Scoring Automation Backend", () => {
  describe("Resolver logic (scoring.ts)", () => {
    test("getDefaultScoringTables returns a copy of correct standard tables", () => {
      const tables = getDefaultScoringTables();
      expect(tables.GI[1]).toBe(25);
      expect(tables.GII[1]).toBe(19);
      expect(tables.GIII[1]).toBe(15);
      expect(tables.OP[1]).toBe(12);
      expect(tables.GI[10]).toBe(1);
    });

    test("validateCustomScoringTables validates 4x10 grids with integers", () => {
      const validTable: any = {
        OP:   { 1: 10, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1 },
        GIII: { 1: 15, 2: 12, 3: 10, 4: 8, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1 },
        GII:  { 1: 20, 2: 15, 3: 12, 4: 9, 5: 8, 6: 6, 7: 5, 8: 3, 9: 2, 10: 1 },
        GI:   { 1: 30, 2: 25, 3: 20, 4: 15, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1 },
      };
      const result = validateCustomScoringTables(validTable);
      expect(result.GI[1]).toBe(30);
      expect(result.OP[1]).toBe(10);
    });

    test("validateCustomScoringTables throws on missing positions, missing grades, or non-integers", () => {
      const invalidTable1: any = {
        OP:   { 1: 10, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2 }, // Missing 10
        GIII: { 1: 15, 2: 12, 3: 10, 4: 8, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1 },
        GII:  { 1: 20, 2: 15, 3: 12, 4: 9, 5: 8, 6: 6, 7: 5, 8: 3, 9: 2, 10: 1 },
        GI:   { 1: 30, 2: 25, 3: 20, 4: 15, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1 },
      };
      expect(() => validateCustomScoringTables(invalidTable1)).toThrow();

      const invalidTable2: any = {
        OP:   { 1: 10, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: "not-int" },
        GIII: { 1: 15, 2: 12, 3: 10, 4: 8, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1 },
        GII:  { 1: 20, 2: 15, 3: 12, 4: 9, 5: 8, 6: 6, 7: 5, 8: 3, 9: 2, 10: 1 },
        GI:   { 1: 30, 2: 25, 3: 20, 4: 15, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1 },
      };
      expect(() => validateCustomScoringTables(invalidTable2)).toThrow();
    });

    test("resolvePoints handles fallback constraints perfectly", () => {
      // unlisted position / position out of bounds (1..10)
      expect(resolvePoints({ scoringRulesMode: "STANDARD", grade: "GI", position: 11 })).toBe(0);
      expect(resolvePoints({ scoringRulesMode: "STANDARD", grade: "GI", position: 0 })).toBe(0);
      expect(resolvePoints({ scoringRulesMode: "STANDARD", grade: "GI", position: null })).toBe(0);

      // missing/null grade
      expect(resolvePoints({ scoringRulesMode: "STANDARD", grade: null, position: 1 })).toBe(0);
      expect(resolvePoints({ scoringRulesMode: "STANDARD", grade: "NOT_A_GRADE", position: 1 })).toBe(0);

      // DSQ and DNF always resolve to 0 regardless of position
      expect(resolvePoints({ scoringRulesMode: "STANDARD", grade: "GI", position: 1, resultStatus: "DSQ" })).toBe(0);
      expect(resolvePoints({ scoringRulesMode: "STANDARD", grade: "GI", position: 1, resultStatus: "DNF" })).toBe(0);
      expect(resolvePoints({ scoringRulesMode: "STANDARD", grade: "GI", position: null, resultStatus: "DSQ" })).toBe(0);
      expect(resolvePoints({ scoringRulesMode: "STANDARD", grade: "GI", position: null, resultStatus: "DNF" })).toBe(0);
    });
  });

  describe("End-to-End Write-Time Points Derivation & Recomputation", () => {
    test("Derived points and automatic recomputations work as expected", async () => {
      const admin = await createUser("admin-sc", "SITE_ADMIN");
      const adminToken = await createSession(admin.id);
      const authHeader = `Bearer ${adminToken}`;

      const participant = await createUser("part-sc");

      // 1. Create a points-based event (defaults to STANDARD scoringRulesMode)
      const event = await createEvent({
        authorization: authHeader,
        name: "Derivation Event",
        ownerType: "USER",
        scoringType: 1,
      });
      createdEventIds.push(event.id);
      expect(event.scoringRulesMode).toBe("STANDARD");

      // 2. Add member
      await addEventMember({
        authorization: authHeader,
        id: event.id,
        userId: participant.id,
      });

      // 3. Create a race with GII grade
      const race = await createRaceEvent({
        authorization: authHeader,
        eventId: event.id,
        name: "GII Race",
        distanceMeters: 1200,
        trackType: "Dirt",
        location: "Kyoto",
        grade: "GII",
      });

      // 4. Save result with position = 1 (GII 1st place points is 19). Points sent = 100 (ignored!)
      const result = await assignRaceResult({
        authorization: authHeader,
        eventId: event.id,
        raceId: race.id,
        userId: participant.id,
        position: 1,
        points: 100, // Should be ignored and derived to 19
      });
      expect(result.points).toBe(19);

      // 5. Change the race grade to GI (GI 1st place points is 25).
      // This should trigger automatic recomputation in the background.
      await updateRaceEvent({
        authorization: authHeader,
        eventId: event.id,
        raceId: race.id,
        grade: "GI",
      });

      // Let's verify result points has automatically recomputed to 25
      const recomputedResult = await prisma.raceResult.findUnique({
        where: { id: result.id },
      });
      expect(recomputedResult?.points).toBe(25);

      // 6. Update the event to use CUSTOM scoring tables.
      // 1st place for GI is now 50.
      const customTables: any = {
        OP:   { 1: 10, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1 },
        GIII: { 1: 15, 2: 12, 3: 10, 4: 8, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1 },
        GII:  { 1: 20, 2: 15, 3: 12, 4: 9, 5: 8, 6: 6, 7: 5, 8: 3, 9: 2, 10: 1 },
        GI:   { 1: 50, 2: 25, 3: 20, 4: 15, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1 },
      };

      await updateEvent({
        authorization: authHeader,
        id: event.id,
        scoringRulesMode: "CUSTOM",
        customScoringTables: customTables,
      });

      // Let's verify result points has automatically recomputed to 50
      const customRecomputedResult = await prisma.raceResult.findUnique({
        where: { id: result.id },
      });
      expect(customRecomputedResult?.points).toBe(50);
    });
  });
});
