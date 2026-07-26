import { randomUUID } from "node:crypto";
import { api, APIError, Header } from "encore.dev/api";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { requirePermission, requireSiteAdmin, memberRoleCache } from "../auth/rbac";
import { administratorRole, administratorRoleLimit } from "../auth/permissions";
import { StructKeyspace, expireInSeconds } from "encore.dev/storage/cache";
import { cluster } from "../cache";

const teamCache = new StructKeyspace<{ id: string }, Team>(cluster, {
  keyPattern: "team/:id",
  defaultExpiry: expireInSeconds(300), // 5 minutes
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// A team is modelled as a better-auth organization (issue #6). Beyond the core
// organization fields it carries a set of aggregate "container" statistics that
// higher-level ranking features can populate.
export interface TeamStats {
  rankingAverage: number | null;
  pointsAverage: number | null;
  seasonRank: number | null;
  averagePointsPerEvent: number | null;
}

export interface TeamMemberSummary {
  userId: string;
  name: string;
  role: string;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  stats: TeamStats;
  administratorSlotsRemaining: number;
  members: TeamMemberSummary[];
}

interface GetTeamParams {
  id: string;
}

// Returns a team with its members and aggregate statistics.
export const getTeam = api(
  { expose: true, method: "GET", path: "/api/teams/:id" },
  async ({ id }: GetTeamParams): Promise<Team> => {
    const cached = await teamCache.get({ id });
    if (cached !== undefined) {
      return cached;
    }

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!organization) {
      throw APIError.notFound("team not found");
    }

    const team = toTeam(organization);
    await teamCache.set({ id }, team);
    return team;
  },
);

interface UpdateTeamStatsParams {
  id: string;
  authorization: Header<"Authorization">;
  rankingAverage?: number | null;
  pointsAverage?: number | null;
  seasonRank?: number | null;
  averagePointsPerEvent?: number | null;
}

// Updates a team's aggregate statistics. Requires a role with organization
// update permission (administrator) in the target team.
export const updateTeamStats = api(
  { expose: true, auth: true, method: "PATCH", path: "/api/teams/:id/stats" },
  async ({
    id,
    authorization,
    rankingAverage,
    pointsAverage,
    seasonRank,
    averagePointsPerEvent,
  }: UpdateTeamStatsParams): Promise<Team> => {
    await requirePermission(prisma, {
      authorization,
      organizationId: id,
      resource: "organization",
      action: "update",
    });

    const existing = await prisma.organization.findUnique({ where: { id } });
    if (!existing) {
      throw APIError.notFound("team not found");
    }

    const organization = await prisma.organization.update({
      where: { id },
      data: {
        rankingAverage: rankingAverage === undefined ? undefined : rankingAverage,
        pointsAverage: pointsAverage === undefined ? undefined : pointsAverage,
        seasonRank: seasonRank === undefined ? undefined : seasonRank,
        averagePointsPerEvent:
          averagePointsPerEvent === undefined ? undefined : averagePointsPerEvent,
      },
      include: {
        members: {
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    await teamCache.delete({ id });

    return toTeam(organization);
  },
);

type OrganizationWithMembers = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  rankingAverage: number | null;
  pointsAverage: number | null;
  seasonRank: number | null;
  averagePointsPerEvent: number | null;
  members: { userId: string; role: string; user: { name: string } }[];
};

// Lists all teams mapped via toTeam.
export const listTeams = api(
  { expose: true, method: "GET", path: "/api/teams" },
  async (): Promise<{ teams: Team[] }> => {
    const organizations = await prisma.organization.findMany({
      include: {
        members: {
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    return { teams: organizations.map(toTeam) };
  }
);

interface CreateTeamParams {
  authorization: Header<"Authorization">;
  name: string;
  logo?: string | null;
}

// Creates a new team (organization). Gated by site administrator.
export const createTeam = api(
  { expose: true, auth: true, method: "POST", path: "/api/teams" },
  async ({ authorization, name, logo }: CreateTeamParams): Promise<Team> => {
    await requireSiteAdmin(prisma, authorization);

    const slug = slugify(name);
    try {
      const organization = await prisma.organization.create({
        data: {
          id: randomUUID(),
          name,
          slug,
          logo: logo ?? null,
          updatedAt: new Date(),
        },
        include: {
          members: {
            include: { user: { select: { name: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      return toTeam(organization);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw APIError.alreadyExists("team with this slug already exists");
      }
      throw error;
    }
  }
);

interface AddTeamMemberParams {
  id: string;
  authorization: Header<"Authorization">;
  userId: string;
  role?: string;
}

// Registers a participant for a team.
export const addTeamMember = api(
  { expose: true, auth: true, method: "POST", path: "/api/teams/:id/members" },
  async ({ id, authorization, userId, role }: AddTeamMemberParams): Promise<Team> => {
    await requirePermission(prisma, {
      authorization,
      organizationId: id,
      resource: "member",
      action: "create",
    });

    const targetRole = role ?? "member";

    const organization = await prisma.organization.findUnique({ where: { id } });
    if (!organization) {
      throw APIError.notFound("team not found");
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw APIError.notFound("user not found");
    }

    if (targetRole === administratorRole) {
      const adminCount = await prisma.member.count({
        where: { organizationId: id, role: administratorRole },
      });
      if (adminCount >= administratorRoleLimit) {
        throw APIError.failedPrecondition("At most three administrators can belong to an organization.");
      }
    }

    try {
      await prisma.member.create({
        data: {
          id: randomUUID(),
          organizationId: id,
          userId,
          role: targetRole,
        },
      });

      await prisma.organization.update({
        where: { id },
        data: { updatedAt: new Date() },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw APIError.alreadyExists("user is already a member of this team");
      }
      throw error;
    }

    await teamCache.delete({ id });
    await memberRoleCache.delete({ key: `${id}:${userId}` });

    const updatedOrg = await prisma.organization.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!updatedOrg) {
      throw APIError.notFound("team not found");
    }

    return toTeam(updatedOrg);
  }
);

interface UpdateTeamMemberRoleParams {
  id: string;
  userId: string;
  authorization: Header<"Authorization">;
  role: string;
}

// Updates a team member's role.
export const updateTeamMemberRole = api(
  { expose: true, auth: true, method: "PATCH", path: "/api/teams/:id/members/:userId" },
  async ({ id, userId, authorization, role }: UpdateTeamMemberRoleParams): Promise<Team> => {
    await requirePermission(prisma, {
      authorization,
      organizationId: id,
      resource: "member",
      action: "update",
    });

    const existingMember = await prisma.member.findUnique({
      where: { organizationId_userId: { organizationId: id, userId } },
    });
    if (!existingMember) {
      throw APIError.notFound("member not found");
    }

    if (role === administratorRole && existingMember.role !== administratorRole) {
      const adminCount = await prisma.member.count({
        where: { organizationId: id, role: administratorRole },
      });
      if (adminCount >= administratorRoleLimit) {
        throw APIError.failedPrecondition("At most three administrators can belong to an organization.");
      }
    }

    await prisma.member.update({
      where: { organizationId_userId: { organizationId: id, userId } },
      data: { role },
    });

    await prisma.organization.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    await teamCache.delete({ id });
    await memberRoleCache.delete({ key: `${id}:${userId}` });

    const updatedOrg = await prisma.organization.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!updatedOrg) {
      throw APIError.notFound("team not found");
    }

    return toTeam(updatedOrg);
  }
);

interface RemoveTeamMemberParams {
  id: string;
  userId: string;
  authorization: Header<"Authorization">;
}

// Removes a participant from a team.
export const removeTeamMember = api(
  { expose: true, auth: true, method: "DELETE", path: "/teams/:id/members/:userId" },
  async ({ id, userId, authorization }: RemoveTeamMemberParams): Promise<Team> => {
    await requirePermission(prisma, {
      authorization,
      organizationId: id,
      resource: "member",
      action: "delete",
    });

    const existingMember = await prisma.member.findUnique({
      where: { organizationId_userId: { organizationId: id, userId } },
    });
    if (!existingMember) {
      throw APIError.notFound("member not found");
    }

    await prisma.member.delete({
      where: { organizationId_userId: { organizationId: id, userId } },
    });

    await prisma.organization.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    await teamCache.delete({ id });
    await memberRoleCache.delete({ key: `${id}:${userId}` });

    const updatedOrg = await prisma.organization.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!updatedOrg) {
      throw APIError.notFound("team not found");
    }

    return toTeam(updatedOrg);
  }
);

function toTeam(organization: OrganizationWithMembers): Team {
  const administratorCount = organization.members.filter(
    (member) => member.role === administratorRole,
  ).length;

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    logo: organization.logo,
    stats: {
      rankingAverage: organization.rankingAverage,
      pointsAverage: organization.pointsAverage,
      seasonRank: organization.seasonRank,
      averagePointsPerEvent: organization.averagePointsPerEvent,
    },
    administratorSlotsRemaining: Math.max(
      administratorRoleLimit - administratorCount,
      0,
    ),
    members: organization.members.map((member) => ({
      userId: member.userId,
      name: member.user.name,
      role: member.role,
    })),
  };
}
