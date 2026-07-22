import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, test } from "vitest";
import { prisma } from "./prisma";
import { joinEvent, leaveEvent, getEvent, addEventMember, removeEventMember } from "./events";
import { joinRaceEvent, leaveRaceEvent, addRaceEventMember, removeRaceEventMember } from "./raceevents";
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

async function createEvent(ownerUserId: string, name: string, status: "DRAFT" | "UNOFFICIAL" | "OFFICIAL" | "CONCLUDED", classRestriction: ClassTier | null = null) {
  const id = `event-${randomUUID()}`;
  await prisma.event.create({
    data: {
      id,
      name,
      ownerType: "USER",
      ownerUserId,
      status,
      scoringType: 1,
      classRestriction,
    },
  });
  createdEventIds.push(id);
  return id;
}

async function createRaceEvent(eventId: string, name: string) {
  const id = `race-${randomUUID()}`;
  await prisma.raceEvent.create({
    data: {
      id,
      eventId,
      name,
      distanceMeters: 1200,
      trackType: "Turf",
      location: "Kyoto",
    },
  });
  return id;
}

afterEach(async () => {
  // Delete event members for our events first to satisfy foreign key constraints
  if (createdEventIds.length > 0) {
    await prisma.eventMember.deleteMany({ where: { eventId: { in: createdEventIds } } });
    await prisma.eventPointsEntry.deleteMany({ where: { eventId: { in: createdEventIds } } });
    await prisma.eventLadderEntry.deleteMany({ where: { eventId: { in: createdEventIds } } });
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

describe("joinEvent and leaveEvent public endpoints", () => {
  test("user can join and leave an unofficial event successfully", async () => {
    const userId = await createUser("participant", "Participant User", "OP");
    const token = await createSession(userId);
    const eventId = await createEvent(userId, "Summer Open", "UNOFFICIAL", "OP");

    // Join the event
    const joined = await joinEvent({
      id: eventId,
      authorization: `Bearer ${token}`,
    });

    expect(joined.id).toBe(eventId);
    expect(joined.members.length).toBe(1);
    expect(joined.members[0].userId).toBe(userId);
    expect(joined.members[0].name).toBe("Participant User");

    // Verify membership is persisted and can be loaded
    const loaded = await getEvent({ id: eventId });
    expect(loaded.members.length).toBe(1);

    // Leave the event
    const left = await leaveEvent({
      id: eventId,
      authorization: `Bearer ${token}`,
    });

    expect(left.members.length).toBe(0);

    const loadedAfterLeave = await getEvent({ id: eventId });
    expect(loadedAfterLeave.members.length).toBe(0);
  });

  test("reject signup on DRAFT or CONCLUDED events", async () => {
    const userId = await createUser("participant", "Participant User", "G3");
    const token = await createSession(userId);

    const draftEventId = await createEvent(userId, "Draft Cup", "DRAFT", "G3");
    const concludedEventId = await createEvent(userId, "Concluded Cup", "CONCLUDED", "G3");

    await expect(
      joinEvent({
        id: draftEventId,
        authorization: `Bearer ${token}`,
      })
    ).rejects.toThrow(/event is not open for public signup/);

    await expect(
      joinEvent({
        id: concludedEventId,
        authorization: `Bearer ${token}`,
      })
    ).rejects.toThrow(/event is not open for public signup/);
  });

  test("reject signup if user does not satisfy class tier restriction", async () => {
    const creatorId = await createUser("creator", "Creator User");
    const userId = await createUser("participant-low", "Low Tier Participant", "G3");
    const token = await createSession(userId);
    const eventId = await createEvent(creatorId, "Elite OP Championship", "OFFICIAL", "OP");

    await expect(
      joinEvent({
        id: eventId,
        authorization: `Bearer ${token}`,
      })
    ).rejects.toThrow(/participant class tier does not satisfy the event class restriction/);
  });
});

describe("signupsLocked enforcement", () => {
  test("self-service join/leave event are rejected when signupsLocked is true", async () => {
    const creatorId = await createUser("creator", "Creator User");
    const userId = await createUser("participant", "Participant User", "OP");
    const token = await createSession(userId);
    const eventId = await createEvent(creatorId, "Summer Open", "UNOFFICIAL", "OP");

    // Lock signups
    await prisma.event.update({
      where: { id: eventId },
      data: { signupsLocked: true },
    });

    // Try to join self-service -> should fail
    await expect(
      joinEvent({
        id: eventId,
        authorization: `Bearer ${token}`,
      })
    ).rejects.toThrow(/signups are locked/);

    // Join via admin bypass (addEventMember) first to test leave
    const adminToken = await createSession(creatorId);
    await addEventMember({
      id: eventId,
      userId,
      authorization: `Bearer ${adminToken}`,
    });

    // Try to leave self-service -> should fail
    await expect(
      leaveEvent({
        id: eventId,
        authorization: `Bearer ${token}`,
      })
    ).rejects.toThrow(/signups are locked/);
  });

  test("admin member mutations still succeed when signupsLocked is true", async () => {
    const creatorId = await createUser("creator", "Creator User", null, "SITE_ADMIN");
    const userId = await createUser("participant", "Participant User", "OP");
    const adminToken = await createSession(creatorId);
    const eventId = await createEvent(creatorId, "Summer Open", "UNOFFICIAL", "OP");

    // Lock signups
    await prisma.event.update({
      where: { id: eventId },
      data: { signupsLocked: true },
    });

    // Admin adds member -> should succeed
    const added = await addEventMember({
      id: eventId,
      userId,
      authorization: `Bearer ${adminToken}`,
    });
    expect(added.members.length).toBe(1);

    // Admin removes member -> should succeed
    const removed = await removeEventMember({
      id: eventId,
      userId,
      authorization: `Bearer ${adminToken}`,
    });
    expect(removed.members.length).toBe(0);
  });

  test("self-service race join/leave are rejected when signupsLocked is true", async () => {
    const creatorId = await createUser("creator", "Creator User");
    const userId = await createUser("participant", "Participant User", "OP");
    const token = await createSession(userId);
    const adminToken = await createSession(creatorId);
    const eventId = await createEvent(creatorId, "Summer Open", "UNOFFICIAL", "OP");
    const raceId = await createRaceEvent(eventId, "Race 1");

    // Make user an event member first
    await addEventMember({
      id: eventId,
      userId,
      authorization: `Bearer ${adminToken}`,
    });

    // Lock signups
    await prisma.event.update({
      where: { id: eventId },
      data: { signupsLocked: true },
    });

    // Try to join race self-service -> should fail
    await expect(
      joinRaceEvent({
        eventId,
        raceId,
        authorization: `Bearer ${token}`,
      })
    ).rejects.toThrow(/signups are locked/);

    // Join race via admin bypass (addRaceEventMember) first to test leave
    await addRaceEventMember({
      eventId,
      raceId,
      userId,
      authorization: `Bearer ${adminToken}`,
    });

    // Try to leave race self-service -> should fail
    await expect(
      leaveRaceEvent({
        eventId,
        raceId,
        authorization: `Bearer ${token}`,
      })
    ).rejects.toThrow(/signups are locked/);
  });

  test("admin race-member mutations still succeed when signupsLocked is true", async () => {
    const creatorId = await createUser("creator", "Creator User");
    const userId = await createUser("participant", "Participant User", "OP");
    const adminToken = await createSession(creatorId);
    const eventId = await createEvent(creatorId, "Summer Open", "UNOFFICIAL", "OP");
    const raceId = await createRaceEvent(eventId, "Race 1");

    // Make user an event member first
    await addEventMember({
      id: eventId,
      userId,
      authorization: `Bearer ${adminToken}`,
    });

    // Lock signups
    await prisma.event.update({
      where: { id: eventId },
      data: { signupsLocked: true },
    });

    // Admin adds race member -> should succeed
    const added = await addRaceEventMember({
      eventId,
      raceId,
      userId,
      authorization: `Bearer ${adminToken}`,
    });
    expect(added.members.length).toBe(1);

    // Admin removes race member -> should succeed
    const removed = await removeRaceEventMember({
      eventId,
      raceId,
      userId,
      authorization: `Bearer ${adminToken}`,
    });
    expect(removed.members.length).toBe(0);
  });
});
