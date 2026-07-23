import { randomUUID } from "node:crypto";
import { api, APIError, Header, Query } from "encore.dev/api";
import { prisma } from "./prisma";
import {
  requireEventPermission,
  requirePermission,
  requireSiteAdmin,
  resolveActor,
} from "../auth/rbac";
import { isSiteAdmin } from "../auth/permissions";
import { type ClassTier, isEligible } from "./classtier";
import { validateCustomScoringTables, resolvePoints } from "./scoring";
import { scorecalc } from "~encore/clients";

// API-facing string unions mirroring the Prisma enums. Encore's schema parser
// cannot use Prisma's runtime enum objects as types, so these are declared as
// plain literal unions with byte-identical values (see classtier.ts).
export type EventOwnerType = "ORGANIZATION" | "USER";
export type EventStatus = "DRAFT" | "UNOFFICIAL" | "OFFICIAL" | "CONCLUDED";

// Event scoring types (issue #4). 1 = points-based, 2 = ladder-elo.
export const SCORING_POINTS = 1;
export const SCORING_LADDER_ELO = 2;
export type ScoringType = typeof SCORING_POINTS | typeof SCORING_LADDER_ELO;

const SCORING_LABELS: Record<number, string> = {
  [SCORING_POINTS]: "points-based",
  [SCORING_LADDER_ELO]: "ladder-elo",
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
  scoringType: ScoringType;
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
    const events = await prisma.event.findMany({
      where: {
        status: { in: ["UNOFFICIAL", "OFFICIAL", "CONCLUDED"] },
      },
      orderBy: { createdAt: "desc" },
    });

    const detailed = await Promise.all(events.map((event) => loadEvent(event.id)));
    return { events: detailed };
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

interface UpdateEventParams {
  id: string;
  authorization: Header<"Authorization">;
  name?: string;
  description?: string | null;
  scoringRulesMode?: string | null;
  customScoringTables?: any | null;
  classRestriction?: ClassTier | null;
  granularParticipation?: boolean;
}

// Updates an event's editable fields (scoring type is immutable once set).
export const updateEvent = api(
  { expose: true, auth: true, method: "PATCH", path: "/api/events/:id" },
  async (params: UpdateEventParams): Promise<EventDetail> => {
    const existingEvent = await requireEvent(params.id);
    await requireEventPermission(prisma, {
      authorization: params.authorization,
      eventId: params.id,
      action: "update",
    });

    let updatedScoringRulesMode: string | undefined = undefined;
    let updatedCustomScoringTables: any | undefined = undefined;
    let triggerRecomputation = false;

    if (existingEvent.scoringType === SCORING_POINTS) {
      if (params.scoringRulesMode !== undefined) {
        updatedScoringRulesMode = params.scoringRulesMode ?? "STANDARD";
        if (updatedScoringRulesMode === "CUSTOM") {
          const tables = params.customScoringTables !== undefined ? params.customScoringTables : existingEvent.customScoringTables;
          if (!tables) {
            throw APIError.invalidArgument("customScoringTables is required when scoringRulesMode is CUSTOM");
          }
          validateCustomScoringTables(tables);
          updatedCustomScoringTables = tables;
        } else {
          updatedCustomScoringTables = null;
        }

        if (existingEvent.scoringRulesMode !== updatedScoringRulesMode) {
          triggerRecomputation = true;
        }
      }

      if (params.customScoringTables !== undefined && (updatedScoringRulesMode ?? existingEvent.scoringRulesMode) === "CUSTOM") {
        validateCustomScoringTables(params.customScoringTables);
        updatedCustomScoringTables = params.customScoringTables;

        if (JSON.stringify(existingEvent.customScoringTables) !== JSON.stringify(updatedCustomScoringTables)) {
          triggerRecomputation = true;
        }
      }
    }

    await prisma.event.update({
      where: { id: params.id },
      data: {
        name: params.name ?? undefined,
        description: params.description === undefined ? undefined : params.description,
        scoringRulesMode: updatedScoringRulesMode,
        customScoringTables: updatedCustomScoringTables,
        classRestriction:
          params.classRestriction === undefined ? undefined : params.classRestriction,
        granularParticipation:
          params.granularParticipation === undefined ? undefined : params.granularParticipation,
      },
    });

    if (triggerRecomputation) {
      await recomputeEventPointsInternal(params.id);
    }

    return loadEvent(params.id);
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
    await requireEvent(id);
    await requireEventPermission(prisma, {
      authorization,
      eventId: id,
      action: "delete",
    });

    await prisma.event.delete({ where: { id } });
    return { deleted: true };
  },
);

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
    const event = await requireEvent(id);
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

    if (event.scoringType === SCORING_POINTS) {
      await prisma.eventPointsEntry.upsert({
        where: { eventId_userId: { eventId: id, userId } },
        create: { id: randomUUID(), eventId: id, userId, points: 0 },
        update: {},
      });
    } else {
      await prisma.eventLadderEntry.upsert({
        where: { eventId_userId: { eventId: id, userId } },
        create: { id: randomUUID(), eventId: id, userId, elo: LADDER_STARTING_ELO },
        update: {},
      });
    }

    return loadEvent(id);
  },
);

interface RemoveMemberParams {
  id: string;
  userId: string;
  authorization: Header<"Authorization">;
}

// Removes a participant from an event.
export const removeEventMember = api(
  { expose: true, auth: true, method: "DELETE", path: "/api/events/:id/members/:userId" },
  async ({ id, userId, authorization }: RemoveMemberParams): Promise<EventDetail> => {
    await requireEvent(id);
    await requireEventPermission(prisma, {
      authorization,
      eventId: id,
      action: "update",
    });

    await prisma.eventMember.deleteMany({ where: { eventId: id, userId } });
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
    const event = await requireEvent(id);

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

    if (event.scoringType === SCORING_POINTS) {
      await prisma.eventPointsEntry.upsert({
        where: { eventId_userId: { eventId: id, userId } },
        create: { id: randomUUID(), eventId: id, userId, points: 0 },
        update: {},
      });
    } else {
      await prisma.eventLadderEntry.upsert({
        where: { eventId_userId: { eventId: id, userId } },
        create: { id: randomUUID(), eventId: id, userId, elo: LADDER_STARTING_ELO },
        update: {},
      });
    }

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
    const event = await requireEvent(id);

    if (event.signupsLocked) {
      throw APIError.failedPrecondition(
        "signups are locked for this event",
      );
    }

    // Resolve the authenticated actor - self-service, no permission check
    const actor = await resolveActor(prisma, authorization);
    const userId = actor.userId;

    await prisma.eventMember.deleteMany({ where: { eventId: id, userId } });
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
    await requireEvent(id);
    await requireEventPermission(prisma, {
      authorization,
      eventId: id,
      action: "update",
    });

    await prisma.event.update({ where: { id }, data: { signupsLocked: locked } });
    return loadEvent(id);
  },
);

interface AddScheduleParams {
  id: string;
  authorization: Header<"Authorization">;
  title?: string | null;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
}

// Adds a schedule slot to an event (issue #4).
export const addEventSchedule = api(
  { expose: true, auth: true, method: "POST", path: "/api/events/:id/schedules" },
  async (params: AddScheduleParams): Promise<EventDetail> => {
    await requireEvent(params.id);
    await requireEventPermission(prisma, {
      authorization: params.authorization,
      eventId: params.id,
      action: "update",
    });

    await prisma.eventSchedule.create({
      data: {
        id: randomUUID(),
        eventId: params.id,
        title: params.title ?? null,
        startsAt: new Date(params.startsAt),
        endsAt: params.endsAt ? new Date(params.endsAt) : null,
        location: params.location ?? null,
      },
    });

    return loadEvent(params.id);
  },
);

interface SetPointsParams {
  id: string;
  userId: string;
  authorization: Header<"Authorization">;
  points: number;
}

// Sets a participant's points on a points-based event (points overview).
export const setEventPoints = api(
  { expose: true, auth: true, method: "PUT", path: "/api/events/:id/points/:userId" },
  async ({ id, userId, authorization, points }: SetPointsParams): Promise<EventDetail> => {
    const event = await requireEvent(id);
    await requireEventPermission(prisma, {
      authorization,
      eventId: id,
      action: "update",
    });

    if (event.scoringType !== SCORING_POINTS) {
      throw APIError.failedPrecondition("event is not points-based");
    }
    await requireMembership(id, userId);

    await prisma.eventPointsEntry.upsert({
      where: { eventId_userId: { eventId: id, userId } },
      create: { id: randomUUID(), eventId: id, userId, points },
      update: { points },
    });

    return loadEvent(id);
  },
);

interface LadderMatchParams {
  id: string;
  authorization: Header<"Authorization">;
  winnerId: string;
  loserId: string;
}

// Records a 1v1 result on a ladder-elo event and updates both ratings
// (ladder overview).
export const recordLadderMatch = api(
  { expose: true, auth: true, method: "POST", path: "/api/events/:id/ladder/matches" },
  async ({ id, authorization, winnerId, loserId }: LadderMatchParams): Promise<EventDetail> => {
    const event = await requireEvent(id);
    await requireEventPermission(prisma, {
      authorization,
      eventId: id,
      action: "update",
    });

    if (event.scoringType !== SCORING_LADDER_ELO) {
      throw APIError.failedPrecondition("event is not ladder-elo");
    }
    if (winnerId === loserId) {
      throw APIError.invalidArgument("winner and loser must differ");
    }
    await requireMembership(id, winnerId);
    await requireMembership(id, loserId);

    const winner = await getOrCreateLadderEntry(id, winnerId);
    const loser = await getOrCreateLadderEntry(id, loserId);

    const { winnerElo, loserElo } = computeElo(winner.elo, loser.elo);

    await prisma.eventLadderEntry.update({
      where: { eventId_userId: { eventId: id, userId: winnerId } },
      data: { elo: winnerElo, wins: { increment: 1 } },
    });
    await prisma.eventLadderEntry.update({
      where: { eventId_userId: { eventId: id, userId: loserId } },
      data: { elo: loserElo, losses: { increment: 1 } },
    });

    return loadEvent(id);
  },
);

interface SetStatusParams {
  id: string;
  authorization: Header<"Authorization">;
  status: EventStatus;
}

// Sets an event's lifecycle status. Endorsing an event as OFFICIAL is a
// platform action reserved for site administrators; all other statuses
// (DRAFT/UNOFFICIAL/CONCLUDED) may be set by anyone who can update the event.
export const setEventStatus = api(
  { expose: true, auth: true, method: "PUT", path: "/api/events/:id/status" },
  async ({ id, authorization, status }: SetStatusParams): Promise<EventDetail> => {
    await requireEvent(id);
    if (status === "OFFICIAL") {
      await requireSiteAdmin(prisma, authorization);
    } else {
      await requireEventPermission(prisma, {
        authorization,
        eventId: id,
        action: "update",
      });
    }

    await prisma.event.update({ where: { id }, data: { status } });
    return loadEvent(id);
  },
);

function computeElo(
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

async function getOrCreateLadderEntry(eventId: string, userId: string) {
  return prisma.eventLadderEntry.upsert({
    where: { eventId_userId: { eventId, userId } },
    create: { id: randomUUID(), eventId, userId, elo: LADDER_STARTING_ELO },
    update: {},
  });
}

async function requireEvent(id: string) {
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) {
    throw APIError.notFound("event not found");
  }
  return event;
}

async function requireMembership(eventId: string, userId: string): Promise<void> {
  const member = await prisma.eventMember.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });
  if (!member) {
    throw APIError.failedPrecondition("user is not a member of this event");
  }
}

async function loadEvent(id: string): Promise<EventDetail> {
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      raceEvents: { orderBy: { sequence: "asc" } },
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
    event.scoringType === SCORING_LADDER_ELO
      ? event.ladderEntries.map((entry, index) => ({
          userId: entry.userId,
          name: entry.user.name,
          elo: entry.elo,
          wins: entry.wins,
          losses: entry.losses,
          rank: index + 1,
        }))
      : null;

  return {
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
}

interface RecomputePointsParams {
  id: string;
  authorization: Header<"Authorization">;
}

// Recomputes all points-based results for an event. Gated by update permission on the event.
export const recomputeEventPoints = api(
  { expose: true, auth: true, method: "POST", path: "/api/events/:id/recompute-points" },
  async ({ id, authorization }: RecomputePointsParams): Promise<{ success: boolean }> => {
    await requireEvent(id);
    await requireEventPermission(prisma, {
      authorization,
      eventId: id,
      action: "update",
    });

    await recomputeEventPointsInternal(id);
    return { success: true };
  },
);
