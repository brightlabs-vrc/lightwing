import { APIError } from "encore.dev/api";
import type { PrismaClient } from "@prisma/client";
import { type Action, type Resource, roleHasPermission } from "./permissions";

export interface Actor {
  userId: string;
  activeOrganizationId: string | null;
}

// Resolves the calling user from a better-auth session token supplied via the
// `Authorization: Bearer <token>` header. The session table is owned by
// better-auth; we simply read it to identify the caller, which lets any service
// authenticate requests without duplicating auth state.
export async function resolveActor(
  prisma: PrismaClient,
  authorization: string | undefined,
): Promise<Actor> {
  const token = authorization?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    throw APIError.unauthenticated("missing session token");
  }

  const session = await prisma.session.findUnique({ where: { token } });
  if (!session || session.expiresAt.getTime() <= Date.now()) {
    throw APIError.unauthenticated("invalid or expired session");
  }

  return {
    userId: session.userId,
    activeOrganizationId: session.activeOrganizationId ?? null,
  };
}

export async function getMemberRole(
  prisma: PrismaClient,
  organizationId: string,
  userId: string,
): Promise<string | null> {
  const member = await prisma.member.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
  return member?.role ?? null;
}

// Authenticates the caller and asserts they hold a role in `organizationId`
// that grants `action` on `resource`, reusing the shared RBAC matrix. Returns
// the resolved actor and their role on success.
export async function requirePermission(
  prisma: PrismaClient,
  params: {
    authorization: string | undefined;
    organizationId: string;
    resource: Resource;
    action: Action;
  },
): Promise<{ actor: Actor; role: string }> {
  const actor = await resolveActor(prisma, params.authorization);
  const role = await getMemberRole(prisma, params.organizationId, actor.userId);
  if (!role || !roleHasPermission(role, params.resource, params.action)) {
    throw APIError.permissionDenied(
      `role is not permitted to ${params.action} ${params.resource}`,
    );
  }
  return { actor, role };
}
