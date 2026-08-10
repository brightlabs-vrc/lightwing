import { APIError, betterAuth, type Auth } from "better-auth";
import { createAccessControl, multiSession, organization } from "better-auth/plugins";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { Prisma } from "@prisma/client";
import { REST, Routes } from "discord.js";
import type { APIGuildMember, APIRole } from "discord-api-types/v10";
import { secret } from "encore.dev/config";
import { appMeta } from "encore.dev";
import log from "encore.dev/log";
import { prisma } from "./prisma";
import {
  administratorRole,
  administratorRoleLimit,
  roleStatements,
} from "./permissions";

// Store secrets using the Encore CLI:
//   encore secret set --type dev,local,pr,production AuthSecret
// Generate a strong value with: openssl rand -base64 32
const authSecret = secret("BETTER_AUTH_SECRET");
const discordClientId = secret("DISCORD_AUTH_CLIENT_ID");
const discordClientSecret = secret("DISCORD_AUTH_CLIENT_SECRET");
const discordBotToken = secret("DISCORD_BOT_TOKEN");

import { StructKeyspace, expireInSeconds } from "encore.dev/storage/cache";
import { cluster } from "../cache";
import { generateUniqueUserSlug } from "../lib/slugs";

const ursDiscordGuildId = "1482993434410225739";

export async function ensureUserSlug(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  if (user.slug !== null) return user.slug;

  const baseSource = user.name || "user";
  const slug = await generateUniqueUserSlug(prisma, baseSource, userId);
  await prisma.user.update({
    where: { id: userId },
    data: { slug },
  });
  return slug;
}
const siteAdminRole = "SITE_ADMIN";
const staffRoleNames = new Set([
  "Moderation Staff",
  "Lead Staff",
  "Event Staff",
  "Competitive Integrity Administration Staff",
]);

// Singleton key — there is only one Discord guild to resolve roles for.
const DISCORD_STAFF_ROLES_KEY = "discord-staff-role-ids";

interface DiscordStaffRoles {
  ids: string[];
}

const discordRolesCache = new StructKeyspace<{ key: string }, DiscordStaffRoles>(
  cluster,
  {
    keyPattern: "discord-staff-roles/:key",
    defaultExpiry: expireInSeconds(300), // 5 minutes, matches original intent
  }
);

let discordBotRestClient: REST | null = null;

function getDiscordBotRestClient(): REST | null {
  if (discordBotRestClient) {
    return discordBotRestClient;
  }
  try {
    const token = discordBotToken();
    if (!token) {
      log.warn("Discord bot token is empty");
      return null;
    }
    discordBotRestClient = new REST({ version: "10" }).setToken(token);
    return discordBotRestClient;
  } catch (error) {
    log.error(error, "failed to initialize Discord REST client (secret might be missing)");
    return null;
  }
}

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
  member: accessControl.newRole({ ...roleStatements.member }),
};

function isAdministratorRole(role: string) {
  return role === administratorRole;
}

async function countAdministrators(organizationId: string, excludeMemberId?: string) {
  const excludedMemberClause = excludeMemberId
    ? Prisma.sql`AND "id" <> ${excludeMemberId}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "member"
    WHERE "organizationId" = ${organizationId} AND "role" = ${administratorRole}
    ${excludedMemberClause}
  `;

  return Number(rows[0]?.count ?? 0n);
}

function resolveStaffRoleIds(roles: APIRole[]): Set<string> {
  return new Set(roles.filter((role) => staffRoleNames.has(role.name)).map((role) => role.id));
}

async function getDiscordStaffRoleIds(): Promise<Set<string>> {
  const cached = await discordRolesCache.get({ key: DISCORD_STAFF_ROLES_KEY });
  if (cached !== undefined) {
    return new Set(cached.ids);
  }

  const client = getDiscordBotRestClient();
  if (!client) {
    log.error("Discord bot REST client is not available; returning empty staff roles");
    return new Set<string>();
  }

  let roles: APIRole[];
  try {
    roles = (await client.get(Routes.guildRoles(ursDiscordGuildId))) as APIRole[];
  } catch (error) {
    log.error(error, "failed to fetch Discord guild roles; returning empty staff roles");
    return new Set<string>();
  }

  const ids = resolveStaffRoleIds(roles);
  await discordRolesCache.set({ key: DISCORD_STAFF_ROLES_KEY }, { ids: [...ids] });
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
    log.error(error, "failed to verify Discord guild membership");
    return null;
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

const frontendUrlFromEnv = process.env.FRONTEND_URL?.replace(/\/$/, "") || secret("FRONTEND_URL")();

const authOptions: Parameters<typeof betterAuth>[0] = {
  secret: authSecret(),
  baseURL: appMeta().apiBaseUrl,
  basePath: "/api/auth",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  trustedOrigins: [
    "http://localhost:4000",
    "http://localhost:3000",
    "http://localhost:5173",
    "https://lightwing.urs.deno.net",
    "https://lightwing-canary.urs.deno.net",
    "https://comp.cosyne.jp.eu.org",
    // This is dynamically set by the Encore platform when the app is deployed, so we don't hardcode it here. It is used to allow the frontend to call the backend API from a different origin.
    appMeta().apiBaseUrl,
    ...(frontendUrlFromEnv ? [frontendUrlFromEnv] : []),
  ],
  // The frontend is served from a different origin than this API (it is hosted
  // elsewhere, not inside the Encore backend). For the httpOnly session cookie
  // to be attached to cross-origin credentialed fetches from the frontend to
  // /api/auth/*, it MUST be set with `sameSite: "none"`. A `lax` (better-auth
  // default) or `strict` cookie is dropped on cross-site subrequests, which
  // leaves the user "logged in to Discord but never authenticated" in the app.
  // `sameSite: "none"` requires the `Secure` attribute, so we always set it.
  // (Browsers permit Secure cookies on http://localhost, so local dev still
  // works; a non-localhost plain-HTTP deployment would not, but that is not a
  // supported topology for this app.)
  advanced: {
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
    },
  },
  user: {
    additionalFields: {
      siteRole: {
        type: "string",
        required: false,
        input: false, // do not allow clients to set this via the auth API; it's managed by our database hooks
      },
      vrchatUsername: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  emailAndPassword: {
    enabled: false,
  },
  socialProviders: {
    discord: {
      clientId: discordClientId(),
      clientSecret: discordClientSecret(),
      scope: ["identify", "guilds", "guilds.members.read"],
      mapProfileToUser: (profile) => ({
        // better-auth requires a non-null email field.
        // Use a deterministic, non-routable placeholder derived from the
        // stable Discord user ID. The `.invalid` TLD is RFC-2606-reserved
        // and will never route to a real mailbox.
        email: `${profile.id}@discord.invalid`,
        emailVerified: false,
        name: profile.username,
        image: profile.avatar
          ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
          : null,
      }),
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const existingUsers = await prisma.user.count();
          const uniqueSlug = await generateUniqueUserSlug(prisma, user.name || "user", user.id);

          if (existingUsers > 0) {
            return {
              data: {
                ...user,
                slug: uniqueSlug,
              },
            };
          }

          return {
            data: {
              ...user,
              slug: uniqueSlug,
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
          await ensureUserSlug(session.userId);
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

          const currentAdministrators = await countAdministrators(member.organizationId);
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

          const currentAdministrators = await countAdministrators(invitation.organizationId);
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

          const currentAdministrators = await countAdministrators(member.organizationId, member.id);
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
