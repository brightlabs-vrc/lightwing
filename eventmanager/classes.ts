import { api, APIError, Header } from "encore.dev/api";
import { prisma } from "./prisma";
import { requirePermission } from "../auth/rbac";
import {
  type ClassTier,
  CLASS_TIER_LABELS,
  CLASS_TIER_ORDER,
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
  { expose: true, method: "GET", path: "/classes" },
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
  organizationId: string;
  classTier: ClassTier | null;
}

// Tags a participant with a skill class tier (issue #3). This is an
// administrative action gated by the same RBAC role that manages events: the
// caller must hold event-management permission in the supplied organization.
export const setUserClass = api(
  { expose: true, method: "PUT", path: "/users/:userId/class" },
  async ({
    userId,
    authorization,
    organizationId,
    classTier,
  }: SetUserClassParams): Promise<{ userId: string; classTier: ClassTier | null }> => {
    await requirePermission(prisma, {
      authorization,
      organizationId,
      resource: "event",
      action: "update",
    });

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

export interface EligibleEvent {
  id: string;
  name: string;
  organizationId: string;
  classRestriction: ClassTier | null;
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

    const events = await prisma.event.findMany({ orderBy: { createdAt: "desc" } });
    const eligible = events
      .filter((event) => isEligible(user.classTier, event.classRestriction))
      .map((event) => ({
        id: event.id,
        name: event.name,
        organizationId: event.organizationId,
        classRestriction: event.classRestriction,
      }));

    return { events: eligible };
  },
);
