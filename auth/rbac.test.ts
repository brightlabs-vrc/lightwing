import { describe, expect, test } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { requireEventPermission, requireSiteAdmin } from "./rbac";

// Lightweight in-memory stand-in for the subset of PrismaClient the RBAC
// helpers touch. Encore provisions a real database for integration tests, but
// the authorization *logic* (ownership resolution, the site-admin
// short-circuit, the EventAdmin fallback) is pure branching that is far clearer
// to exercise against fixed fixtures than against seeded rows.
interface Fixtures {
  sessions: Record<string, { userId: string; siteRole: string; expired?: boolean }>;
  events: Record<
    string,
    { ownerType: "ORGANIZATION" | "USER"; ownerUserId: string | null; organizationId: string | null }
  >;
  members: Record<string, string>; // `${organizationId}:${userId}` -> role
  eventAdmins: Set<string>; // `${eventId}:${userId}`
}

function makePrisma(f: Fixtures): PrismaClient {
  return {
    session: {
      findUnique: async ({ where: { token } }: { where: { token: string } }) => {
        const s = f.sessions[token];
        if (!s) return null;
        return {
          token,
          userId: s.userId,
          activeOrganizationId: null,
          expiresAt: new Date(Date.now() + (s.expired ? -1000 : 3_600_000)),
          user: { siteRole: s.siteRole },
        };
      },
    },
    event: {
      findUnique: async ({ where: { id } }: { where: { id: string } }) =>
        f.events[id] ? { id, ...f.events[id] } : null,
    },
    member: {
      findUnique: async ({
        where: { organizationId_userId },
      }: {
        where: { organizationId_userId: { organizationId: string; userId: string } };
      }) => {
        const role =
          f.members[`${organizationId_userId.organizationId}:${organizationId_userId.userId}`];
        return role ? { role } : null;
      },
    },
    eventAdmin: {
      findUnique: async ({
        where: { eventId_userId },
      }: {
        where: { eventId_userId: { eventId: string; userId: string } };
      }) =>
        f.eventAdmins.has(`${eventId_userId.eventId}:${eventId_userId.userId}`)
          ? { id: "ea", ...eventId_userId }
          : null,
    },
  } as unknown as PrismaClient;
}

const baseFixtures = (): Fixtures => ({
  sessions: {
    "owner-token": { userId: "owner", siteRole: "USER" },
    "orgadmin-token": { userId: "orgadmin", siteRole: "USER" },
    "stranger-token": { userId: "stranger", siteRole: "USER" },
    "eventadmin-token": { userId: "eadmin", siteRole: "USER" },
    "site-token": { userId: "root", siteRole: "SITE_ADMIN" },
  },
  events: {
    "user-event": { ownerType: "USER", ownerUserId: "owner", organizationId: null },
    "org-event": { ownerType: "ORGANIZATION", ownerUserId: null, organizationId: "org1" },
  },
  members: { "org1:orgadmin": "administrator" },
  eventAdmins: new Set<string>(),
});

describe("requireEventPermission", () => {
  test("user-owned: the owner has full control", async () => {
    const prisma = makePrisma(baseFixtures());
    const { actor } = await requireEventPermission(prisma, {
      authorization: "Bearer owner-token",
      eventId: "user-event",
      action: "update",
    });
    expect(actor.userId).toBe("owner");
  });

  test("user-owned: a stranger is denied", async () => {
    const prisma = makePrisma(baseFixtures());
    await expect(
      requireEventPermission(prisma, {
        authorization: "Bearer stranger-token",
        eventId: "user-event",
        action: "update",
      }),
    ).rejects.toThrow(/not permitted/);
  });

  test("org-owned: an org administrator is allowed via the RBAC matrix", async () => {
    const prisma = makePrisma(baseFixtures());
    const { actor } = await requireEventPermission(prisma, {
      authorization: "Bearer orgadmin-token",
      eventId: "org-event",
      action: "delete",
    });
    expect(actor.userId).toBe("orgadmin");
  });

  test("org-owned: a non-member is denied", async () => {
    const prisma = makePrisma(baseFixtures());
    await expect(
      requireEventPermission(prisma, {
        authorization: "Bearer stranger-token",
        eventId: "org-event",
        action: "update",
      }),
    ).rejects.toThrow(/not permitted/);
  });

  test("explicit EventAdmin row grants access on either ownership kind", async () => {
    const f = baseFixtures();
    f.eventAdmins.add("user-event:eadmin");
    const prisma = makePrisma(f);
    const { actor } = await requireEventPermission(prisma, {
      authorization: "Bearer eventadmin-token",
      eventId: "user-event",
      action: "update",
    });
    expect(actor.userId).toBe("eadmin");
  });

  test("site admin has absolute control and short-circuits ownership checks", async () => {
    const prisma = makePrisma(baseFixtures());
    for (const eventId of ["user-event", "org-event"]) {
      const { actor } = await requireEventPermission(prisma, {
        authorization: "Bearer site-token",
        eventId,
        action: "delete",
      });
      expect(actor.siteRole).toBe("SITE_ADMIN");
    }
  });

  test("missing event yields not found for non-site-admins", async () => {
    const prisma = makePrisma(baseFixtures());
    await expect(
      requireEventPermission(prisma, {
        authorization: "Bearer owner-token",
        eventId: "ghost",
        action: "read",
      }),
    ).rejects.toThrow(/event not found/);
  });
});

describe("requireSiteAdmin", () => {
  test("permits site administrators", async () => {
    const prisma = makePrisma(baseFixtures());
    const actor = await requireSiteAdmin(prisma, "Bearer site-token");
    expect(actor.siteRole).toBe("SITE_ADMIN");
  });

  test("denies regular users", async () => {
    const prisma = makePrisma(baseFixtures());
    await expect(requireSiteAdmin(prisma, "Bearer owner-token")).rejects.toThrow(
      /site administrator/,
    );
  });
});
