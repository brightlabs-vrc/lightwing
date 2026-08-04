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
import { createEvent } from "./events";
import { createRaceEvent } from "./raceevents";
import { listEligibleEvents } from "./classes";

const createdUserIds: string[] = [];
const createdEventIds: string[] = [];
const createdSessionTokens: string[] = [];

async function createUser(id: string, siteRole: "USER" | "SITE_ADMIN" = "USER", classTier: "PRE_OP" | "OP" | "G3" | "G2" | "G1" | null = null) {
  const user = await prisma.user.create({
    data: {
      id,
      name: `User ${id}`,
      email: `${id}@example.com`,
      siteRole,
      classTier,
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

  // Delete event-related tables first to prevent foreign key violations
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

describe("per-race eligibility discovery", () => {
  test("user is eligible for event and its races with fallback checks", async () => {
    // 1. Setup Organizer (Site Admin) and Participant (OP tier)
    const admin = await createUser("admin-user-elig", "SITE_ADMIN");
    const adminToken = await createSession(admin.id);
    const authHeader = `Bearer ${adminToken}`;

    const user = await createUser("eligible-user", "USER", "OP");

    // 2. Create Event 1 (classRestriction = OP) -> User qualifies for event
    const event1 = await createEvent({
      authorization: authHeader,
      name: "Event OP",
      ownerType: "USER",
      scoringType: 1,
      classRestriction: "OP",
    });
    createdEventIds.push(event1.id);

    // Race 1a has sequence 2, classRestriction = OP (qualifies)
    const race1a = await createRaceEvent({
      authorization: authHeader,
      eventId: event1.id,
      name: "Race Seq 2 OP",
      sequence: 2,
      distanceMeters: 1000,
      trackType: "Turf",
      location: "Tokyo",
      classRestriction: "OP",
    });

    // Race 1b has sequence 1, classRestriction = G1 (does not qualify)
    const race1b = await createRaceEvent({
      authorization: authHeader,
      eventId: event1.id,
      name: "Race Seq 1 G1",
      sequence: 1,
      distanceMeters: 1000,
      trackType: "Turf",
      location: "Tokyo",
      classRestriction: "G1",
    });

    // Race 1c has sequence 3, classRestriction = null (falls back to event restriction = OP -> qualifies)
    const race1c = await createRaceEvent({
      authorization: authHeader,
      eventId: event1.id,
      name: "Race Seq 3 Null",
      sequence: 3,
      distanceMeters: 1000,
      trackType: "Turf",
      location: "Tokyo",
      classRestriction: null,
    });

    // 3. Create Event 2 (classRestriction = G1) -> User does NOT qualify at event level
    const event2 = await createEvent({
      authorization: authHeader,
      name: "Event G1",
      ownerType: "USER",
      scoringType: 1,
      classRestriction: "G1",
    });
    createdEventIds.push(event2.id);

    // Race 2a has classRestriction = OP (User qualifies, even though event is G1!)
    const race2a = await createRaceEvent({
      authorization: authHeader,
      eventId: event2.id,
      name: "Race G1-OP",
      sequence: 1,
      distanceMeters: 1000,
      trackType: "Turf",
      location: "Tokyo",
      classRestriction: "OP",
    });

    // Race 2b has classRestriction = null (falls back to G1 -> User does not qualify)
    const race2b = await createRaceEvent({
      authorization: authHeader,
      eventId: event2.id,
      name: "Race G1-Null",
      sequence: 2,
      distanceMeters: 1000,
      trackType: "Turf",
      location: "Tokyo",
      classRestriction: null,
    });

    // 4. Create Event 3 (classRestriction = G2) with no races -> User does NOT qualify at all
    const event3 = await createEvent({
      authorization: authHeader,
      name: "Event G2-NoQual",
      ownerType: "USER",
      scoringType: 1,
      classRestriction: "G2",
    });
    createdEventIds.push(event3.id);

    // Call the eligibility discovery API
    const response = await listEligibleEvents({ userId: user.id });

    // We expect Event 1 and Event 2 to be returned, but Event 3 is excluded.
    const returnedEventIds = response.events.map((e) => e.id);
    expect(returnedEventIds).toContain(event1.id);
    expect(returnedEventIds).toContain(event2.id);
    expect(returnedEventIds).not.toContain(event3.id);

    // Verify Event 1 eligibleRaces details
    const returnedEvent1 = response.events.find((e) => e.id === event1.id)!;
    expect(returnedEvent1.eligibleRaces).toHaveLength(2);
    // Should be sorted by sequence (race1a with seq 2, race1c with seq 3)
    expect(returnedEvent1.eligibleRaces[0].id).toBe(race1a.id);
    expect(returnedEvent1.eligibleRaces[0].sequence).toBe(2);
    expect(returnedEvent1.eligibleRaces[0].classRestriction).toBe("OP");
    expect(returnedEvent1.eligibleRaces[1].id).toBe(race1c.id);
    expect(returnedEvent1.eligibleRaces[1].sequence).toBe(3);
    expect(returnedEvent1.eligibleRaces[1].classRestriction).toBe("OP"); // Fell back to OP!

    // Verify Event 2 eligibleRaces details
    const returnedEvent2 = response.events.find((e) => e.id === event2.id)!;
    expect(returnedEvent2.eligibleRaces).toHaveLength(1);
    expect(returnedEvent2.eligibleRaces[0].id).toBe(race2a.id);
    expect(returnedEvent2.eligibleRaces[0].classRestriction).toBe("OP");
  });
});
