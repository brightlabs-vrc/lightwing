import { api, APIError, Header } from "encore.dev/api";
import { prisma } from "./prisma";
import { requirePermission } from "../auth/rbac";
import { toTeam, teamCache, TEAM_WITH_MEMBERS_INCLUDE, type Team } from "./teams";

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
      include: TEAM_WITH_MEMBERS_INCLUDE,
    });

    await teamCache.delete({ id });

    return toTeam(organization);
  },
);
