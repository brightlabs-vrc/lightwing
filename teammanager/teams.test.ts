import { describe, expect, test, beforeEach, vi } from "vitest";

const {
  mockFindUnique,
  mockUpdate,
  mockRequirePermission,
} = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockRequirePermission: vi.fn(),
}));

vi.mock("./prisma", () => ({
  prisma: {
    organization: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}));

vi.mock("../auth/rbac", () => ({
  requirePermission: mockRequirePermission,
}));

import { getTeam, updateTeamStats } from "./teams";

function makeOrganization(
  overrides: Partial<{
    id: string;
    name: string;
    slug: string;
    logo: string | null;
    rankingAverage: number | null;
    pointsAverage: number | null;
    seasonRank: number | null;
    averagePointsPerEvent: number | null;
    members: { userId: string; role: string; user: { name: string } }[];
  }> = {},
) {
  return {
    id: "org-1",
    name: "Sky Team",
    slug: "sky-team",
    logo: null,
    rankingAverage: 4.2,
    pointsAverage: 91.5,
    seasonRank: 7,
    averagePointsPerEvent: 14.3,
    members: [
      { userId: "u-1", role: "administrator", user: { name: "Aster" } },
      { userId: "u-2", role: "administrator", user: { name: "Blake" } },
      { userId: "u-3", role: "member", user: { name: "Casey" } },
    ],
    ...overrides,
  };
}

describe("teammanager endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("getTeam returns mapped team with member summaries and stats", async () => {
    mockFindUnique.mockResolvedValueOnce(makeOrganization());

    const team = await getTeam({ id: "org-1" });

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "org-1" },
      include: {
        members: {
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    expect(team).toEqual({
      id: "org-1",
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
        { userId: "u-1", name: "Aster", role: "administrator" },
        { userId: "u-2", name: "Blake", role: "administrator" },
        { userId: "u-3", name: "Casey", role: "member" },
      ],
    });
  });

  test("getTeam caps administratorSlotsRemaining at zero", async () => {
    mockFindUnique.mockResolvedValueOnce(
      makeOrganization({
        members: [
          { userId: "u-1", role: "administrator", user: { name: "A" } },
          { userId: "u-2", role: "administrator", user: { name: "B" } },
          { userId: "u-3", role: "administrator", user: { name: "C" } },
          { userId: "u-4", role: "administrator", user: { name: "D" } },
        ],
      }),
    );

    const team = await getTeam({ id: "org-1" });
    expect(team.administratorSlotsRemaining).toBe(0);
  });

  test("getTeam throws not found when organization is missing", async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    await expect(getTeam({ id: "missing" })).rejects.toMatchObject({
      code: "not_found",
      message: "team not found",
    });
  });

  test("updateTeamStats enforces permission and updates only provided fields", async () => {
    const existing = makeOrganization();
    const updated = makeOrganization({
      rankingAverage: 5.5,
      pointsAverage: 99.1,
      seasonRank: null,
      averagePointsPerEvent: 18.2,
    });

    mockFindUnique.mockResolvedValueOnce(existing);
    mockUpdate.mockResolvedValueOnce(updated);
    mockRequirePermission.mockResolvedValueOnce({
      actor: { userId: "u-1", activeOrganizationId: null, siteRole: "USER" },
      role: "administrator",
    });

    const team = await updateTeamStats({
      id: "org-1",
      authorization: "Bearer token-1",
      rankingAverage: 5.5,
      pointsAverage: 99.1,
      seasonRank: null,
    });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      expect.anything(),
      {
        authorization: "Bearer token-1",
        organizationId: "org-1",
        resource: "organization",
        action: "update",
      },
    );

    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "org-1" } });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: {
        rankingAverage: 5.5,
        pointsAverage: 99.1,
        seasonRank: null,
        averagePointsPerEvent: undefined,
      },
      include: {
        members: {
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    expect(team.stats).toEqual({
      rankingAverage: 5.5,
      pointsAverage: 99.1,
      seasonRank: null,
      averagePointsPerEvent: 18.2,
    });
  });

  test("updateTeamStats throws not found and does not update a missing organization", async () => {
    mockRequirePermission.mockResolvedValueOnce({
      actor: { userId: "u-1", activeOrganizationId: null, siteRole: "USER" },
      role: "administrator",
    });
    mockFindUnique.mockResolvedValueOnce(null);

    await expect(
      updateTeamStats({
        id: "missing",
        authorization: "Bearer token-1",
        pointsAverage: 12.3,
      }),
    ).rejects.toMatchObject({
      code: "not_found",
      message: "team not found",
    });

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
