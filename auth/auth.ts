import { APIError, betterAuth, type Auth } from "better-auth";
import { createAccessControl, multiSession, organization } from "better-auth/plugins";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { Prisma } from "@prisma/client";
import { secret } from "encore.dev/config";
import { prisma } from "./prisma";

// Store secrets using the Encore CLI:
//   encore secret set --type dev,local,pr,production AuthSecret
// Generate a strong value with: openssl rand -base64 32
const authSecret = secret("AuthSecret");

const administratorRole = "administrator";
const administratorRoleLimit = 3;

const accessControl = createAccessControl({
  organization: ["read", "update", "delete"],
  member: ["read", "create", "update", "delete"],
  invitation: ["read", "create", "update", "delete"],
  event: ["read", "create", "update", "delete"],
});

const roles = {
  administrator: accessControl.newRole({
    organization: ["read", "update", "delete"],
    member: ["read", "create", "update", "delete"],
    invitation: ["read", "create", "update", "delete"],
    event: ["read", "create", "update", "delete"],
  }),
  eventAdministrator: accessControl.newRole({
    organization: ["read"],
    member: ["read"],
    invitation: ["read"],
    event: ["read", "create", "update", "delete"],
  }),
  organizationAdministrator: accessControl.newRole({
    organization: ["read"],
    member: ["read", "create", "update"],
    invitation: ["read", "create"],
    event: ["read"],
  }),
  member: accessControl.newRole({
    organization: ["read"],
    member: ["read"],
    invitation: ["read"],
    event: ["read"],
  }),
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

const authOptions: Parameters<typeof betterAuth>[0] = {
  secret: authSecret(),
  basePath: "/auth",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  trustedOrigins: [
    "http://localhost:4000",
    "http://localhost:3000",
  ],
  emailAndPassword: {
    enabled: true,
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
