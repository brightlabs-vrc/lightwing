import { APIError, betterAuth, type Auth } from "better-auth";
import { createAccessControl, multiSession, organization } from "better-auth/plugins";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { Prisma } from "@prisma/client";
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

const authOptions: Parameters<typeof betterAuth>[0] = {
  secret: authSecret(),
  baseURL: appMeta().apiBaseUrl,
  basePath: "/api/auth",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  trustedOrigins: [
    "http://localhost:4000",
    "http://localhost:3000",
    // This is dynamically set by the Encore platform when the app is deployed, so we don't hardcode it here. It is used to allow the frontend to call the backend API from a different origin.
    appMeta().apiBaseUrl,
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
