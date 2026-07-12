import { randomUUID } from "node:crypto";
import { api, APIError, Header } from "encore.dev/api";
import { prisma } from "./prisma";
import { requireEventPermission } from "../auth/rbac";
import { isEligible, type ClassTier } from "./classtier";

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
export interface RaceEventDetail {
  id: string;
  eventId: string;
  name: string;
  sequence: number;
  distanceMeters: number;
  trackType: string;
  location: string;
  scoringType: number | null;
  classRestriction: ClassTier | null;
  startsAt: string | null;
  endsAt: string | null;
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
  classRestriction?: ClassTier | null;
  startsAt?: string | null;
  endsAt?: string | null;
}

// Adds a race to an event. Gated by event-update permission on the parent event.
export const createRaceEvent = api(
  { expose: true, auth: true, method: "POST", path: "/events/:eventId/races" },
  async (params: CreateRaceEventParams): Promise<RaceEventDetail> => {
    await requireEventPermission(prisma, {
      authorization: params.authorization,
      eventId: params.eventId,
      action: "create",
    });

    const race = await prisma.raceEvent.create({
      data: {
        id: randomUUID(),
        eventId: params.eventId,
        name: params.name,
        sequence: params.sequence ?? 0,
        distanceMeters: params.distanceMeters,
        trackType: params.trackType,
        location: params.location,
        scoringType: params.scoringType ?? null,
        classRestriction: params.classRestriction ?? null,
        startsAt: params.startsAt ? new Date(params.startsAt) : null,
        endsAt: params.endsAt ? new Date(params.endsAt) : null,
      },
    });

    return toRaceEventDetail(race);
  },
);

interface ListRaceEventsParams {
  eventId: string;
}

// Lists the races within an event, ordered by their sequence.
export const listRaceEvents = api(
  { expose: true, method: "GET", path: "/events/:eventId/races" },
  async ({ eventId }: ListRaceEventsParams): Promise<{ races: RaceEventDetail[] }> => {
    const races = await prisma.raceEvent.findMany({
      where: { eventId },
      include: {
        raceMembers: {
          include: {
            user: {
              select: {
                name: true,
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
  { expose: true, method: "GET", path: "/events/:eventId/races/:raceId" },
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
  classRestriction?: ClassTier | null;
  startsAt?: string | null;
  endsAt?: string | null;
}

// Updates a race's editable fields. Gated by event-update permission.
export const updateRaceEvent = api(
  { expose: true, auth: true, method: "PATCH", path: "/events/:eventId/races/:raceId" },
  async (params: UpdateRaceEventParams): Promise<RaceEventDetail> => {
    await requireRaceEvent(params.eventId, params.raceId);
    await requireEventPermission(prisma, {
      authorization: params.authorization,
      eventId: params.eventId,
      action: "update",
    });

    await prisma.raceEvent.update({
      where: { id: params.raceId },
      data: {
        name: params.name ?? undefined,
        sequence: params.sequence ?? undefined,
        distanceMeters: params.distanceMeters ?? undefined,
        trackType: params.trackType ?? undefined,
        location: params.location ?? undefined,
        scoringType: params.scoringType === undefined ? undefined : params.scoringType,
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
      },
    });

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
  { expose: true, auth: true, method: "DELETE", path: "/events/:eventId/races/:raceId" },
  async ({ eventId, raceId, authorization }: DeleteRaceEventParams): Promise<{ deleted: boolean }> => {
    await requireRaceEvent(eventId, raceId);
    await requireEventPermission(prisma, {
      authorization,
      eventId,
      action: "delete",
    });

    await prisma.raceEvent.delete({ where: { id: raceId } });
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
  classRestriction: ClassTier | null;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  raceMembers?: {
    userId: string;
    user: {
      name: string;
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
    classRestriction: race.classRestriction,
    startsAt: race.startsAt ? race.startsAt.toISOString() : null,
    endsAt: race.endsAt ? race.endsAt.toISOString() : null,
    createdAt: race.createdAt.toISOString(),
    updatedAt: race.updatedAt.toISOString(),
    members: race.raceMembers
      ? race.raceMembers.map((rm) => ({
          userId: rm.userId,
          name: rm.user.name,
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
  { expose: true, auth: true, method: "POST", path: "/events/:eventId/races/:raceId/members" },
  async ({ eventId, raceId, authorization, userId }: AddRaceMemberParams): Promise<RaceEventDetail> => {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw APIError.notFound("event not found");
    }

    await requireEventPermission(prisma, {
      authorization,
      eventId,
      action: "update",
    });

    const race = await prisma.raceEvent.findUnique({ where: { id: raceId } });
    if (!race || race.eventId !== eventId) {
      throw APIError.notFound("race not found");
    }

    // User must be an event member first
    const member = await prisma.eventMember.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (!member) {
      throw APIError.failedPrecondition("user is not a member of this event");
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw APIError.notFound("user not found");
    }

    // Enforce the race's class restriction (fall back to event restriction)
    const targetRestriction = race.classRestriction ?? event.classRestriction;
    if (!isEligible(user.classTier, targetRestriction)) {
      throw APIError.failedPrecondition(
        "participant class tier does not satisfy the race class restriction",
      );
    }

    await prisma.raceEventMember.upsert({
      where: { raceEventId_userId: { raceEventId: raceId, userId } },
      create: { id: randomUUID(), raceEventId: raceId, userId },
      update: {},
    });

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
  { expose: true, auth: true, method: "DELETE", path: "/events/:eventId/races/:raceId/members/:userId" },
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
  { expose: true, method: "GET", path: "/events/:eventId/races/:raceId/members" },
  async ({ eventId, raceId }: ListRaceMembersParams): Promise<{ members: RaceEventMemberView[] }> => {
    await requireRaceEvent(eventId, raceId);

    const members = await prisma.raceEventMember.findMany({
      where: { raceEventId: raceId },
      include: {
        user: {
          select: {
            name: true,
            classTier: true,
          },
        },
      },
    });

    return {
      members: members.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        classTier: m.user.classTier,
      })),
    };
  }
);
