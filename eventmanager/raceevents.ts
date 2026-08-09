import { randomUUID } from "node:crypto";
import { api, APIError, Header } from "encore.dev/api";
import { prisma } from "./prisma";
import { requireEventPermission, resolveActor } from "../auth/rbac";
import { isEligible, type ClassTier } from "./classtier";
import { recomputeEventPointsInternal, eventDetailCache, ensureEventStandingsRow, publicEventsCache, PUBLIC_EVENTS_KEY } from "./events";
import { removeMemberFromEventInternal } from "./event-members";

export interface RaceEventMemberView {
  userId: string;
  name: string;
  classTier: ClassTier | null;
}

// A RaceEvent is a single race contained within an Event. The parent Event acts
// as the container/scoreboard; each RaceEvent carries its own distance, track
// type (free-text) and location. Authorization for every mutation is delegated
// to the parent event via requireEventPermission, so both organization-owned
// and user-owned events (and site admins) are handled uniformly.
import { parseOptionalPositiveInt, assertLimitCanBeReduced, ERROR_CODES } from "./participation-limits";

export interface RaceEventDetail {
  id: string;
  eventId: string;
  name: string;
  sequence: number;
  distanceMeters: number;
  trackType: string;
  location: string;
  scoringType: number | null;
  grade: string | null;
  classRestriction: ClassTier | null;
  startsAt: string | null;
  endsAt: string | null;
  participantLimit: number | null;
  createdAt: string;
  updatedAt: string;
  members: RaceEventMemberView[];
}

interface CreateRaceEventParams {
  eventId: string;
  authorization: Header<"Authorization">;
  name: string;
  sequence?: number;
  distanceMeters: number;
  trackType: string;
  location: string;
  scoringType?: number | null;
  grade?: string | null;
  classRestriction?: ClassTier | null;
  startsAt?: string | null;
  endsAt?: string | null;
  participantLimit?: number | null;
}

// Adds a race to an event. Gated by event-update permission on the parent event.
export const createRaceEvent = api(
  { expose: true, auth: true, method: "POST", path: "/api/events/:eventId/races" },
  async (params: CreateRaceEventParams): Promise<RaceEventDetail> => {
    await requireEventPermission(prisma, {
      authorization: params.authorization,
      eventId: params.eventId,
      action: "create",
    });

    const event = await prisma.event.findUnique({
      where: { id: params.eventId },
    });
    if (!event) {
      throw APIError.notFound("event not found");
    }

    const participantLimitParsed = parseOptionalPositiveInt(params.participantLimit, "participantLimit");

    if (participantLimitParsed !== undefined && participantLimitParsed !== null) {
      if (!event.granularParticipation) {
        throw APIError.invalidArgument("Race participant limit can only be configured for granular events");
      }
    }

    const maxRace = await prisma.raceEvent.findFirst({
      where: { eventId: params.eventId },
      orderBy: { sequence: "desc" },
      select: { sequence: true },
    });
    const nextSequence = maxRace ? maxRace.sequence + 1 : 1;

    const race = await prisma.raceEvent.create({
      data: {
        id: randomUUID(),
        eventId: params.eventId,
        name: params.name,
        sequence: params.sequence !== undefined ? params.sequence : nextSequence,
        distanceMeters: params.distanceMeters,
        trackType: params.trackType,
        location: params.location,
        scoringType: params.scoringType ?? null,
        grade: params.grade ?? null,
        classRestriction: params.classRestriction ?? null,
        startsAt: params.startsAt ? new Date(params.startsAt) : null,
        endsAt: params.endsAt ? new Date(params.endsAt) : null,
        participantLimit: participantLimitParsed ?? null,
      },
    });

    await eventDetailCache.delete({ id: params.eventId });
    await publicEventsCache.delete({ key: PUBLIC_EVENTS_KEY });

    return toRaceEventDetail(race);
  },
);

interface ReorderRaceEventsParams {
  eventId: string;
  authorization: Header<"Authorization">;
  orderedRaceIds: string[];
}

// Reorders the races within an event, validating permissions and full coverage.
export const reorderRaceEvents = api(
  { expose: true, auth: true, method: "PUT", path: "/api/events/:eventId/races/reorder" },
  async (params: ReorderRaceEventsParams): Promise<{ races: RaceEventDetail[] }> => {
    await requireEventPermission(prisma, {
      authorization: params.authorization,
      eventId: params.eventId,
      action: "update",
    });

    const existingRaces = await prisma.raceEvent.findMany({
      where: { eventId: params.eventId },
      orderBy: { sequence: "asc" },
    });

    const existingIdsSet = new Set(existingRaces.map((r) => r.id));
    const inputIdsSet = new Set(params.orderedRaceIds);

    // Validate duplicates
    if (params.orderedRaceIds.length !== inputIdsSet.size) {
      throw APIError.invalidArgument("duplicate race IDs are not allowed in the payload");
    }

    // Validate size and coverage
    if (params.orderedRaceIds.length !== existingRaces.length) {
      throw APIError.invalidArgument(
        `payload must contain exactly all ${existingRaces.length} race IDs associated with this event`
      );
    }

    // Validate all IDs belong to this event
    for (const id of params.orderedRaceIds) {
      if (!existingIdsSet.has(id)) {
        throw APIError.invalidArgument(`race ID "${id}" does not belong to event "${params.eventId}"`);
      }
    }

    // Check if reordering is already in the desired state (idempotency)
    let needsUpdate = false;
    for (let i = 0; i < existingRaces.length; i++) {
      if (existingRaces[i].id !== params.orderedRaceIds[i] || existingRaces[i].sequence !== i + 1) {
        needsUpdate = true;
        break;
      }
    }

    if (needsUpdate) {
      await prisma.$transaction(async (tx) => {
        for (let i = 0; i < params.orderedRaceIds.length; i++) {
          await tx.raceEvent.update({
            where: { id: params.orderedRaceIds[i] },
            data: { sequence: i + 1 },
          });
        }
      });
    }

    // Fetch and return the updated race list
    const updatedRaces = await prisma.raceEvent.findMany({
      where: { eventId: params.eventId },
      include: {
        raceMembers: {
          include: {
            user: {
              select: {
                name: true,
                vrchatUsername: true,
                classTier: true,
              },
            },
          },
        },
      },
      orderBy: { sequence: "asc" },
    });

    await eventDetailCache.delete({ id: params.eventId });
    await publicEventsCache.delete({ key: PUBLIC_EVENTS_KEY });

    return { races: updatedRaces.map(toRaceEventDetail) };
  },
);

interface ListRaceEventsParams {
  eventId: string;
}

// Lists the races within an event, ordered by their sequence.
export const listRaceEvents = api(
  { expose: true, method: "GET", path: "/api/events/:eventId/races" },
  async ({ eventId }: ListRaceEventsParams): Promise<{ races: RaceEventDetail[] }> => {
    const races = await prisma.raceEvent.findMany({
      where: { eventId },
      include: {
        raceMembers: {
          include: {
            user: {
              select: {
                name: true,
                vrchatUsername: true,
                classTier: true,
              },
            },
          },
        },
      },
      orderBy: { sequence: "asc" },
    });
    return { races: races.map(toRaceEventDetail) };
  },
);

interface RaceEventIdParams {
  eventId: string;
  raceId: string;
}

// Returns a single race within an event.
export const getRaceEvent = api(
  { expose: true, method: "GET", path: "/api/events/:eventId/races/:raceId" },
  async ({ eventId, raceId }: RaceEventIdParams): Promise<RaceEventDetail> => {
    const race = await requireRaceEvent(eventId, raceId);
    return toRaceEventDetail(race);
  },
);

interface UpdateRaceEventParams {
  eventId: string;
  raceId: string;
  authorization: Header<"Authorization">;
  name?: string;
  sequence?: number;
  distanceMeters?: number;
  trackType?: string;
  location?: string;
  scoringType?: number | null;
  grade?: string | null;
  classRestriction?: ClassTier | null;
  startsAt?: string | null;
  endsAt?: string | null;
  participantLimit?: number | null;
}

// Updates a race's editable fields. Gated by event-update permission.
export const updateRaceEvent = api(
  { expose: true, auth: true, method: "PATCH", path: "/api/events/:eventId/races/:raceId" },
  async (params: UpdateRaceEventParams): Promise<RaceEventDetail> => {
    const existing = await requireRaceEvent(params.eventId, params.raceId);
    const event = await prisma.event.findUnique({
      where: { id: params.eventId },
    });
    if (!event) {
      throw APIError.notFound("event not found");
    }

    await requireEventPermission(prisma, {
      authorization: params.authorization,
      eventId: params.eventId,
      action: "update",
    });

    const participantLimitParsed = parseOptionalPositiveInt(params.participantLimit, "participantLimit");

    if (participantLimitParsed !== undefined && participantLimitParsed !== null) {
      if (!event.granularParticipation) {
        throw APIError.invalidArgument("Race participant limit can only be configured for granular events");
      }
    }

    if (participantLimitParsed !== undefined && participantLimitParsed !== null) {
      const currentCount = await prisma.raceEventMember.count({
        where: { raceEventId: params.raceId },
      });
      assertLimitCanBeReduced(
        currentCount,
        participantLimitParsed,
        ERROR_CODES.PARTICIPANT_LIMIT_BELOW_CURRENT_ENROLLMENT,
        "Participant limit cannot be lower than the current enrollment"
      );
    }

    let triggerRecomputation = false;
    if (params.grade !== undefined && params.grade !== existing.grade) {
      triggerRecomputation = true;
    }

    await prisma.raceEvent.update({
      where: { id: params.raceId },
      data: {
        name: params.name ?? undefined,
        sequence: params.sequence ?? undefined,
        distanceMeters: params.distanceMeters ?? undefined,
        trackType: params.trackType ?? undefined,
        location: params.location ?? undefined,
        scoringType: params.scoringType === undefined ? undefined : params.scoringType,
        grade: params.grade === undefined ? undefined : params.grade,
        classRestriction:
          params.classRestriction === undefined ? undefined : params.classRestriction,
        startsAt:
          params.startsAt === undefined
            ? undefined
            : params.startsAt
              ? new Date(params.startsAt)
              : null,
        endsAt:
          params.endsAt === undefined
            ? undefined
            : params.endsAt
              ? new Date(params.endsAt)
              : null,
        participantLimit: participantLimitParsed,
      },
    });

    if (triggerRecomputation) {
      await recomputeEventPointsInternal(params.eventId);
    }

    await eventDetailCache.delete({ id: params.eventId });
    await publicEventsCache.delete({ key: PUBLIC_EVENTS_KEY });

    const updated = await requireRaceEvent(params.eventId, params.raceId);
    return toRaceEventDetail(updated);
  },
);

interface DeleteRaceEventParams {
  eventId: string;
  raceId: string;
  authorization: Header<"Authorization">;
}

// Deletes a race and its results (cascade). Gated by event-delete permission.
export const deleteRaceEvent = api(
  { expose: true, auth: true, method: "DELETE", path: "/api/events/:eventId/races/:raceId" },
  async ({ eventId, raceId, authorization }: DeleteRaceEventParams): Promise<{ deleted: boolean }> => {
    await requireRaceEvent(eventId, raceId);
    await requireEventPermission(prisma, {
      authorization,
      eventId,
      action: "delete",
    });

    await prisma.raceEvent.delete({ where: { id: raceId } });
    await eventDetailCache.delete({ id: eventId });
    await publicEventsCache.delete({ key: PUBLIC_EVENTS_KEY });
    return { deleted: true };
  },
);

async function requireRaceEvent(eventId: string, raceId: string) {
  const race = await prisma.raceEvent.findUnique({
    where: { id: raceId },
    include: {
      raceMembers: {
        include: {
          user: {
            select: {
              name: true,
              vrchatUsername: true,
              classTier: true,
            },
          },
        },
      },
    },
  });
  if (!race || race.eventId !== eventId) {
    throw APIError.notFound("race not found");
  }
  return race;
}

type RaceEventRow = {
  id: string;
  eventId: string;
  name: string;
  sequence: number;
  distanceMeters: number;
  trackType: string;
  location: string;
  scoringType: number | null;
  grade: string | null;
  classRestriction: ClassTier | null;
  startsAt: Date | null;
  endsAt: Date | null;
  participantLimit: number | null;
  createdAt: Date;
  updatedAt: Date;
  raceMembers?: {
    userId: string;
    user: {
      name: string;
      vrchatUsername: string | null;
      classTier: ClassTier | null;
    };
  }[];
};

function toRaceEventDetail(race: RaceEventRow): RaceEventDetail {
  return {
    id: race.id,
    eventId: race.eventId,
    name: race.name,
    sequence: race.sequence,
    distanceMeters: race.distanceMeters,
    trackType: race.trackType,
    location: race.location,
    scoringType: race.scoringType,
    grade: race.grade,
    classRestriction: race.classRestriction,
    startsAt: race.startsAt ? race.startsAt.toISOString() : null,
    endsAt: race.endsAt ? race.endsAt.toISOString() : null,
    participantLimit: race.participantLimit,
    createdAt: race.createdAt.toISOString(),
    updatedAt: race.updatedAt.toISOString(),
    members: race.raceMembers
      ? race.raceMembers.map((rm) => ({
          userId: rm.userId,
          name: rm.user.vrchatUsername ?? rm.user.name,
          classTier: rm.user.classTier,
        }))
      : [],
  };
}

interface AddRaceMemberParams {
  eventId: string;
  raceId: string;
  authorization: Header<"Authorization">;
  userId: string;
}

// Registers a participant for a specific race.
export const addRaceEventMember = api(
  { expose: true, auth: true, method: "POST", path: "/api/events/:eventId/races/:raceId/members" },
  async ({ eventId, raceId, authorization, userId }: AddRaceMemberParams): Promise<RaceEventDetail> => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw APIError.notFound("user not found");
    }

    await prisma.$transaction(async (tx) => {
      const event = await tx.event.findUnique({ where: { id: eventId } });
      if (!event) {
        throw APIError.notFound("event not found");
      }

      await requireEventPermission(tx, {
        authorization,
        eventId,
        action: "update",
      });

      const race = await tx.raceEvent.findUnique({ where: { id: raceId } });
      if (!race || race.eventId !== eventId) {
        throw APIError.notFound("race not found");
      }

      // User must be an event member first
      const member = await tx.eventMember.findUnique({
        where: { eventId_userId: { eventId, userId } },
      });
      if (!member) {
        throw APIError.failedPrecondition("user is not a member of this event");
      }

      // Enforce the race's class restriction (fall back to event restriction)
      const targetRestriction = race.classRestriction ?? event.classRestriction;
      if (!isEligible(user.classTier, targetRestriction)) {
        throw APIError.failedPrecondition(
          "participant class tier does not satisfy the race class restriction",
        );
      }

      const existingRaceMember = await tx.raceEventMember.findUnique({
        where: { raceEventId_userId: { raceEventId: raceId, userId } },
      });

      if (!existingRaceMember) {
        // Enforce race limit
        if (race.participantLimit !== null) {
          const currentCount = await tx.raceEventMember.count({
            where: { raceEventId: raceId },
          });
          if (currentCount >= race.participantLimit) {
            throw new APIError("failed_precondition", "Race participant capacity has been reached", {
              code: ERROR_CODES.RACE_PARTICIPANT_LIMIT_REACHED,
              limit: race.participantLimit,
              currentCount,
            });
          }
        }

        // Enforce maxConcurrentRaceParticipations limit
        if (event.maxConcurrentRaceParticipations !== null) {
          const currentJoinedCount = await tx.raceEventMember.count({
            where: {
              userId,
              raceEvent: { eventId },
            },
          });
          if (currentJoinedCount >= event.maxConcurrentRaceParticipations) {
            throw new APIError("failed_precondition", "User maximum race enrollment count reached", {
              code: ERROR_CODES.GRANULAR_USER_RACE_LIMIT_REACHED,
              limit: event.maxConcurrentRaceParticipations,
              currentCount: currentJoinedCount,
            });
          }
        }

        await tx.raceEventMember.create({
          data: { id: randomUUID(), raceEventId: raceId, userId },
        });
      }

      await ensureEventStandingsRow(tx, eventId, userId, event.scoringType);
    });

    await eventDetailCache.delete({ id: eventId });
    await publicEventsCache.delete({ key: PUBLIC_EVENTS_KEY });

    const updatedRace = await requireRaceEvent(eventId, raceId);
    return toRaceEventDetail(updatedRace);
  }
);

interface RemoveRaceMemberParams {
  eventId: string;
  raceId: string;
  userId: string;
  authorization: Header<"Authorization">;
}

// Removes a participant from a specific race.
export const removeRaceEventMember = api(
  { expose: true, auth: true, method: "DELETE", path: "/api/events/:eventId/races/:raceId/members/:userId" },
  async ({ eventId, raceId, userId, authorization }: RemoveRaceMemberParams): Promise<RaceEventDetail> => {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw APIError.notFound("event not found");
    }

    await requireEventPermission(prisma, {
      authorization,
      eventId,
      action: "update",
    });

    await requireRaceEvent(eventId, raceId);

    // User must be an event member first
    const member = await prisma.eventMember.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (!member) {
      throw APIError.failedPrecondition("user is not a member of this event");
    }

    await prisma.raceEventMember.deleteMany({
      where: { raceEventId: raceId, userId },
    });

    if (event.granularParticipation) {
      const activeRaceCount = await prisma.raceEventMember.count({
        where: {
          userId,
          raceEvent: {
            eventId,
          },
        },
      });
      if (activeRaceCount === 0) {
        await removeMemberFromEventInternal(eventId, userId);
      }
    }

    await eventDetailCache.delete({ id: eventId });
    await publicEventsCache.delete({ key: PUBLIC_EVENTS_KEY });

    const updatedRace = await requireRaceEvent(eventId, raceId);
    return toRaceEventDetail(updatedRace);
  }
);

interface ListRaceMembersParams {
  eventId: string;
  raceId: string;
}

// Lists the registered participants for a specific race.
export const listRaceEventMembers = api(
  { expose: true, method: "GET", path: "/api/events/:eventId/races/:raceId/members" },
  async ({ eventId, raceId }: ListRaceMembersParams): Promise<{ members: RaceEventMemberView[] }> => {
    await requireRaceEvent(eventId, raceId);

    const members = await prisma.raceEventMember.findMany({
      where: { raceEventId: raceId },
      include: {
        user: {
          select: {
            name: true,
            vrchatUsername: true,
            classTier: true,
          },
        },
      },
    });

    return {
      members: members.map((m) => ({
        userId: m.userId,
        name: m.user.vrchatUsername ?? m.user.name,
        classTier: m.user.classTier,
      })),
    };
  }
);

interface JoinRaceEventParams {
  eventId: string;
  raceId: string;
  authorization: Header<"Authorization">;
}

// Self-service endpoint to join a race event.
export const joinRaceEvent = api(
  { expose: true, auth: true, method: "POST", path: "/api/events/:eventId/races/:raceId/join" },
  async ({ eventId, raceId, authorization }: JoinRaceEventParams): Promise<RaceEventDetail> => {
    // Resolve actor
    const actor = await resolveActor(prisma, authorization);
    const userId = actor.userId;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw APIError.notFound("user not found");
    }

    await prisma.$transaction(async (tx) => {
      const event = await tx.event.findUnique({ where: { id: eventId } });
      if (!event) {
        throw APIError.notFound("event not found");
      }

      if (event.signupsLocked) {
        throw APIError.failedPrecondition("signups are locked for this event");
      }

      const race = await tx.raceEvent.findUnique({ where: { id: raceId } });
      if (!race || race.eventId !== eventId) {
        throw APIError.notFound("race not found");
      }

      // Check if user is an event member
      const member = await tx.eventMember.findUnique({
        where: { eventId_userId: { eventId, userId } },
      });

      // If user is not an event member and event does not allow granular participation, throw error
      if (!member && !event.granularParticipation) {
        throw APIError.failedPrecondition("user is not a member of this event");
      }

      // Enforce class restriction
      const targetRestriction = race.classRestriction ?? event.classRestriction;
      if (!isEligible(user.classTier, targetRestriction)) {
        throw APIError.failedPrecondition(
          "participant class tier does not satisfy the race class restriction",
        );
      }

      const existingRaceMember = await tx.raceEventMember.findUnique({
        where: { raceEventId_userId: { raceEventId: raceId, userId } },
      });

      if (!existingRaceMember) {
        // Enforce race limit
        if (race.participantLimit !== null) {
          const currentCount = await tx.raceEventMember.count({
            where: { raceEventId: raceId },
          });
          if (currentCount >= race.participantLimit) {
            throw new APIError("failed_precondition", "Race participant capacity has been reached", {
              code: ERROR_CODES.RACE_PARTICIPANT_LIMIT_REACHED,
              limit: race.participantLimit,
              currentCount,
            });
          }
        }

        // Enforce maxConcurrentRaceParticipations limit
        if (event.maxConcurrentRaceParticipations !== null) {
          const currentJoinedCount = await tx.raceEventMember.count({
            where: {
              userId,
              raceEvent: { eventId },
            },
          });
          if (currentJoinedCount >= event.maxConcurrentRaceParticipations) {
            throw new APIError("failed_precondition", "User maximum race enrollment count reached", {
              code: ERROR_CODES.GRANULAR_USER_RACE_LIMIT_REACHED,
              limit: event.maxConcurrentRaceParticipations,
              currentCount: currentJoinedCount,
            });
          }
        }

        if (!member && event.granularParticipation) {
          // If we auto-join event, we also need to respect event participantLimit?
          // Actually, the objective says:
          // participant capacity:
          //   - regular events: one capacity for the entire event;
          //   - granular events: a separate capacity for each race.
          // Wait, does event.participantLimit apply for granular events? No, we validate that
          // granular events cannot have event-level participantLimit. So we can just join cleanly.
          await tx.eventMember.create({
            data: { id: randomUUID(), eventId, userId },
          });
        }

        await tx.raceEventMember.create({
          data: { id: randomUUID(), raceEventId: raceId, userId },
        });
      }

      await ensureEventStandingsRow(tx, eventId, userId, event.scoringType);
    });

    await eventDetailCache.delete({ id: eventId });
    await publicEventsCache.delete({ key: PUBLIC_EVENTS_KEY });

    const updatedRace = await requireRaceEvent(eventId, raceId);
    return toRaceEventDetail(updatedRace);
  }
);

interface LeaveRaceEventParams {
  eventId: string;
  raceId: string;
  authorization: Header<"Authorization">;
}

// Self-service endpoint to leave a race event.
export const leaveRaceEvent = api(
  { expose: true, auth: true, method: "DELETE", path: "/api/events/:eventId/races/:raceId/join" },
  async ({ eventId, raceId, authorization }: LeaveRaceEventParams): Promise<RaceEventDetail> => {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw APIError.notFound("event not found");
    }

    if (event.signupsLocked) {
      throw APIError.failedPrecondition("signups are locked for this event");
    }

    await requireRaceEvent(eventId, raceId);

    // Resolve actor
    const actor = await resolveActor(prisma, authorization);
    const userId = actor.userId;

    // User must be an event member first
    const member = await prisma.eventMember.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (!member) {
      throw APIError.failedPrecondition("user is not a member of this event");
    }

    await prisma.raceEventMember.deleteMany({
      where: { raceEventId: raceId, userId },
    });

    if (event.granularParticipation) {
      const activeRaceCount = await prisma.raceEventMember.count({
        where: {
          userId,
          raceEvent: {
            eventId,
          },
        },
      });
      if (activeRaceCount === 0) {
        await removeMemberFromEventInternal(eventId, userId);
      }
    }

    await eventDetailCache.delete({ id: eventId });
    await publicEventsCache.delete({ key: PUBLIC_EVENTS_KEY });

    const updatedRace = await requireRaceEvent(eventId, raceId);
    return toRaceEventDetail(updatedRace);
  }
);
