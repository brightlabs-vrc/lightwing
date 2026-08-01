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
 * Validates whether a slug matches regex and length rules, and is not reserved.
 */
export function isValidSlug(slug: string): boolean {
  if (slug.length < 3 || slug.length > 32) {
    return false;
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return false;
  }
  if (RESERVED_SLUGS.has(slug)) {
    return false;
  }
  return true;
}

/**
 * Generates a unique user slug starting from a base username.
 * Appends "-2", "-3", etc. if the slug is already taken or reserved.
 */
export async function generateUniqueUserSlug(
  prisma: { user: { findUnique: (args: { where: { slug: string } }) => Promise<any> } },
  baseName: string,
): Promise<string> {
  let base = slugify(baseName);
  if (!base || base.length < 3) {
    base = "user";
  }
  if (base.length > 25) {
    base = base.slice(0, 25);
  }

  let slug = base;
  if (RESERVED_SLUGS.has(slug)) {
    slug = `${base}-1`;
  }

  let counter = 2;
  while (true) {
    const existing = await prisma.user.findUnique({ where: { slug } });
    if (!existing && !RESERVED_SLUGS.has(slug)) {
      return slug;
    }
    slug = `${base}-${counter}`;
    counter++;
  }
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
  if (base.length > 25) {
    base = base.slice(0, 25);
  }

  let slug = base;
  if (RESERVED_SLUGS.has(slug)) {
    slug = `${base}-1`;
  }

  let counter = 2;
  while (true) {
    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (!existing && !RESERVED_SLUGS.has(slug)) {
      return slug;
    }
    slug = `${base}-${counter}`;
    counter++;
  }
}
