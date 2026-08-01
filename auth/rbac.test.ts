import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, test } from "vitest";
import { prisma } from "./prisma";
import { requireEventPermission, requireSiteAdmin } from "./rbac";

const createdUserIds: string[] = [];
const createdOrganizationIds: string[] = [];
const createdSessionTokens: string[] = [];
const createdEventIds: string[] = [];

async function createUser(id: string, name: string, siteRole: "USER" | "SITE_ADMIN" = "USER") {
  await prisma.user.create({
    data: {
      id,
      name,
      email: `${id}@example.com`,
      siteRole,
    },
  });
  createdUserIds.push(id);
  return id;
}

async function createSession(userId: string, token?: string) {
  const sessionToken = token ?? `token-${randomUUID()}`;
  await prisma.session.create({
    data: {
      id: `session-${randomUUID()}`,
      token: sessionToken,
      userId,
      expiresAt: new Date(Date.now() + 60_000 * 60),
    },
  });
  createdSessionTokens.push(sessionToken);
  return sessionToken;
}

async function createOrganization(id: string, name: string) {
  await prisma.organization.create({
    data: {
      id,
      name,
      slug: `${id.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    },
  });
  createdOrganizationIds.push(id);
  return id;
}

async function createMember(organizationId: string, userId: string, role: string) {
  await prisma.member.create({
    data: {
      id: `member-${randomUUID()}`,
      organizationId,
      userId,
      role,
    },
  });
}

async function createEvent(id: string, options: { ownerType: "USER" | "ORGANIZATION"; ownerUserId?: string | null; organizationId?: string | null }) {
  await prisma.event.create({
    data: {
      id,
      name: `Event ${id}`,
      ownerType: options.ownerType,
      ownerUserId: options.ownerUserId ?? null,
      organizationId: options.organizationId ?? null,
      scoringType: 1,
    },
  });
  createdEventIds.push(id);
}

async function createEventAdmin(eventId: string, userId: string) {
  await prisma.eventAdmin.create({
    data: {
      id: `event-admin-${randomUUID()}`,
      eventId,
      userId,
    },
  });
}

afterEach(async () => {
  if (createdSessionTokens.length > 0) {
    await prisma.session.deleteMany({ where: { token: { in: createdSessionTokens } } });
    createdSessionTokens.length = 0;
  }

  if (createdEventIds.length > 0) {
    await prisma.eventAdmin.deleteMany({ where: { eventId: { in: createdEventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } });
    createdEventIds.length = 0;
  }

  if (createdOrganizationIds.length > 0) {
    await prisma.member.deleteMany({ where: { organizationId: { in: createdOrganizationIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: createdOrganizationIds } } });
    createdOrganizationIds.length = 0;
  }

  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
});

describe("requireEventPermission", () => {
  test("user-owned: the owner has full control", async () => {
    await createUser("owner", "Owner");
    await createEvent("user-event", { ownerType: "USER", ownerUserId: "owner" });
    const token = await createSession("owner");

    const { actor } = await requireEventPermission(prisma, {
      authorization: `Bearer ${token}`,
      eventId: "user-event",
      action: "update",
    });
    expect(actor.userId).toBe("owner");
  });

  test("user-owned: a stranger is denied", async () => {
    await createUser("owner", "Owner");
    await createUser("stranger", "Stranger");
    await createEvent("user-event", { ownerType: "USER", ownerUserId: "owner" });
    const token = await createSession("stranger");

    await expect(
      requireEventPermission(prisma, {
        authorization: `Bearer ${token}`,
        eventId: "user-event",
        action: "update",
      }),
    ).rejects.toThrow(/not permitted/);
  });

  test("org-owned: an org administrator is allowed via the RBAC matrix", async () => {
    await createUser("orgadmin", "Org Admin");
    const orgId = await createOrganization("org1", "Org One");
    await createMember(orgId, "orgadmin", "administrator");
    await createEvent("org-event", { ownerType: "ORGANIZATION", organizationId: orgId });
    const token = await createSession("orgadmin");

    const { actor } = await requireEventPermission(prisma, {
      authorization: `Bearer ${token}`,
      eventId: "org-event",
      action: "delete",
    });
    expect(actor.userId).toBe("orgadmin");
  });

  test("org-owned: a non-member is denied", async () => {
    await createUser("stranger", "Stranger");
    const orgId = await createOrganization("org2", "Org Two");
    await createEvent("org-event", { ownerType: "ORGANIZATION", organizationId: orgId });
    const token = await createSession("stranger");

    await expect(
      requireEventPermission(prisma, {
        authorization: `Bearer ${token}`,
        eventId: "org-event",
        action: "update",
      }),
    ).rejects.toThrow(/not permitted/);
  });

  test("explicit EventAdmin row grants access on either ownership kind", async () => {
    await createUser("eadmin", "Event Admin");
    await createUser("owner", "Owner");
    await createEvent("user-event", { ownerType: "USER", ownerUserId: "owner" });
    await createEventAdmin("user-event", "eadmin");
    const token = await createSession("eadmin");

    const { actor } = await requireEventPermission(prisma, {
      authorization: `Bearer ${token}`,
      eventId: "user-event",
      action: "update",
    });
    expect(actor.userId).toBe("eadmin");
  });

  test("site admin has absolute control and short-circuits ownership checks", async () => {
    await createUser("root", "Root", "SITE_ADMIN");
    await createUser("other", "Other User");
    const orgId = await createOrganization("existing-org", "Existing Org");
    await createEvent("user-event", { ownerType: "USER", ownerUserId: "other" });
    await createEvent("org-event", { ownerType: "ORGANIZATION", organizationId: orgId });
    const token = await createSession("root");

    for (const eventId of ["user-event", "org-event"]) {
      const { actor } = await requireEventPermission(prisma, {
        authorization: `Bearer ${token}`,
        eventId,
        action: "delete",
      });
      expect(actor.siteRole).toBe("SITE_ADMIN");
    }
  });

  test("missing event yields not found for non-site-admins", async () => {
    await createUser("owner", "Owner");
    const token = await createSession("owner");

    await expect(
      requireEventPermission(prisma, {
        authorization: `Bearer ${token}`,
        eventId: "ghost",
        action: "read",
      }),
    ).rejects.toThrow(/event not found/);
  });
});

describe("requireSiteAdmin", () => {
  test("permits site administrators", async () => {
    await createUser("root", "Root", "SITE_ADMIN");
    const token = await createSession("root");

    const actor = await requireSiteAdmin(prisma, `Bearer ${token}`);
    expect(actor.siteRole).toBe("SITE_ADMIN");
  });

  test("denies regular users", async () => {
    await createUser("owner", "Owner");
    const token = await createSession("owner");

    await expect(requireSiteAdmin(prisma, `Bearer ${token}`)).rejects.toThrow(
      /site administrator/,
    );
  });
});
