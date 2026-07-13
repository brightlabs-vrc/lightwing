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
import { createEvent, addEventMember } from "./events";
import { createRaceEvent, addRaceEventMember } from "./raceevents";
import { assignRaceResult, replaceRaceResults, mergeRaceResults } from "./results";

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

describe("granular results gating", () => {
  test("results assignment is gated by granularParticipation setting", async () => {
    // 1. Setup Organizer (Site Admin) and Participants
    const admin = await createUser("admin-user", "SITE_ADMIN");
    const adminToken = await createSession(admin.id);
    const authHeader = `Bearer ${adminToken}`;

    const participant1 = await createUser("participant-1");
    const participant2 = await createUser("participant-2");

    // 2. Create an event with granularParticipation = true
    const event = await createEvent({
      authorization: authHeader,
      name: "Granular Event",
      ownerType: "USER",
      scoringType: 1, // points-based
      granularParticipation: true,
    });
    createdEventIds.push(event.id);

    // 3. Create a race in the event
    const race = await createRaceEvent({
      authorization: authHeader,
      eventId: event.id,
      name: "Race 1",
      distanceMeters: 1000,
      trackType: "Dirt",
      location: "Tokyo",
    });

    // 4. Register both users as general event members
    await addEventMember({
      authorization: authHeader,
      id: event.id,
      userId: participant1.id,
    });
    await addEventMember({
      authorization: authHeader,
      id: event.id,
      userId: participant2.id,
    });

    // 5. Register ONLY participant1 as a race member
    await addRaceEventMember({
      authorization: authHeader,
      eventId: event.id,
      raceId: race.id,
      userId: participant1.id,
    });

    // 6. Attempting to assign a result to participant1 (race member) should succeed
    const r1 = await assignRaceResult({
      authorization: authHeader,
      eventId: event.id,
      raceId: race.id,
      userId: participant1.id,
      points: 10,
    });
    expect(r1.userId).toBe(participant1.id);
    expect(r1.points).toBe(10);

    // 7. Attempting to assign a result to participant2 (event member but NOT race member) should throw/fail
    await expect(
      assignRaceResult({
        authorization: authHeader,
        eventId: event.id,
        raceId: race.id,
        userId: participant2.id,
        points: 5,
      })
    ).rejects.toThrow();

    // 8. Attempting to bulk-replace results with participant2 included should fail
    await expect(
      replaceRaceResults({
        authorization: authHeader,
        eventId: event.id,
        raceId: race.id,
        results: [
          { userId: participant1.id, points: 12 },
          { userId: participant2.id, points: 8 },
        ],
      })
    ).rejects.toThrow();

    // 9. Attempting to merge results with participant2 included should fail
    await expect(
      mergeRaceResults({
        authorization: authHeader,
        eventId: event.id,
        raceId: race.id,
        results: [{ userId: participant2.id, points: 8 }],
      })
    ).rejects.toThrow();
  });

  test("non-granular events fall back to event membership check", async () => {
    const admin = await createUser("admin-user-2", "SITE_ADMIN");
    const adminToken = await createSession(admin.id);
    const authHeader = `Bearer ${adminToken}`;

    const participant1 = await createUser("participant-3");
    const participant2 = await createUser("participant-4");

    // Create an event with granularParticipation = false (default)
    const event = await createEvent({
      authorization: authHeader,
      name: "Non-Granular Event",
      ownerType: "USER",
      scoringType: 1, // points-based
      granularParticipation: false,
    });
    createdEventIds.push(event.id);

    const race = await createRaceEvent({
      authorization: authHeader,
      eventId: event.id,
      name: "Race 1",
      distanceMeters: 1000,
      trackType: "Dirt",
      location: "Tokyo",
    });

    // Add only participant1 as event member
    await addEventMember({
      authorization: authHeader,
      id: event.id,
      userId: participant1.id,
    });

    // Assigning to participant1 (event member) should succeed
    const r1 = await assignRaceResult({
      authorization: authHeader,
      eventId: event.id,
      raceId: race.id,
      userId: participant1.id,
      points: 10,
    });
    expect(r1.userId).toBe(participant1.id);

    // Assigning to participant2 (not event member) should fail
    await expect(
      assignRaceResult({
        authorization: authHeader,
        eventId: event.id,
        raceId: race.id,
        userId: participant2.id,
        points: 5,
      })
    ).rejects.toThrow();
  });
});
