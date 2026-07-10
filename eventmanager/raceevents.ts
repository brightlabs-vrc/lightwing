import { randomUUID } from "node:crypto";
import { api, APIError, Header } from "encore.dev/api";
import { prisma } from "./prisma";
import { requireEventPermission } from "../auth/rbac";
import type { ClassTier } from "./classtier";

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
  { expose: true, method: "POST", path: "/events/:eventId/races" },
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
  { expose: true, method: "PATCH", path: "/events/:eventId/races/:raceId" },
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
  { expose: true, method: "DELETE", path: "/events/:eventId/races/:raceId" },
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
  const race = await prisma.raceEvent.findUnique({ where: { id: raceId } });
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
  };
}
