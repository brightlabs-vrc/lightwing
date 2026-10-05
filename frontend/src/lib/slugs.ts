const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'events',
  'users',
  'teams',
  'settings',
  'login',
  'auth',
  'profile',
  'onboarding',
  'admin-panel',
  'dashboard',
  'help',
  'support',
  'status',
]);

/**
 * Checks whether a slug is reserved for system routes or endpoints.
 */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

/**
 * Validates whether a team slug matches regex and length rules, and is not reserved.
 */
export function isValidSlug(slug: string): boolean {
  if (slug.length < 3 || slug.length > 24) {
    return false;
  }
  if (!/^[a-z0-9._-]+$/.test(slug)) {
    return false;
  }
  if (isReservedSlug(slug)) {
    return false;
  }
  return true;
}

/**
 * Validates whether a user slug (handle) is 4-24 characters and supports alphanumeric, periods, dashes, and underscores.
 */
export function isValidUserSlug(slug: string): boolean {
  if (slug.length < 4 || slug.length > 24) {
    return false;
  }
  if (!/^[a-z0-9._-]+$/.test(slug)) {
    return false;
  }
  if (isReservedSlug(slug)) {
    return false;
  }
  return true;
}

/**
 * Normalizes a string into a URL-friendly slug (lowercase, preserving alphanumeric, periods, dashes, and underscores).
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
