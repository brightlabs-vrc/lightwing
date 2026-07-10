import { api, APIError, Header } from "encore.dev/api";
import { prisma } from "./prisma";
import { requirePermission } from "../auth/rbac";
import { administratorRole, administratorRoleLimit } from "../auth/permissions";

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
  { expose: true, method: "GET", path: "/teams/:id" },
  async ({ id }: GetTeamParams): Promise<Team> => {
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

    return toTeam(organization);
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
  { expose: true, method: "PATCH", path: "/teams/:id/stats" },
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
