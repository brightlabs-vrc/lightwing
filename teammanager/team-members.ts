import { randomUUID } from "node:crypto";
import { api, APIError, Header, Query } from "encore.dev/api";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { requirePermission, memberRoleCache } from "../auth/rbac";
import { toTeam, teamCache, TEAM_WITH_MEMBERS_INCLUDE, type Team } from "./teams";
import { assertAdminCapNotReached } from "./team-guards";
import { ADMINISTRATOR_ROLE } from "../lib/constants";

interface ListTeamMembersParams {
  id: string;
  search?: Query<string>;
  limit?: Query<number>;
  offset?: Query<number>;
}

interface ListTeamMembersResponse {
  members: Array<{
    userId: string;
    name: string;
    slug: string | null;
    role: string;
  }>;
  total: number;
}

// Lists members of a team with search and pagination. Publicly accessible.
export const listTeamMembers = api(
  { expose: true, method: "GET", path: "/api/teams/:id/members" },
  async ({ id, search, limit, offset }: ListTeamMembersParams): Promise<ListTeamMembersResponse> => {
    const where: any = { organizationId: id };
    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { vrchatUsername: { contains: search, mode: "insensitive" } },
          { slug: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const total = await prisma.member.count({ where });

    const members = await prisma.member.findMany({
      where,
      take: limit ?? undefined,
      skip: offset ?? undefined,
      include: {
        user: {
          select: {
            name: true,
            vrchatUsername: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return {
      members: members.map((m) => ({
        userId: m.userId,
        name: m.user.vrchatUsername ?? m.user.name,
        slug: m.user.slug,
        role: m.role,
      })),
      total,
    };
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

    if (targetRole === ADMINISTRATOR_ROLE) {
      await assertAdminCapNotReached(id);
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
      include: TEAM_WITH_MEMBERS_INCLUDE,
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

    if (role === ADMINISTRATOR_ROLE && existingMember.role !== ADMINISTRATOR_ROLE) {
      await assertAdminCapNotReached(id);
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
      include: TEAM_WITH_MEMBERS_INCLUDE,
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
      include: TEAM_WITH_MEMBERS_INCLUDE,
    });

    if (!updatedOrg) {
      throw APIError.notFound("team not found");
    }

    return toTeam(updatedOrg);
  }
);
