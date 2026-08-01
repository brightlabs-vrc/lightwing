import { randomUUID } from "node:crypto";
import { api, APIError, Header } from "encore.dev/api";
import { prisma } from "./prisma";
import { requireEventPermission, requireSiteAdmin } from "../auth/rbac";
import { loadEvent, recomputeEventPointsInternal, type EventDetail } from "./events";
import { invalidateEventCaches } from "./cache-utils";
import { computeElo } from "./events"; // export computeElo from events.ts
import { SCORING_POINTS, SCORING_LADDER } from "../lib/constants";

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
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      throw APIError.notFound("event not found");
    }
    await requireEventPermission(prisma, {
      authorization,
      eventId: id,
      action: "update",
    });

    if (event.scoringType !== SCORING_POINTS) {
      throw APIError.failedPrecondition("event is not points-based");
    }

    const member = await prisma.eventMember.findUnique({
      where: { eventId_userId: { eventId: id, userId } },
    });
    if (!member) {
      throw APIError.failedPrecondition("user is not a member of this event");
    }

    await prisma.eventPointsEntry.upsert({
      where: { eventId_userId: { eventId: id, userId } },
      create: { id: randomUUID(), eventId: id, userId, points },
      update: { points },
    });

    await invalidateEventCaches(id);

    return loadEvent(id);
  },
);

interface LadderMatchParams {
  id: string;
  authorization: Header<"Authorization">;
  winnerId: string;
  loserId: string;
}

const LADDER_STARTING_ELO = 1200;

async function getOrCreateLadderEntry(eventId: string, userId: string) {
  return prisma.eventLadderEntry.upsert({
    where: { eventId_userId: { eventId, userId } },
    create: { id: randomUUID(), eventId, userId, elo: LADDER_STARTING_ELO },
    update: {},
  });
}

// Records a 1v1 result on a ladder-elo event and updates both ratings
// (ladder overview).
export const recordLadderMatch = api(
  { expose: true, auth: true, method: "POST", path: "/api/events/:id/ladder/matches" },
  async ({ id, authorization, winnerId, loserId }: LadderMatchParams): Promise<EventDetail> => {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      throw APIError.notFound("event not found");
    }
    await requireEventPermission(prisma, {
      authorization,
      eventId: id,
      action: "update",
    });

    if (event.scoringType !== SCORING_LADDER) {
      throw APIError.failedPrecondition("event is not ladder-elo");
    }
    if (winnerId === loserId) {
      throw APIError.invalidArgument("winner and loser must differ");
    }

    const winnerMember = await prisma.eventMember.findUnique({
      where: { eventId_userId: { eventId: id, userId: winnerId } },
    });
    if (!winnerMember) {
      throw APIError.failedPrecondition("winner is not a member of this event");
    }

    const loserMember = await prisma.eventMember.findUnique({
      where: { eventId_userId: { eventId: id, userId: loserId } },
    });
    if (!loserMember) {
      throw APIError.failedPrecondition("loser is not a member of this event");
    }

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

    await invalidateEventCaches(id);

    return loadEvent(id);
  },
);

interface SetStatusParams {
  id: string;
  authorization: Header<"Authorization">;
  status: any;
}

// Sets an event's lifecycle status. Endorsing an event as OFFICIAL is a
// platform action reserved for site administrators; all other statuses
// (DRAFT/UNOFFICIAL/CONCLUDED) may be set by anyone who can update the event.
export const setEventStatus = api(
  { expose: true, auth: true, method: "PUT", path: "/api/events/:id/status" },
  async ({ id, authorization, status }: SetStatusParams): Promise<EventDetail> => {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      throw APIError.notFound("event not found");
    }
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
    await invalidateEventCaches(id);
    return loadEvent(id);
  },
);

interface RecomputePointsParams {
  id: string;
  authorization: Header<"Authorization">;
}

// Recomputes all points-based results for an event. Gated by update permission on the event.
export const recomputeEventPoints = api(
  { expose: true, auth: true, method: "POST", path: "/api/events/:id/recompute-points" },
  async ({ id, authorization }: RecomputePointsParams): Promise<{ success: boolean }> => {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      throw APIError.notFound("event not found");
    }
    await requireEventPermission(prisma, {
      authorization,
      eventId: id,
      action: "update",
    });

    await recomputeEventPointsInternal(id);
    return { success: true };
  },
);
