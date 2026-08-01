import { randomUUID } from "node:crypto";
import { api, APIError, Header, Query } from "encore.dev/api";
import { prisma } from "./prisma";
import {
  requireEventPermission,
  requirePermission,
  resolveActor,
} from "../auth/rbac";
import { isSiteAdmin } from "../auth/permissions";
import { type ClassTier } from "./classtier";
import { validateCustomScoringTables, resolvePoints } from "./scoring";
import { scorecalc } from "~encore/clients";
import { StructKeyspace, expireInSeconds } from "encore.dev/storage/cache";
import { cluster } from "../cache";
import { invalidateEventCaches } from "./cache-utils";
import { SCORING_POINTS, SCORING_LADDER } from "../lib/constants";

export const eventDetailCache = new StructKeyspace<{ id: string }, EventDetail>(
  cluster,
  {
    keyPattern: "event-detail/:id",
    defaultExpiry: expireInSeconds(120), // 2-minute safety-net TTL; mutations invalidate explicitly
  }
);

interface PublicEventsCacheValue {
  events: EventDetail[];
}

export const PUBLIC_EVENTS_KEY = "public-events-list";

export const publicEventsCache = new StructKeyspace<{ key: string }, PublicEventsCacheValue>(
  cluster,
  {
    keyPattern: "public-events-list/:key",
    defaultExpiry: expireInSeconds(60), // 60-second TTL — stale by at most 1 minute
  }
);

// API-facing string unions mirroring the Prisma enums. Encore's schema parser
// cannot use Prisma's runtime enum objects as types, so these are declared as
// plain literal unions with byte-identical values (see classtier.ts).
export type EventOwnerType = "ORGANIZATION" | "USER";
export type EventStatus = "DRAFT" | "UNOFFICIAL" | "OFFICIAL" | "CONCLUDED";

const SCORING_LABELS: Record<number, string> = {
  [SCORING_POINTS]: "points-based",
  [SCORING_LADDER]: "ladder-elo",
};

const LADDER_STARTING_ELO = 1200;
const LADDER_K_FACTOR = 32;

export interface EventMemberView {
  userId: string;
  name: string;
  classTier: ClassTier | null;
}

export interface EventScheduleView {
  id: string;
  title: string | null;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
}

export interface PointsEntryView {
  userId: string;
  name: string;
  points: number;
}

export interface LadderEntryView {
  userId: string;
  name: string;
  elo: number;
  wins: number;
  losses: number;
  rank: number;
}

export interface RaceEventMemberView {
  userId: string;
  name: string;
  classTier: ClassTier | null;
}

export interface RaceEventView {
  id: string;
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
  members: RaceEventMemberView[];
}

export interface EventDetail {
  id: string;
  name: string;
  description: string | null;
  ownerType: EventOwnerType;
  organizationId: string | null;
  ownerUserId: string | null;
  status: EventStatus;
  scoringType: number;
  scoringTypeLabel: string;
  scoringRulesMode: string | null;
  customScoringTables: any | null;
  classRestriction: ClassTier | null;
  granularParticipation: boolean;
  signupsLocked: boolean;
  raceEvents: RaceEventView[];
  members: EventMemberView[];
  schedules: EventScheduleView[];
  pointsOverview: PointsEntryView[] | null;
  ladderOverview: LadderEntryView[] | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateEventParams {
  authorization: Header<"Authorization">;
  name: string;
  description?: string | null;
  ownerType: EventOwnerType;
  organizationId?: string | null;
  ownerUserId?: string | null;
  scoringType: number;
  scoringRulesMode?: string | null;
  customScoringTables?: any | null;
  classRestriction?: ClassTier | null;
  granularParticipation?: boolean;
}

// Creates an event owned by either an organization or a single user (issue #4).
// Org-owned events require event-create permission in the organization (or site
// admin). User-owned events may be created by any authenticated user for
// themselves; site admins may create one on behalf of any user.
export const createEvent = api(
  { expose: true, auth: true, method: "POST", path: "/api/events" },
  async (params: CreateEventParams): Promise<EventDetail> => {
    let organizationId: string | null = null;
    let ownerUserId: string | null = null;

    if (params.ownerType === "ORGANIZATION") {
      if (!params.organizationId) {
        throw APIError.invalidArgument(
          "organizationId is required for organization-owned events",
        );
      }
      await requirePermission(prisma, {
        authorization: params.authorization,
        organizationId: params.organizationId,
        resource: "event",
        action: "create",
      });

      const organization = await prisma.organization.findUnique({
        where: { id: params.organizationId },
      });
      if (!organization) {
        throw APIError.notFound("organization not found");
      }
      organizationId = params.organizationId;
    } else {
      const actor = await resolveActor(prisma, params.authorization);
      ownerUserId = params.ownerUserId ?? actor.userId;
      if (ownerUserId !== actor.userId && !isSiteAdmin(actor.siteRole)) {
        throw APIError.permissionDenied(
          "only a site administrator can create an event on behalf of another user",
        );
      }

      const owner = await prisma.user.findUnique({ where: { id: ownerUserId } });
      if (!owner) {
        throw APIError.notFound("owner user not found");
      }
    }

    let scoringRulesMode: string | null = null;
    let customScoringTables: any | null = null;

    if (params.scoringType === SCORING_POINTS) {
      scoringRulesMode = params.scoringRulesMode ?? "STANDARD";
      if (scoringRulesMode === "CUSTOM") {
        if (!params.customScoringTables) {
          throw APIError.invalidArgument("customScoringTables is required when scoringRulesMode is CUSTOM");
        }
        validateCustomScoringTables(params.customScoringTables);
        customScoringTables = params.customScoringTables;
      } else {
        scoringRulesMode = "STANDARD";
      }
    }

    const event = await prisma.event.create({
      data: {
        id: randomUUID(),
        name: params.name,
        description: params.description ?? null,
        ownerType: params.ownerType,
        organizationId,
        ownerUserId,
        scoringType: params.scoringType,
        scoringRulesMode,
        customScoringTables,
        classRestriction: params.classRestriction ?? null,
        granularParticipation: params.granularParticipation ?? false,
      },
    });

    await invalidateEventCaches(event.id);

    return loadEvent(event.id);
  },
);

interface ListEventsParams {
  organizationId?: Query<string>;
  classRestriction?: Query<ClassTier>;
}

// Lists events, optionally filtered by organization or class restriction.
export const listEvents = api(
  { expose: true, method: "GET", path: "/api/events" },
  async ({
    organizationId,
    classRestriction,
  }: ListEventsParams): Promise<{ events: EventDetail[] }> => {
    const events = await prisma.event.findMany({
      where: {
        organizationId: organizationId ?? undefined,
        classRestriction: (classRestriction as ClassTier | undefined) ?? undefined,
      },
      orderBy: { createdAt: "desc" },
    });

    const detailed = await Promise.all(events.map((event) => loadEvent(event.id)));
    return { events: detailed };
  },
);

// Lists public events (UNOFFICIAL, OFFICIAL, CONCLUDED) without DRAFT visibility.
// Used by the public events page.
export const listPublicEvents = api(
  { expose: true, method: "GET", path: "/api/events/public" },
  async (): Promise<{ events: EventDetail[] }> => {
    const cached = await publicEventsCache.get({ key: PUBLIC_EVENTS_KEY });
    if (cached !== undefined) {
      return cached;
    }

    const events = await prisma.event.findMany({
      where: {
        status: { in: ["UNOFFICIAL", "OFFICIAL", "CONCLUDED"] },
      },
      orderBy: { createdAt: "desc" },
    });

    const detailed = await Promise.all(events.map((event) => loadEvent(event.id)));
    const value = { events: detailed };
    await publicEventsCache.set({ key: PUBLIC_EVENTS_KEY }, value);
    return value;
  },
);

interface EventIdParams {
  id: string;
}

// Returns a single event with members, schedules and the scoring overview that
// matches its scoring type.
export const getEvent = api(
  { expose: true, method: "GET", path: "/api/events/:id" },
  async ({ id }: EventIdParams): Promise<EventDetail> => {
    return loadEvent(id);
  },
);

interface DeleteEventParams {
  id: string;
  authorization: Header<"Authorization">;
}

// Deletes an event and its related records.
export const deleteEvent = api(
  { expose: true, auth: true, method: "DELETE", path: "/api/events/:id" },
  async ({ id, authorization }: DeleteEventParams): Promise<{ deleted: boolean }> => {
    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) {
      throw APIError.notFound("event not found");
    }
    await requireEventPermission(prisma, {
      authorization,
      eventId: id,
      action: "delete",
    });

    await prisma.event.delete({ where: { id } });
    await invalidateEventCaches(id);
    return { deleted: true };
  },
);

export async function ensureEventStandingsRow(
  tx: any,
  eventId: string,
  userId: string,
  scoringType: number,
): Promise<void> {
  if (scoringType === SCORING_POINTS) {
    await tx.eventPointsEntry.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { id: randomUUID(), eventId, userId, points: 0 },
      update: {},
    });
  } else {
    await tx.eventLadderEntry.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { id: randomUUID(), eventId, userId, elo: LADDER_STARTING_ELO },
      update: {},
    });
  }
}

export function computeElo(
  winnerElo: number,
  loserElo: number,
): { winnerElo: number; loserElo: number } {
  const expectedWinner = 1 / (1 + 10 ** ((loserElo - winnerElo) / 400));
  const expectedLoser = 1 - expectedWinner;
  return {
    winnerElo: Math.round(winnerElo + LADDER_K_FACTOR * (1 - expectedWinner)),
    loserElo: Math.round(loserElo + LADDER_K_FACTOR * (0 - expectedLoser)),
  };
}

export async function loadEvent(id: string): Promise<EventDetail> {
  const cached = await eventDetailCache.get({ id });
  if (cached !== undefined) {
    return cached;
  }

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      raceEvents: {
        orderBy: { sequence: "asc" },
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
      },
      members: { include: { user: { select: { name: true, classTier: true } } } },
      schedules: { orderBy: { startsAt: "asc" } },
      pointsEntries: {
        include: { user: { select: { name: true } } },
        orderBy: { points: "desc" },
      },
      ladderEntries: {
        include: { user: { select: { name: true } } },
        orderBy: { elo: "desc" },
      },
    },
  });

  if (!event) {
    throw APIError.notFound("event not found");
  }

  const pointsOverview =
    event.scoringType === SCORING_POINTS
      ? event.pointsEntries.map((entry) => ({
          userId: entry.userId,
          name: entry.user.name,
          points: entry.points,
        }))
      : null;

  const ladderOverview =
    event.scoringType === SCORING_LADDER
      ? event.ladderEntries.map((entry, index) => ({
          userId: entry.userId,
          name: entry.user.name,
          elo: entry.elo,
          wins: entry.wins,
          losses: entry.losses,
          rank: index + 1,
        }))
      : null;

  const detail: EventDetail = {
    id: event.id,
    name: event.name,
    description: event.description,
    ownerType: event.ownerType as EventOwnerType,
    organizationId: event.organizationId,
    ownerUserId: event.ownerUserId,
    status: event.status as EventStatus,
    scoringType: event.scoringType,
    scoringTypeLabel: SCORING_LABELS[event.scoringType] ?? "unknown",
    scoringRulesMode: event.scoringRulesMode,
    customScoringTables: event.customScoringTables,
    classRestriction: event.classRestriction,
    granularParticipation: event.granularParticipation,
    signupsLocked: event.signupsLocked,
    raceEvents: event.raceEvents.map((race) => ({
      id: race.id,
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
      members: race.raceMembers
        ? race.raceMembers.map((rm) => ({
            userId: rm.userId,
            name: rm.user.name,
            classTier: rm.user.classTier,
          }))
        : [],
    })),
    members: event.members.map((member) => ({
      userId: member.userId,
      name: member.user.name,
      classTier: member.user.classTier,
    })),
    schedules: event.schedules.map((schedule) => ({
      id: schedule.id,
      title: schedule.title,
      startsAt: schedule.startsAt.toISOString(),
      endsAt: schedule.endsAt ? schedule.endsAt.toISOString() : null,
      location: schedule.location,
    })),
    pointsOverview,
    ladderOverview,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };

  await eventDetailCache.set({ id }, detail);
  return detail;
}

// Function to recompute all race result points for an event.
// It is idempotent, safe to call repeatedly, and updates the downstream event-level aggregates.
export async function recomputeEventPointsInternal(eventId: string): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      raceEvents: {
        include: {
          results: true,
        },
      },
    },
  });
  if (!event) return;

  if (event.scoringType !== SCORING_POINTS) {
    return;
  }

  const affectedUserIds = new Set<string>();

  for (const race of event.raceEvents) {
    for (const result of race.results) {
      const calculatedPoints = resolvePoints({
        scoringRulesMode: event.scoringRulesMode,
        customScoringTables: event.customScoringTables,
        grade: race.grade,
        position: result.position,
      });

      if (result.points !== calculatedPoints) {
        await prisma.raceResult.update({
          where: { id: result.id },
          data: { points: calculatedPoints },
        });
      }
      affectedUserIds.add(result.userId);
    }
  }

  if (affectedUserIds.size > 0) {
    await scorecalc.submitCalc({
      eventId: eventId,
      userIds: Array.from(affectedUserIds),
    });
  }

  await invalidateEventCaches(eventId);
}
