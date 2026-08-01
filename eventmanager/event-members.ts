import { randomUUID } from "node:crypto";
import { api, APIError, Header } from "encore.dev/api";
import { prisma } from "./prisma";
import { requireEventPermission, resolveActor } from "../auth/rbac";
import { isEligible } from "./classtier";
import { loadEvent, ensureEventStandingsRow, type EventDetail } from "./events";
import { invalidateEventCaches } from "./cache-utils";

interface AddMemberParams {
  id: string;
  authorization: Header<"Authorization">;
  userId: string;
}

// Registers a participant for an event. Enforces the event's class restriction
// (issue #3) and seeds the scoring record for the event's scoring type.
export const addEventMember = api(
  { expose: true, auth: true, method: "POST", path: "/api/events/:id/members" },
  async ({ id, authorization, userId }: AddMemberParams): Promise<EventDetail> => {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      throw APIError.notFound("event not found");
    }
    await requireEventPermission(prisma, {
      authorization,
      eventId: id,
      action: "update",
    });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw APIError.notFound("user not found");
    }
    if (!isEligible(user.classTier, event.classRestriction)) {
      throw APIError.failedPrecondition(
        "participant class tier does not satisfy the event class restriction",
      );
    }

    await prisma.eventMember.upsert({
      where: { eventId_userId: { eventId: id, userId } },
      create: { id: randomUUID(), eventId: id, userId },
      update: {},
    });

    await ensureEventStandingsRow(prisma, id, userId, event.scoringType);

    await invalidateEventCaches(id);

    return loadEvent(id);
  },
);

export async function removeMemberFromEventInternal(eventId: string, userId: string): Promise<void> {
  // 1. Delete EventMember
  await prisma.eventMember.deleteMany({ where: { eventId, userId } });

  // 2. Delete EventPointsEntry
  await prisma.eventPointsEntry.deleteMany({ where: { eventId, userId } });

  // 3. Delete EventLadderEntry
  await prisma.eventLadderEntry.deleteMany({ where: { eventId, userId } });

  // 4. Delete RaceEventMember for races belonging to this event
  await prisma.raceEventMember.deleteMany({
    where: {
      userId,
      raceEvent: {
        eventId,
      },
    },
  });

  // 5. Delete RaceResult for races belonging to this event
  await prisma.raceResult.deleteMany({
    where: {
      userId,
      raceEvent: {
        eventId,
      },
    },
  });
}

interface RemoveMemberParams {
  id: string;
  userId: string;
  authorization: Header<"Authorization">;
}

// Removes a participant from an event.
export const removeEventMember = api(
  { expose: true, auth: true, method: "DELETE", path: "/api/events/:id/members/:userId" },
  async ({ id, userId, authorization }: RemoveMemberParams): Promise<EventDetail> => {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      throw APIError.notFound("event not found");
    }
    await requireEventPermission(prisma, {
      authorization,
      eventId: id,
      action: "update",
    });

    await removeMemberFromEventInternal(id, userId);
    await invalidateEventCaches(id);
    return loadEvent(id);
  },
);

interface JoinEventParams {
  id: string;
  authorization: Header<"Authorization">;
}

// Public self-signup endpoint: allows authenticated users to join events
// in UNOFFICIAL or OFFICIAL status. Does NOT require event permissions.
export const joinEvent = api(
  { expose: true, auth: true, method: "POST", path: "/api/events/:id/join" },
  async ({ id, authorization }: JoinEventParams): Promise<EventDetail> => {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      throw APIError.notFound("event not found");
    }

    // Only allow public signups for visible events
    if (event.status !== "UNOFFICIAL" && event.status !== "OFFICIAL") {
      throw APIError.failedPrecondition(
        "event is not open for public signup (must be UNOFFICIAL or OFFICIAL)",
      );
    }

    if (event.signupsLocked) {
      throw APIError.failedPrecondition(
        "signups are locked for this event",
      );
    }

    // Resolve the authenticated actor - self-service, no permission check
    const actor = await resolveActor(prisma, authorization);
    const userId = actor.userId;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw APIError.notFound("user not found");
    }
    if (!isEligible(user.classTier, event.classRestriction)) {
      throw APIError.failedPrecondition(
        "participant class tier does not satisfy the event class restriction",
      );
    }

    await prisma.eventMember.upsert({
      where: { eventId_userId: { eventId: id, userId } },
      create: { id: randomUUID(), eventId: id, userId },
      update: {},
    });

    await ensureEventStandingsRow(prisma, id, userId, event.scoringType);

    await invalidateEventCaches(id);

    return loadEvent(id);
  },
);

interface LeaveEventParams {
  id: string;
  authorization: Header<"Authorization">;
}

// Public self-exit endpoint: allows authenticated users to leave events they've joined.
// Does NOT require event permissions - users can withdraw from their own membership.
export const leaveEvent = api(
  { expose: true, auth: true, method: "DELETE", path: "/api/events/:id/join" },
  async ({ id, authorization }: LeaveEventParams): Promise<EventDetail> => {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      throw APIError.notFound("event not found");
    }

    if (event.signupsLocked) {
      throw APIError.failedPrecondition(
        "signups are locked for this event",
      );
    }

    // Resolve the authenticated actor - self-service, no permission check
    const actor = await resolveActor(prisma, authorization);
    const userId = actor.userId;

    await removeMemberFromEventInternal(id, userId);
    await invalidateEventCaches(id);
    return loadEvent(id);
  },
);

interface SetSignupsLockedParams {
  id: string;
  authorization: Header<"Authorization">;
  locked: boolean;
}

// Toggles the event's signup lock state. Gated by event-update permission.
export const setEventSignupsLocked = api(
  { expose: true, auth: true, method: "PUT", path: "/api/events/:id/signups-lock" },
  async ({ id, authorization, locked }: SetSignupsLockedParams): Promise<EventDetail> => {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      throw APIError.notFound("event not found");
    }
    await requireEventPermission(prisma, {
      authorization,
      eventId: id,
      action: "update",
    });

    await prisma.event.update({ where: { id }, data: { signupsLocked: locked } });
    await invalidateEventCaches(id);
    return loadEvent(id);
  },
);
