import { randomUUID } from "node:crypto";
import { api, APIError, Header, Query } from "encore.dev/api";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { requireSiteAdmin, requirePermission, resolveActor } from "../auth/rbac";
import { isSiteAdmin } from "../auth/permissions";
import { isValidSlug } from "../lib/slugs";
import { StructKeyspace, expireInSeconds } from "encore.dev/storage/cache";
import { cluster } from "../cache";
import { ADMINISTRATOR_ROLE, ADMINISTRATOR_ROLE_LIMIT } from "../lib/constants";

export const TEAM_WITH_MEMBERS_INCLUDE = {
  members: {
    include: { user: { select: { name: true, vrchatUsername: true } } },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.OrganizationInclude;

export const teamCache = new StructKeyspace<{ id: string }, Team>(cluster, {
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

export interface TeamListItem {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  administratorSlotsRemaining: number;
  memberCount: number;
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
      include: TEAM_WITH_MEMBERS_INCLUDE,
    });

    if (!organization) {
      throw APIError.notFound("team not found");
    }

    const team = toTeam(organization);
    await teamCache.set({ id }, team);
    return team;
  },
);

interface GetTeamBySlugParams {
  slug: string;
}

// Returns a team by its unique slug.
export const getTeamBySlug = api(
  { expose: true, method: "GET", path: "/api/teams/by-slug/:slug" },
  async ({ slug }: GetTeamBySlugParams): Promise<Team> => {
    const organization = await prisma.organization.findUnique({
      where: { slug },
      include: TEAM_WITH_MEMBERS_INCLUDE,
    });

    if (!organization) {
      throw APIError.notFound("team not found");
    }

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
  members: { id: string; userId: string; role: string; user: { name: string; vrchatUsername: string | null } }[];
};

interface ListTeamsParams {
  search?: Query<string>;
  limit?: Query<number>;
  offset?: Query<number>;
}

interface ListTeamsResponse {
  teams: TeamListItem[];
  total: number;
}

// Lists all teams with search and pagination support.
export const listTeams = api(
  { expose: true, method: "GET", path: "/api/teams" },
  async (params: ListTeamsParams): Promise<ListTeamsResponse> => {
    const { search, limit, offset } = params || {};
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ];
    }

    const total = await prisma.organization.count({ where });

    const organizations = await prisma.organization.findMany({
      where,
      take: limit ?? undefined,
      skip: offset ?? undefined,
      include: {
        members: {
          select: { role: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const teams = organizations.map((org) => {
      const administratorCount = org.members.filter(
        (member) => member.role === ADMINISTRATOR_ROLE,
      ).length;

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logo: org.logo,
        administratorSlotsRemaining: Math.max(
          ADMINISTRATOR_ROLE_LIMIT - administratorCount,
          0,
        ),
        memberCount: org.members.length,
      };
    });

    return { teams, total };
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
        include: TEAM_WITH_MEMBERS_INCLUDE,
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

export function toTeam(organization: OrganizationWithMembers): Team {
  const administratorCount = organization.members.filter(
    (member) => member.role === ADMINISTRATOR_ROLE,
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
      ADMINISTRATOR_ROLE_LIMIT - administratorCount,
      0,
    ),
    members: organization.members.map((member) => ({
      userId: member.userId,
      name: member.user.vrchatUsername ?? member.user.name,
      role: member.role,
    })),
  };
}

interface UpdateTeamParams {
  id: string;
  authorization: Header<"Authorization">;
  name?: string;
  slug?: string;
  logo?: string | null;
}

// Updates a team's core metadata (name, slug, logo).
// Accessible to team administrators (via organization update permission) or site administrators.
export const updateTeam = api(
  { expose: true, auth: true, method: "PATCH", path: "/api/teams/:id" },
  async ({
    id,
    authorization,
    name,
    slug,
    logo,
  }: UpdateTeamParams): Promise<Team> => {
    const actor = await resolveActor(prisma, authorization);
    const hasOrgUpdatePermission = async () => {
      try {
        await requirePermission(prisma, {
          authorization,
          organizationId: id,
          resource: "organization",
          action: "update",
        });
        return true;
      } catch {
        return false;
      }
    };

    if (!isSiteAdmin(actor.siteRole) && !(await hasOrgUpdatePermission())) {
      throw APIError.permissionDenied("cannot update team metadata");
    }

    const existing = await prisma.organization.findUnique({ where: { id } });
    if (!existing) {
      throw APIError.notFound("team not found");
    }

    let nextSlug = existing.slug;
    if (slug !== undefined && slug !== existing.slug) {
      if (!isValidSlug(slug)) {
        throw APIError.invalidArgument("invalid slug format or length");
      }
      const collision = await prisma.organization.findUnique({ where: { slug } });
      if (collision) {
        throw APIError.alreadyExists("team slug is already in use");
      }
      nextSlug = slug;
    }

    const organization = await prisma.organization.update({
      where: { id },
      data: {
        name: name ?? undefined,
        slug: nextSlug,
        logo: logo === undefined ? undefined : logo,
        updatedAt: new Date(),
      },
      include: TEAM_WITH_MEMBERS_INCLUDE,
    });

    await teamCache.delete({ id });

    return toTeam(organization);
  },
);
