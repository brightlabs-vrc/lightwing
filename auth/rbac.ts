import { APIError } from "encore.dev/api";
import type { PrismaClient } from "@prisma/client";
import {
  type Action,
  type Resource,
  type SiteRoleName,
  isSiteAdmin,
  roleHasPermission,
} from "./permissions";

export interface Actor {
  userId: string;
  activeOrganizationId: string | null;
  siteRole: SiteRoleName;
}

// Resolves the calling user from a better-auth session token supplied via the
// `Authorization: Bearer <token>` header. The session table is owned by
// better-auth; we simply read it to identify the caller, which lets any service
// authenticate requests without duplicating auth state. The user's global
// `siteRole` is loaded alongside so callers can enforce platform-wide checks.
export async function resolveActor(
  prisma: PrismaClient,
  authorization: string | undefined,
): Promise<Actor> {
  const token = authorization?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    throw APIError.unauthenticated("missing session token");
  }

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { select: { siteRole: true } } },
  });
  if (!session || session.expiresAt.getTime() <= Date.now()) {
    throw APIError.unauthenticated("invalid or expired session");
  }

  return {
    userId: session.userId,
    activeOrganizationId: session.activeOrganizationId ?? null,
    siteRole: session.user.siteRole as SiteRoleName,
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
// that grants `action` on `resource`, reusing the shared RBAC matrix. Site
// administrators short-circuit the org-scoped check (absolute control). Returns
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
  if (isSiteAdmin(actor.siteRole)) {
    return { actor, role: actor.siteRole };
  }
  const role = await getMemberRole(prisma, params.organizationId, actor.userId);
  if (!role || !roleHasPermission(role, params.resource, params.action)) {
    throw APIError.permissionDenied(
      `role is not permitted to ${params.action} ${params.resource}`,
    );
  }
  return { actor, role };
}

// Asserts the caller holds the global SITE_ADMIN role. Used to gate
// platform-wide actions (endorsing an event as OFFICIAL, granting site roles).
export async function requireSiteAdmin(
  prisma: PrismaClient,
  authorization: string | undefined,
): Promise<Actor> {
  const actor = await resolveActor(prisma, authorization);
  if (!isSiteAdmin(actor.siteRole)) {
    throw APIError.permissionDenied("site administrator privilege required");
  }
  return actor;
}

// Authorizes an action on a specific event regardless of whether the event is
// owned by an organization or a single user. Resolution order:
//   1. SITE_ADMIN  -> absolute control.
//   2. user-owned  -> the owning user has full control.
//   3. org-owned   -> reuse the RBAC matrix against the owning organization.
//   4. explicit EventAdmin row (either ownership kind).
// Otherwise the request is denied.
export async function requireEventPermission(
  prisma: PrismaClient,
  params: {
    authorization: string | undefined;
    eventId: string;
    action: Action;
  },
): Promise<{ actor: Actor }> {
  const actor = await resolveActor(prisma, params.authorization);
  if (isSiteAdmin(actor.siteRole)) {
    return { actor };
  }

  const event = await prisma.event.findUnique({ where: { id: params.eventId } });
  if (!event) {
    throw APIError.notFound("event not found");
  }

  if (event.ownerType === "USER") {
    if (event.ownerUserId === actor.userId) {
      return { actor };
    }
  } else if (event.organizationId) {
    const role = await getMemberRole(prisma, event.organizationId, actor.userId);
    if (role && roleHasPermission(role, "event", params.action)) {
      return { actor };
    }
  }

  const eventAdmin = await prisma.eventAdmin.findUnique({
    where: { eventId_userId: { eventId: params.eventId, userId: actor.userId } },
  });
  if (eventAdmin) {
    return { actor };
  }

  throw APIError.permissionDenied(
    `not permitted to ${params.action} this event`,
  );
}
