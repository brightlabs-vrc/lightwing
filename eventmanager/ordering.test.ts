import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, test } from "vitest";
import { prisma } from "./prisma";
import { createRaceEvent, reorderRaceEvents, listRaceEvents } from "./raceevents";
import type { ClassTier } from "./classtier";

const createdUserIds: string[] = [];
const createdSessionTokens: string[] = [];
const createdEventIds: string[] = [];

async function createUser(prefix: string, name: string, classTier: ClassTier | null = null, siteRole: "USER" | "SITE_ADMIN" = "USER") {
  const id = `${prefix}-${randomUUID()}`;
  await prisma.user.create({
    data: {
      id,
      name,
      email: `${id}@example.com`,
      classTier,
      siteRole,
    },
  });
  createdUserIds.push(id);
  return id;
}

async function createSession(userId: string) {
  const token = `token-${randomUUID()}`;
  await prisma.session.create({
    data: {
      id: `session-${randomUUID()}`,
      token,
      userId,
      expiresAt: new Date(Date.now() + 60_000 * 60),
    },
  });
  createdSessionTokens.push(token);
  return token;
}

async function createEvent(ownerUserId: string, name: string, status: "DRAFT" | "UNOFFICIAL" | "OFFICIAL" | "CONCLUDED") {
  const id = `event-${randomUUID()}`;
  await prisma.event.create({
    data: {
      id,
      name,
      ownerType: "USER",
      ownerUserId,
      status,
      scoringType: 1,
    },
  });
  createdEventIds.push(id);
  return id;
}

afterEach(async () => {
  if (createdEventIds.length > 0) {
    await prisma.eventMember.deleteMany({ where: { eventId: { in: createdEventIds } } });
    await prisma.eventPointsEntry.deleteMany({ where: { eventId: { in: createdEventIds } } });
    await prisma.eventLadderEntry.deleteMany({ where: { eventId: { in: createdEventIds } } });
    await prisma.raceEvent.deleteMany({ where: { eventId: { in: createdEventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } });
    createdEventIds.length = 0;
  }

  if (createdSessionTokens.length > 0) {
    await prisma.session.deleteMany({ where: { token: { in: createdSessionTokens } } });
    createdSessionTokens.length = 0;
  }

  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
});

describe("Race creation auto-sequencing", () => {
  test("first race gets sequence 1, second gets 2, and passed sequence is preserved if provided", async () => {
    const userId = await createUser("admin", "Admin User", "OP", "SITE_ADMIN");
    const token = await createSession(userId);
    const eventId = await createEvent(userId, "Auto Seq Event", "UNOFFICIAL");

    // Create first race (no sequence provided, should get 1)
    const race1 = await createRaceEvent({
      eventId,
      authorization: `Bearer ${token}`,
      name: "Kyoto Derby",
      distanceMeters: 1600,
      trackType: "Turf",
      location: "Kyoto",
    });
    expect(race1.sequence).toBe(1);

    // Create second race (no sequence provided, should get 2)
    const race2 = await createRaceEvent({
      eventId,
      authorization: `Bearer ${token}`,
      name: "Tokyo Classic",
      distanceMeters: 2400,
      trackType: "Dirt",
      location: "Tokyo",
    });
    expect(race2.sequence).toBe(2);

    // Create third race, with explicit sequence provided -> should preserve it for compatibility
    const race3 = await createRaceEvent({
      eventId,
      authorization: `Bearer ${token}`,
      name: "Sapporo Sprint",
      distanceMeters: 1200,
      trackType: "Turf",
      location: "Sapporo",
      sequence: 999,
    });
    expect(race3.sequence).toBe(999);
  });
});

describe("Race ordering PUT reorder endpoint", () => {
  test("success path: reorders races densely and is idempotent", async () => {
    const userId = await createUser("admin", "Admin User", "OP", "SITE_ADMIN");
    const token = await createSession(userId);
    const eventId = await createEvent(userId, "Reorder Event", "UNOFFICIAL");

    const r1 = await createRaceEvent({
      eventId,
      authorization: `Bearer ${token}`,
      name: "Race A",
      distanceMeters: 1200,
      trackType: "Turf",
      location: "Kyoto",
    });
    const r2 = await createRaceEvent({
      eventId,
      authorization: `Bearer ${token}`,
      name: "Race B",
      distanceMeters: 1200,
      trackType: "Turf",
      location: "Kyoto",
    });
    const r3 = await createRaceEvent({
      eventId,
      authorization: `Bearer ${token}`,
      name: "Race C",
      distanceMeters: 1200,
      trackType: "Turf",
      location: "Kyoto",
    });

    // Initial sequence: r1=1, r2=2, r3=3
    expect(r1.sequence).toBe(1);
    expect(r2.sequence).toBe(2);
    expect(r3.sequence).toBe(3);

    // Reorder: r3, r1, r2
    const reorderedResponse = await reorderRaceEvents({
      eventId,
      authorization: `Bearer ${token}`,
      orderedRaceIds: [r3.id, r1.id, r2.id],
    });

    const orderedRaces = reorderedResponse.races;
    expect(orderedRaces.length).toBe(3);

    // Check elements are in desired sequence 1..3
    expect(orderedRaces[0].id).toBe(r3.id);
    expect(orderedRaces[0].sequence).toBe(1);

    expect(orderedRaces[1].id).toBe(r1.id);
    expect(orderedRaces[1].sequence).toBe(2);

    expect(orderedRaces[2].id).toBe(r2.id);
    expect(orderedRaces[2].sequence).toBe(3);

    // Test Idempotency: reordering with the same list again shouldn't fail
    const idempotentResponse = await reorderRaceEvents({
      eventId,
      authorization: `Bearer ${token}`,
      orderedRaceIds: [r3.id, r1.id, r2.id],
    });
    expect(idempotentResponse.races[0].id).toBe(r3.id);
    expect(idempotentResponse.races[0].sequence).toBe(1);
    expect(idempotentResponse.races[1].id).toBe(r1.id);
    expect(idempotentResponse.races[2].id).toBe(r2.id);
  });

  test("validation errors are caught and thrown appropriately", async () => {
    const userId = await createUser("admin", "Admin User", "OP", "SITE_ADMIN");
    const token = await createSession(userId);
    const eventId = await createEvent(userId, "Validation Event", "UNOFFICIAL");

    const r1 = await createRaceEvent({
      eventId,
      authorization: `Bearer ${token}`,
      name: "Race 1",
      distanceMeters: 1200,
      trackType: "Turf",
      location: "Kyoto",
    });
    const r2 = await createRaceEvent({
      eventId,
      authorization: `Bearer ${token}`,
      name: "Race 2",
      distanceMeters: 1200,
      trackType: "Turf",
      location: "Kyoto",
    });

    // 1. Duplicate IDs in payload
    await expect(
      reorderRaceEvents({
        eventId,
        authorization: `Bearer ${token}`,
        orderedRaceIds: [r1.id, r1.id],
      })
    ).rejects.toThrow(/duplicate race IDs/);

    // 2. Mismatch count / partial payload
    await expect(
      reorderRaceEvents({
        eventId,
        authorization: `Bearer ${token}`,
        orderedRaceIds: [r1.id],
      })
    ).rejects.toThrow(/payload must contain exactly all/);

    // 3. Foreign race ID
    await expect(
      reorderRaceEvents({
        eventId,
        authorization: `Bearer ${token}`,
        orderedRaceIds: [r1.id, "foreign-race-id"],
      })
    ).rejects.toThrow(/does not belong to event/);
  });
});
