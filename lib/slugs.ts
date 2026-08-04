import { PrismaClient } from "@prisma/client";

export const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "events",
  "teams",
  "users",
  "settings",
  "login",
  "auth",
  "profile",
  "onboarding",
  "admin-panel",
  "dashboard",
  "help",
  "support",
  "status",
]);

/**
 * Normalizes a string into a URL-friendly slug.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accent markers
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Checks if a slug is in the reserved list.
 */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

/**
 * Validates whether a team slug matches regex and length rules, and is not reserved.
 */
export function isValidSlug(slug: string): boolean {
  if (slug.length < 3 || slug.length > 24) {
    return false;
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return false;
  }
  if (isReservedSlug(slug)) {
    return false;
  }
  return true;
}

/**
 * Validates whether a user slug matches regex (alphanumeric only) and length 4-24 rules, and is not reserved.
 */
export function isValidUserSlug(slug: string): boolean {
  if (slug.length < 4 || slug.length > 24) {
    return false;
  }
  if (!/^[a-z0-9]+$/.test(slug)) {
    return false;
  }
  if (isReservedSlug(slug)) {
    return false;
  }
  return true;
}

/**
 * Generates a unique user slug starting from a base username.
 * For users, slugs must be alphanumeric and 4-8 characters.
 * Otherwise, default to using a derivative using their Discord ID.
 */
export async function generateUniqueUserSlug(
  prisma: any,
  baseName: string,
  userId: string,
): Promise<string> {
  // Normalize name to lowercase alphanumeric
  let base = baseName.toLowerCase().replace(/[^a-z0-9]/g, "");

  // If base length exceeds 24 characters, truncate it
  if (base.length > 24) {
    base = base.slice(0, 24);
  }

  // Check if alphanumeric and between 4 and 24 characters, and not reserved
  let isValid = base.length >= 4 && base.length <= 24 && !isReservedSlug(base);

  let slug = base;
  if (isValid) {
    // Check collision
    const existing = await prisma.user.findUnique({ where: { slug } });
    if (!existing || existing.id === userId) {
      return slug;
    }
    // Collision! We must resolve it within 24 characters limit.
    let counter = 2;
    while (true) {
      const suffix = String(counter);
      const tempSlug = base.slice(0, 24 - suffix.length) + suffix;
      const collision = await prisma.user.findUnique({ where: { slug: tempSlug } });
      if (!collision || collision.id === userId) {
        return tempSlug;
      }
      counter++;
    }
  }

  // Default to using a derivative of their Discord ID
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "discord" },
  });
  const discordId = account?.accountId || userId;
  const normalizedDiscordId = discordId.toLowerCase().replace(/[^a-z0-9]/g, "");
  // To make sure u + suffix is unique and matches u + discord ID/userId, take the rightmost characters
  const lastPart = normalizedDiscordId.slice(-23);
  slug = `u${lastPart}`.slice(0, 24);

  let counter = 2;
  while (true) {
    const existing = await prisma.user.findUnique({ where: { slug } });
    if (!existing || existing.id === userId) {
      break;
    }
    const suffix = String(counter);
    slug = `u${lastPart}`.slice(0, 24 - suffix.length) + suffix;
    counter++;
  }

  return slug;
}

/**
 * Generates a unique organization slug starting from a base name.
 */
export async function generateUniqueOrgSlug(
  prisma: { organization: { findUnique: (args: { where: { slug: string } }) => Promise<any> } },
  baseName: string,
): Promise<string> {
  let base = slugify(baseName);
  if (!base || base.length < 3) {
    base = "team";
  }
  if (base.length > 24) {
    base = base.slice(0, 24);
  }

  let slug = base;
  if (isReservedSlug(slug)) {
    slug = `${base.slice(0, 22)}-1`;
  }

  let counter = 2;
  while (true) {
    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (!existing && !isReservedSlug(slug)) {
      return slug;
    }
    const suffix = `-${counter}`;
    slug = `${base.slice(0, 24 - suffix.length)}${suffix}`;
    counter++;
  }
}

/**
 * Wrapper for generating unique user slugs using a lazily loaded Prisma.
 */
export async function ensureUniqueUserSlug(base: string, userId: string): Promise<string> {
  const { prisma } = await import("../auth/prisma");
  return generateUniqueUserSlug(prisma, base, userId);
}

/**
 * Wrapper for generating unique team slugs using a lazily loaded Prisma.
 */
export async function ensureUniqueTeamSlug(base: string): Promise<string> {
  const { prisma } = await import("../auth/prisma");
  return generateUniqueOrgSlug(prisma, base);
}
