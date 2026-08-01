import { randomUUID } from "node:crypto";
import { api, APIError, Header } from "encore.dev/api";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { requireSiteAdmin } from "../auth/rbac";
import { StructKeyspace, expireInSeconds } from "encore.dev/storage/cache";
import { cluster } from "../cache";
import { ADMINISTRATOR_ROLE, ADMINISTRATOR_ROLE_LIMIT } from "../lib/constants";

export const TEAM_WITH_MEMBERS_INCLUDE = {
  members: {
    include: { user: { select: { name: true } } },
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
      include: TEAM_WITH_MEMBERS_INCLUDE,
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
      name: member.user.name,
      role: member.role,
    })),
  };
}
