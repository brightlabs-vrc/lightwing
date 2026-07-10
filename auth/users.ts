import { api, APIError, Header } from "encore.dev/api";
import { prisma } from "./prisma";
import { requireSiteAdmin, resolveActor } from "./rbac";
import type { SiteRoleName } from "./permissions";
import type { ClassTier } from "../eventmanager/classtier";

// Netkeiba-style participant profile (issue #7). Combines core user info with a
// biography, a free-form career overview, the participant's skill class tier
// (issue #3) and their team affiliations (organization memberships, issue #6).
export interface TeamAffiliation {
  organizationId: string;
  name: string;
  slug: string;
  role: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  image: string | null;
  biography: string | null;
  careerOverview: string | null;
  classTier: ClassTier | null;
  siteRole: SiteRoleName;
  teams: TeamAffiliation[];
  createdAt: string;
  updatedAt: string;
}

interface GetUserParams {
  id: string;
}

// Returns a participant's public profile including team affiliations.
export const getUserProfile = api(
  { expose: true, method: "GET", path: "/users/:id" },
  async ({ id }: GetUserParams): Promise<UserProfile> => {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        members: {
          include: { organization: true },
        },
      },
    });

    if (!user) {
      throw APIError.notFound("user not found");
    }

    return toProfile(user);
  },
);

interface UpdateUserParams {
  id: string;
  authorization: Header<"Authorization">;
  name?: string;
  image?: string | null;
  biography?: string | null;
  careerOverview?: string | null;
}

// Updates the authenticated user's own profile fields (issue #7). A user may
// only edit their own record.
export const updateUserProfile = api(
  { expose: true, method: "PATCH", path: "/users/:id" },
  async ({
    id,
    authorization,
    name,
    image,
    biography,
    careerOverview,
  }: UpdateUserParams): Promise<UserProfile> => {
    const actor = await resolveActor(prisma, authorization);
    if (actor.userId !== id) {
      throw APIError.permissionDenied("cannot edit another user's profile");
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw APIError.notFound("user not found");
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        name: name ?? undefined,
        image: image === undefined ? undefined : image,
        biography: biography === undefined ? undefined : biography,
        careerOverview: careerOverview === undefined ? undefined : careerOverview,
      },
      include: {
        members: {
          include: { organization: true },
        },
      },
    });

    return toProfile(user);
  },
);

interface SetSiteRoleParams {
  id: string;
  authorization: Header<"Authorization">;
  siteRole: SiteRoleName;
}

// Grants or revokes the global SITE_ADMIN role. Restricted to existing site
// administrators, the single choke point that bootstraps platform-wide control.
export const setUserSiteRole = api(
  { expose: true, method: "PUT", path: "/users/:id/site-role" },
  async ({ id, authorization, siteRole }: SetSiteRoleParams): Promise<UserProfile> => {
    await requireSiteAdmin(prisma, authorization);

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw APIError.notFound("user not found");
    }

    const user = await prisma.user.update({
      where: { id },
      data: { siteRole },
      include: {
        members: {
          include: { organization: true },
        },
      },
    });

    return toProfile(user);
  },
);

type UserWithMembers = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  biography: string | null;
  careerOverview: string | null;
  classTier: ClassTier | null;
  siteRole: string;
  createdAt: Date;
  updatedAt: Date;
  members: {
    role: string;
    organization: { id: string; name: string; slug: string };
  }[];
};

function toProfile(user: UserWithMembers): UserProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    biography: user.biography,
    careerOverview: user.careerOverview,
    classTier: user.classTier,
    siteRole: user.siteRole as SiteRoleName,
    teams: user.members.map((member) => ({
      organizationId: member.organization.id,
      name: member.organization.name,
      slug: member.organization.slug,
      role: member.role,
    })),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
