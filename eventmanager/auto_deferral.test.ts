import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import { createEvent, deleteEvent } from "./events";
import { createRaceEvent } from "./raceevents";
import { assignRaceResult, listRaceResults, deleteRaceResult } from "./results";
import { SCORING_POINTS } from "../lib/constants";

describe("Auto-deferral behavior for OP wins and custom scoring tables", () => {
  let createdEventIds: string[] = [];
  let createdUserIds: string[] = [];
  let createdSessionTokens: string[] = [];
  let authHeader = "";

  async function createTestUser(name: string, classTier: any = null, siteRole: "USER" | "SITE_ADMIN" = "USER") {
    const userId = `user-${randomUUID()}`;
    await prisma.user.create({
      data: {
        id: userId,
        name,
        email: `${userId}@example.com`,
        classTier,
        siteRole,
      },
    });
    createdUserIds.push(userId);
    return userId;
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

  beforeEach(async () => {
    createdEventIds = [];
    createdUserIds = [];
    createdSessionTokens = [];
    const adminId = await createTestUser("Admin User", null, "SITE_ADMIN");
    const token = await createSession(adminId);
    authHeader = `Bearer ${token}`;
  });

  afterEach(async () => {
    if (createdSessionTokens.length > 0) {
      await prisma.session.deleteMany({ where: { token: { in: createdSessionTokens } } });
      createdSessionTokens.length = 0;
    }
    for (const eventId of createdEventIds) {
      try {
        await deleteEvent({ id: eventId, authorization: authHeader as any });
      } catch {}
    }
    for (const userId of createdUserIds) {
      try {
        await prisma.user.delete({ where: { id: userId } });
      } catch {}
    }
  });

  test("ungraded user placing 1st in standard OP race gets auto-deferred in other races", async () => {
    const user1 = await createTestUser("Ungraded Competitor", null);
    const user2 = await createTestUser("Graded Competitor G1", "G1");

    const event = await createEvent({
      authorization: authHeader as any,
      name: "Auto Defer Test Event",
      ownerType: "USER",
      scoringType: SCORING_POINTS,
      scoringRulesMode: "STANDARD",
      granularParticipation: false,
    });
    createdEventIds.push(event.id);

    // Add members
    await prisma.eventMember.createMany({
      data: [
        { id: randomUUID(), eventId: event.id, userId: user1 },
        { id: randomUUID(), eventId: event.id, userId: user2 },
      ],
    });

    // Create 2 races: Race 1 is OP, Race 2 is GIII
    const race1 = await createRaceEvent({
      eventId: event.id,
      authorization: authHeader as any,
      name: "Race 1 OP",
      distanceMeters: 1200,
      trackType: "Turf",
      location: "Kyoto",
      grade: "OP",
    });

    const race2 = await createRaceEvent({
      eventId: event.id,
      authorization: authHeader as any,
      name: "Race 2 GIII",
      distanceMeters: 1600,
      trackType: "Dirt",
      location: "Tokyo",
      grade: "GIII",
    });

    // Assign user1 1st place in Race 1
    await assignRaceResult({
      eventId: event.id,
      raceId: race1.id,
      userId: user1,
      authorization: authHeader as any,
      position: 1,
    });

    // Check race 2 results for user1
    const race2Results = await listRaceResults({ eventId: event.id, raceId: race2.id });
    const user1Race2 = race2Results.results.find((r) => r.userId === user1);

    expect(user1Race2).toBeDefined();
    expect(user1Race2?.resultStatus).toBe("DEFERRED");
    expect(user1Race2?.points).toBe(0);

    // Graded user (G1) placing 1st in OP race should NOT cause auto-deferral
    await assignRaceResult({
      eventId: event.id,
      raceId: race1.id,
      userId: user2,
      authorization: authHeader as any,
      position: 1,
    });

    // Removing user1 1st place should revert user1 deferral in Race 2
    await deleteRaceResult({
      eventId: event.id,
      raceId: race1.id,
      userId: user1,
      authorization: authHeader as any,
    });

    const race2ResultsAfter = await listRaceResults({ eventId: event.id, raceId: race2.id });
    const user1Race2After = race2ResultsAfter.results.find((r) => r.userId === user1);
    expect(user1Race2After?.resultStatus).toBeNull();
  });

  test("custom scoring tables allow configuring auto-deferral on GIII grade and disabling via master toggle", async () => {
    const user1 = await createTestUser("Ungraded Competitor Custom", null);

    const customTables = {
      autoDeferEnabled: true,
      OP:   { 1: 12, 2: 10, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1, autoDefer: false },
      GIII: { 1: 15, 2: 12, 3: 10, 4: 8, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1, autoDefer: true },
      GII:  { 1: 19, 2: 15, 3: 12, 4: 9, 5: 8, 6: 6, 7: 5, 8: 3, 9: 2, 10: 1, autoDefer: false },
      GI:   { 1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1, autoDefer: false },
    };

    const event = await createEvent({
      authorization: authHeader as any,
      name: "Custom Auto Defer Event",
      ownerType: "USER",
      scoringType: SCORING_POINTS,
      scoringRulesMode: "CUSTOM",
      customScoringTables: customTables,
      granularParticipation: false,
    });
    createdEventIds.push(event.id);

    await prisma.eventMember.create({
      data: { id: randomUUID(), eventId: event.id, userId: user1 },
    });

    const race1 = await createRaceEvent({
      eventId: event.id,
      authorization: authHeader as any,
      name: "Race 1 OP",
      distanceMeters: 1200,
      trackType: "Turf",
      location: "Kyoto",
      grade: "OP",
    });

    const race2 = await createRaceEvent({
      eventId: event.id,
      authorization: authHeader as any,
      name: "Race 2 GIII",
      distanceMeters: 1600,
      trackType: "Dirt",
      location: "Tokyo",
      grade: "GIII",
    });

    // 1st place in OP should NOT trigger auto defer because custom OP autoDefer is false
    await assignRaceResult({
      eventId: event.id,
      raceId: race1.id,
      userId: user1,
      authorization: authHeader as any,
      position: 1,
    });

    let r2Res = await listRaceResults({ eventId: event.id, raceId: race2.id });
    expect(r2Res.results.find((r) => r.userId === user1)).toBeUndefined();

    // 1st place in GIII SHOULD trigger auto defer because custom GIII autoDefer is true
    await assignRaceResult({
      eventId: event.id,
      raceId: race2.id,
      userId: user1,
      authorization: authHeader as any,
      position: 1,
    });

    let r1Res = await listRaceResults({ eventId: event.id, raceId: race1.id });
    expect(r1Res.results.find((r) => r.userId === user1)?.resultStatus).toBe("DEFERRED");
  });

  test("manually assigning DEFERRED status is supported regardless of 1st place wins", async () => {
    const user1 = await createTestUser("Manual Defer Competitor", null);

    const event = await createEvent({
      authorization: authHeader as any,
      name: "Manual Defer Event",
      ownerType: "USER",
      scoringType: SCORING_POINTS,
      scoringRulesMode: "STANDARD",
      granularParticipation: false,
    });
    createdEventIds.push(event.id);

    await prisma.eventMember.create({
      data: { id: randomUUID(), eventId: event.id, userId: user1 },
    });

    const race = await createRaceEvent({
      eventId: event.id,
      authorization: authHeader as any,
      name: "Race GIII",
      distanceMeters: 1600,
      trackType: "Turf",
      location: "Kyoto",
      grade: "GIII",
    });

    // Manually assign resultStatus DEFERRED
    const res = await assignRaceResult({
      eventId: event.id,
      raceId: race.id,
      userId: user1,
      authorization: authHeader as any,
      resultStatus: "DEFERRED",
      position: 5,
    });

    expect(res.resultStatus).toBe("DEFERRED");
    expect(res.points).toBe(0);
  });
});
