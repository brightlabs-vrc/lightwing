import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, test } from "vitest";
import { prisma } from "./prisma";
import { getTeam, listTeams, createTeam } from "./teams";
import { updateTeamStats } from "./team-stats";
import { addTeamMember, updateTeamMemberRole, removeTeamMember } from "./team-members";

const createdUserIds: string[] = [];
const createdOrganizationIds: string[] = [];
const createdSessionTokens: string[] = [];

async function createOrgWithMembers(
  options?: {
    members?: Array<{ userId: string; role: string; name: string }>;
    id?: string;
    name?: string;
    slug?: string;
  },
) {
  const id = options?.id ?? `org-${randomUUID()}`;
  const name = options?.name ?? `Team ${id}`;
  const slug = options?.slug ?? `${id.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  const organization = await prisma.organization.create({
    data: {
      id,
      name,
      slug,
    },
  });

  createdOrganizationIds.push(id);

  const members = options?.members ?? [];
  for (const member of members) {
    const userId = member.userId;
    await prisma.user.create({
      data: {
        id: userId,
        name: member.name,
        email: `${userId}@example.com`,
      },
    });
    createdUserIds.push(userId);

    await prisma.member.create({
      data: {
        id: `member-${randomUUID()}`,
        organizationId: organization.id,
        userId,
        role: member.role,
      },
    });
  }

  return organization;
}

async function createSession(userId: string) {
  const token = `token-${randomUUID()}`;
  createdSessionTokens.push(token);

  await prisma.session.create({
    data: {
      id: `session-${randomUUID()}`,
      token,
      userId,
      expiresAt: new Date(Date.now() + 60_000 * 60),
    },
  });

  return token;
}

afterEach(async () => {
  if (createdSessionTokens.length > 0) {
    await prisma.session.deleteMany({ where: { token: { in: createdSessionTokens } } });
    createdSessionTokens.length = 0;
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

describe("teammanager endpoints", () => {
  test("getTeam returns mapped team with member summaries and stats", async () => {
    const organization = await createOrgWithMembers({
      id: "org-get-team",
      name: "Sky Team",
      slug: "sky-team",
      members: [
        { userId: "user-aster", role: "administrator", name: "Aster" },
        { userId: "user-blake", role: "administrator", name: "Blake" },
        { userId: "user-casey", role: "member", name: "Casey" },
      ],
    });

    await prisma.organization.update({
      where: { id: organization.id },
      data: {
        rankingAverage: 4.2,
        pointsAverage: 91.5,
        seasonRank: 7,
        averagePointsPerEvent: 14.3,
      },
    });

    const team = await getTeam({ id: organization.id });

    expect(team).toEqual({
      id: organization.id,
      name: "Sky Team",
      slug: "sky-team",
      logo: null,
      stats: {
        rankingAverage: 4.2,
        pointsAverage: 91.5,
        seasonRank: 7,
        averagePointsPerEvent: 14.3,
      },
      administratorSlotsRemaining: 1,
      members: [
        { userId: "user-aster", name: "Aster", role: "administrator" },
        { userId: "user-blake", name: "Blake", role: "administrator" },
        { userId: "user-casey", name: "Casey", role: "member" },
      ],
    });
  });

  test("getTeam caps administratorSlotsRemaining at zero", async () => {
    await createOrgWithMembers({
      id: "org-admin-slots",
      name: "Admin Heavy Team",
      slug: "admin-heavy-team",
      members: [
        { userId: "user-admin-1", role: "administrator", name: "Admin One" },
        { userId: "user-admin-2", role: "administrator", name: "Admin Two" },
        { userId: "user-admin-3", role: "administrator", name: "Admin Three" },
        { userId: "user-admin-4", role: "administrator", name: "Admin Four" },
      ],
    });

    const team = await getTeam({ id: "org-admin-slots" });
    expect(team.administratorSlotsRemaining).toBe(0);
  });

  test("getTeam throws not found when organization is missing", async () => {
    await expect(getTeam({ id: "missing-org" })).rejects.toMatchObject({
      code: "not_found",
      message: "team not found",
    });
  });

  test("updateTeamStats enforces permission and updates only provided fields", async () => {
    const organization = await createOrgWithMembers({
      id: "org-update-team",
      name: "Update Team",
      slug: "update-team",
      members: [{ userId: "user-updater", role: "administrator", name: "Updater" }],
    });
    const sessionToken = await createSession("user-updater");

    const team = await updateTeamStats({
      id: organization.id,
      authorization: `Bearer ${sessionToken}`,
      rankingAverage: 5.5,
      pointsAverage: 99.1,
      seasonRank: null,
    });

    expect(team.stats).toEqual({
      rankingAverage: 5.5,
      pointsAverage: 99.1,
      seasonRank: null,
      averagePointsPerEvent: null,
    });
  });

  test("updateTeamStats throws not found and does not update a missing organization", async () => {
    await prisma.user.create({
      data: {
        id: "site-admin-missing-org",
        name: "Missing Org Site Admin",
        email: "site-admin-missing-org@example.com",
        siteRole: "SITE_ADMIN",
      },
    });
    createdUserIds.push("site-admin-missing-org");
    const sessionToken = await createSession("site-admin-missing-org");

    await expect(
      updateTeamStats({
        id: "missing-org",
        authorization: `Bearer ${sessionToken}`,
        pointsAverage: 12.3,
      }),
    ).rejects.toMatchObject({
      code: "not_found",
      message: "team not found",
    });
  });

  test("createTeam successfully creates team and listTeams lists them", async () => {
    await prisma.user.create({
      data: {
        id: "site-admin-create-team",
        name: "Create Team Site Admin",
        email: "site-admin-create-team@example.com",
        siteRole: "SITE_ADMIN",
      },
    });
    createdUserIds.push("site-admin-create-team");
    const sessionToken = await createSession("site-admin-create-team");

    const team = await createTeam({
      authorization: `Bearer ${sessionToken}`,
      name: "Alpha Racing Syndicate",
    });
    createdOrganizationIds.push(team.id);

    expect(team.name).toBe("Alpha Racing Syndicate");
    expect(team.slug).toBe("alpha-racing-syndicate");

    const { teams } = await listTeams();
    const createdTeamInList = teams.find((t) => t.id === team.id);
    expect(createdTeamInList).toBeDefined();
    expect(createdTeamInList?.slug).toBe("alpha-racing-syndicate");
  });

  test("createTeam rejects non-site-admins", async () => {
    await prisma.user.create({
      data: {
        id: "regular-user-create-team",
        name: "Regular User",
        email: "regular-user@example.com",
        siteRole: "USER",
      },
    });
    createdUserIds.push("regular-user-create-team");
    const sessionToken = await createSession("regular-user-create-team");

    await expect(
      createTeam({
        authorization: `Bearer ${sessionToken}`,
        name: "Forbidden Team",
      })
    ).rejects.toMatchObject({
      code: "permission_denied",
    });
  });

  test("createTeam slug collision yields already_exists", async () => {
    await prisma.user.create({
      data: {
        id: "site-admin-col",
        name: "Create Team Site Admin",
        email: "site-admin-col@example.com",
        siteRole: "SITE_ADMIN",
      },
    });
    createdUserIds.push("site-admin-col");
    const sessionToken = await createSession("site-admin-col");

    const team1 = await createTeam({
      authorization: `Bearer ${sessionToken}`,
      name: "Collision Team",
    });
    createdOrganizationIds.push(team1.id);

    await expect(
      createTeam({
        authorization: `Bearer ${sessionToken}`,
        name: "Collision Team",
      })
    ).rejects.toMatchObject({
      code: "already_exists",
    });
  });

  test("addTeamMember, updateTeamMemberRole, and removeTeamMember endpoints and limitations", async () => {
    const org = await createOrgWithMembers({
      id: "org-members-mgmt",
      name: "Members Management Team",
      slug: "members-mgmt-team",
      members: [
        { userId: "member-admin-1", role: "administrator", name: "Admin One" },
        { userId: "member-admin-2", role: "administrator", name: "Admin Two" },
      ],
    });

    const adminToken = await createSession("member-admin-1");

    await prisma.user.create({
      data: {
        id: "user-new-member",
        name: "New Member",
        email: "new-member@example.com",
      },
    });
    createdUserIds.push("user-new-member");

    // Add member
    const teamAfterAdd = await addTeamMember({
      id: org.id,
      authorization: `Bearer ${adminToken}`,
      userId: "user-new-member",
      role: "member",
    });

    expect(teamAfterAdd.members.some((m) => m.userId === "user-new-member" && m.role === "member")).toBe(true);

    // Add duplicate member yields already_exists
    await expect(
      addTeamMember({
        id: org.id,
        authorization: `Bearer ${adminToken}`,
        userId: "user-new-member",
        role: "member",
      })
    ).rejects.toMatchObject({
      code: "already_exists",
    });

    // Enforce administrator limit when adding (adminSlotsRemaining is currently 1)
    await prisma.user.create({
      data: {
        id: "user-new-admin-1",
        name: "New Admin One",
        email: "new-admin-1@example.com",
      },
    });
    createdUserIds.push("user-new-admin-1");

    await addTeamMember({
      id: org.id,
      authorization: `Bearer ${adminToken}`,
      userId: "user-new-admin-1",
      role: "administrator",
    });

    // Try to add fourth administrator
    await prisma.user.create({
      data: {
        id: "user-new-admin-2",
        name: "New Admin Two",
        email: "new-admin-2@example.com",
      },
    });
    createdUserIds.push("user-new-admin-2");

    await expect(
      addTeamMember({
        id: org.id,
        authorization: `Bearer ${adminToken}`,
        userId: "user-new-admin-2",
        role: "administrator",
      })
    ).rejects.toMatchObject({
      code: "failed_precondition",
    });

    // Update team member role
    const teamAfterUpdate = await updateTeamMemberRole({
      id: org.id,
      authorization: `Bearer ${adminToken}`,
      userId: "user-new-member",
      role: "organizationAdministrator",
    });

    expect(teamAfterUpdate.members.some((m) => m.userId === "user-new-member" && m.role === "organizationAdministrator")).toBe(true);

    // Try to update role to administrator when cap is reached
    await expect(
      updateTeamMemberRole({
        id: org.id,
        authorization: `Bearer ${adminToken}`,
        userId: "user-new-member",
        role: "administrator",
      })
    ).rejects.toMatchObject({
      code: "failed_precondition",
    });

    // Remove team member
    const teamAfterRemove = await removeTeamMember({
      id: org.id,
      authorization: `Bearer ${adminToken}`,
      userId: "user-new-member",
    });

    expect(teamAfterRemove.members.some((m) => m.userId === "user-new-member")).toBe(false);
  });
});
