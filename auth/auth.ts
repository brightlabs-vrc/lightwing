import { APIError, betterAuth, type Auth } from "better-auth";
import { createAccessControl, multiSession, organization } from "better-auth/plugins";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { Prisma } from "@prisma/client";
import { REST, Routes } from "discord.js";
import type { APIGuildMember, APIRole } from "discord-api-types/v10";
import { secret } from "encore.dev/config";
import { appMeta } from "encore.dev";
import { prisma } from "./prisma";
import {
  administratorRole,
  administratorRoleLimit,
  roleStatements,
} from "./permissions";

// Store secrets using the Encore CLI:
//   encore secret set --type dev,local,pr,production AuthSecret
// Generate a strong value with: openssl rand -base64 32
const authSecret = secret("AuthSecret");
const discordClientId = secret("DiscordClientId");
const discordClientSecret = secret("DiscordClientSecret");
const discordBotToken = secret("DiscordBotToken");

const ursDiscordGuildId = "1482993434410225739";
const siteAdminRole = "SITE_ADMIN";
const staffRoleNames = new Set([
  "Moderation Staff",
  "Lead Staff",
  "Event Staff",
  "Competitive Integrity Administration Staff",
]);
const staffRoleCacheTtlMs = 5 * 60 * 1000;

const discordBotRestClient = new REST({ version: "10" }).setToken(discordBotToken());

let cachedDiscordStaffRoleIds: { ids: Set<string>; expiresAt: number } | null = null;

const accessControl = createAccessControl({
  organization: ["read", "update", "delete"],
  member: ["read", "create", "update", "delete"],
  invitation: ["read", "create", "update", "delete"],
  event: ["read", "create", "update", "delete"],
  raceEvent: ["read", "create", "update", "delete"],
  raceResult: ["read", "create", "update", "delete"],
});

// Build the better-auth roles from the shared permission matrix so the access
// control policy stays in sync with the checks performed by other services.
const roles = {
  administrator: accessControl.newRole({ ...roleStatements.administrator }),
  eventAdministrator: accessControl.newRole({ ...roleStatements.eventAdministrator }),
  organizationAdministrator: accessControl.newRole({ ...roleStatements.organizationAdministrator }),
  member: accessControl.newRole({ ...roleStatements.member }),
};

function isAdministratorRole(role: string) {
  return role === administratorRole;
}

async function countAdministrators(excludeMemberId?: string) {
  const excludedMemberClause = excludeMemberId
    ? Prisma.sql`AND "id" <> ${excludeMemberId}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "member"
    WHERE "role" = ${administratorRole}
    ${excludedMemberClause}
  `;

  return Number(rows[0]?.count ?? 0n);
}

function resolveStaffRoleIds(roles: APIRole[]): Set<string> {
  return new Set(roles.filter((role) => staffRoleNames.has(role.name)).map((role) => role.id));
}

async function getDiscordStaffRoleIds() {
  if (cachedDiscordStaffRoleIds && cachedDiscordStaffRoleIds.expiresAt > Date.now()) {
    return cachedDiscordStaffRoleIds.ids;
  }

  let roles: APIRole[];
  try {
    roles = (await discordBotRestClient.get(Routes.guildRoles(ursDiscordGuildId))) as APIRole[];
  } catch (error) {
    throw APIError.fromStatus("INTERNAL_SERVER_ERROR", {
      message: "failed to fetch Discord guild roles",
    });
  }

  const ids = resolveStaffRoleIds(roles);
  cachedDiscordStaffRoleIds = {
    ids,
    expiresAt: Date.now() + staffRoleCacheTtlMs,
  };
  return ids;
}

async function getDiscordGuildMember(accessToken: string): Promise<APIGuildMember | null> {
  const discordUserRestClient = new REST({
    version: "10",
    authPrefix: "Bearer",
  }).setToken(accessToken);

  try {
    return (await discordUserRestClient.get(
      Routes.userGuildMember(ursDiscordGuildId),
    )) as APIGuildMember;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof error.status === "number" &&
      [401, 403, 404].includes(error.status)
    ) {
      return null;
    }

    throw APIError.fromStatus("INTERNAL_SERVER_ERROR", {
      message: "failed to verify Discord guild membership",
    });
  }
}

async function isBootstrapSiteAdminUser(userId: string) {
  const firstUser = await prisma.user.findFirst({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  return firstUser?.id === userId;
}

async function syncSiteRoleFromDiscordMembership(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "discord" },
    orderBy: { updatedAt: "desc" },
    select: { accessToken: true },
  });

  if (!account?.accessToken) {
    throw APIError.fromStatus("UNAUTHORIZED", {
      message: "discord sign-in is required",
    });
  }

  const member = await getDiscordGuildMember(account.accessToken);
  if (!member) {
    throw APIError.fromStatus("FORBIDDEN", {
      message: "you must be a member of the URS Discord server",
    });
  }

  const [staffRoleIds, isBootstrapUser, currentUser] = await Promise.all([
    getDiscordStaffRoleIds(),
    isBootstrapSiteAdminUser(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { siteRole: true } }),
  ]);

  const hasStaffRole = member.roles.some((roleId: string) => staffRoleIds.has(roleId));
  const nextSiteRole = isBootstrapUser || hasStaffRole ? siteAdminRole : "USER";

  if (currentUser && currentUser.siteRole !== nextSiteRole) {
    await prisma.user.update({
      where: { id: userId },
      data: { siteRole: nextSiteRole },
    });
  }
}

const authOptions: Parameters<typeof betterAuth>[0] = {
  secret: authSecret(),
  baseURL: appMeta().apiBaseUrl,
  basePath: "/api/auth",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  trustedOrigins: [
    "http://localhost:4000",
    "http://localhost:3000",
    "http://localhost:5173",
    // This is dynamically set by the Encore platform when the app is deployed, so we don't hardcode it here. It is used to allow the frontend to call the backend API from a different origin.
    appMeta().apiBaseUrl,
  ],
  emailAndPassword: {
    enabled: false,
  },
  socialProviders: {
    discord: {
      clientId: discordClientId(),
      clientSecret: discordClientSecret(),
      scope: ["identify", "email", "guilds", "guilds.members.read"],
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const existingUsers = await prisma.user.count();
          if (existingUsers > 0) {
            return;
          }

          return {
            data: {
              ...user,
              siteRole: siteAdminRole,
            },
          };
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          await syncSiteRoleFromDiscordMembership(session.userId);
        },
      },
    },
  },
  plugins: [
    organization({
      creatorRole: administratorRole,
      roles,
      organizationHooks: {
        beforeAddMember: async ({ member }) => {
          if (!isAdministratorRole(member.role)) {
            return;
          }

          const currentAdministrators = await countAdministrators();
          if (currentAdministrators >= administratorRoleLimit) {
            throw APIError.fromStatus("BAD_REQUEST", {
              message: "At most three administrators can belong to an organization.",
            });
          }
        },
        beforeCreateInvitation: async ({ invitation }) => {
          if (!isAdministratorRole(invitation.role)) {
            return;
          }

          const currentAdministrators = await countAdministrators();
          if (currentAdministrators >= administratorRoleLimit) {
            throw APIError.fromStatus("BAD_REQUEST", {
              message: "At most three administrators can belong to an organization.",
            });
          }
        },
        beforeUpdateMemberRole: async ({ member, newRole }) => {
          if (!isAdministratorRole(newRole) || isAdministratorRole(member.role)) {
            return;
          }

          const currentAdministrators = await countAdministrators(member.id);
          if (currentAdministrators >= administratorRoleLimit) {
            throw APIError.fromStatus("BAD_REQUEST", {
              message: "At most three administrators can belong to an organization.",
            });
          }
        },
      },
    }),
    multiSession(),
  ],
};

export const auth: Auth<Parameters<typeof betterAuth>[0]> = betterAuth(authOptions);
