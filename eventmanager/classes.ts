import { api, APIError, Header } from "encore.dev/api";
import { prisma } from "./prisma";
import { requirePermission, requireSiteAdmin } from "../auth/rbac";
import {
  type ClassTier,
  CLASS_TIER_LABELS,
  CLASS_TIER_ORDER,
  getEligibleClassRestrictions,
  isEligible,
} from "./classtier";

export interface ClassTierInfo {
  tier: ClassTier;
  label: string;
  rank: number;
}

// Lists the available skill class tiers (issue #3) ordered from lowest to
// highest skill.
export const listClassTiers = api(
  { expose: true, method: "GET", path: "/api/classes" },
  async (): Promise<{ tiers: ClassTierInfo[] }> => {
    return {
      tiers: CLASS_TIER_ORDER.map((tier, index) => ({
        tier,
        label: CLASS_TIER_LABELS[tier],
        rank: index + 1,
      })),
    };
  },
);

interface SetUserClassParams {
  userId: string;
  authorization: Header<"Authorization">;
  organizationId?: string | null;
  classTier: ClassTier | null;
}

// Tags a participant with a skill class tier (issue #3). This is an
// administrative action: within an organization it is gated by the same RBAC
// role that manages events; site administrators may set a class tier globally
// (no organization context required).
export const setUserClass = api(
  { expose: true, auth: true, method: "PUT", path: "/api/users/:userId/class" },
  async ({
    userId,
    authorization,
    organizationId,
    classTier,
  }: SetUserClassParams): Promise<{ userId: string; classTier: ClassTier | null }> => {
    if (organizationId) {
      await requirePermission(prisma, {
        authorization,
        organizationId,
        resource: "event",
        action: "update",
      });
    } else {
      await requireSiteAdmin(prisma, authorization);
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw APIError.notFound("user not found");
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { classTier },
    });

    return { userId: updated.id, classTier: updated.classTier };
  },
);

export interface EligibleRace {
  id: string;
  name: string;
  sequence: number;
  classRestriction: ClassTier | null;
}

export interface EligibleEvent {
  id: string;
  name: string;
  organizationId: string | null;
  classRestriction: ClassTier | null;
  eligibleRaces: EligibleRace[];
}

interface EligibleEventsParams {
  userId: string;
}

// Returns the events a participant is eligible to enter based on their class
// tier and each event's class restriction (issue #3).
export const listEligibleEvents = api(
  { expose: true, method: "GET", path: "/users/:userId/eligible-events" },
  async ({ userId }: EligibleEventsParams): Promise<{ events: EligibleEvent[] }> => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw APIError.notFound("user not found");
    }

    const { allowedRestrictions, nonNullAllowedRestrictions } =
      getEligibleClassRestrictions(user.classTier);
    const allowedSet = new Set(allowedRestrictions);

    const events = await prisma.event.findMany({
      where: {
        OR: [
          { classRestriction: { in: allowedRestrictions } },
          {
            raceEvents: {
              some: {
                classRestriction: { in: nonNullAllowedRestrictions },
              },
            },
          },
        ],
      },
      include: {
        raceEvents: {
          orderBy: { sequence: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const eligible: EligibleEvent[] = [];
    for (const event of events) {
      const isEventEligible = allowedSet.has(event.classRestriction);

      const eligibleRaces: EligibleRace[] = [];
      for (const race of event.raceEvents) {
        const effectiveRestriction = race.classRestriction ?? event.classRestriction;
        if (allowedSet.has(effectiveRestriction)) {
          eligibleRaces.push({
            id: race.id,
            name: race.name,
            sequence: race.sequence,
            classRestriction: effectiveRestriction,
          });
        }
      }

      if (isEventEligible || eligibleRaces.length > 0) {
        eligible.push({
          id: event.id,
          name: event.name,
          organizationId: event.organizationId,
          classRestriction: event.classRestriction,
          eligibleRaces,
        });
      }
    }

    return { events: eligible };
  },
);
