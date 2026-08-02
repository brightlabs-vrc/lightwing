import { describe, expect, test, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import {
  slugify,
  isReservedSlug,
  isValidUserSlug,
  isValidSlug,
  generateUniqueUserSlug,
} from "../lib/slugs";
import { ensureUserSlug } from "./auth";

describe("Slug Helpers and Recovery", () => {
  const createdUserIds: string[] = [];

  async function createUser(name: string, slug: string | null = null) {
    const id = `user-${randomUUID()}`;
    await prisma.user.create({
      data: {
        id,
        name,
        email: `${id}@discord.invalid`,
        slug,
      },
    });
    createdUserIds.push(id);
    return id;
  }

  afterEach(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
  });

  test("slugify normalizes correctly", () => {
    expect(slugify("Hello World!")).toBe("hello-world");
    expect(slugify("Café")).toBe("cafe");
  });

  test("reserved word restrictions are recognized", () => {
    expect(isReservedSlug("admin")).toBe(true);
    expect(isReservedSlug("api")).toBe(true);
    expect(isReservedSlug("not-reserved")).toBe(false);
  });

  test("isValidUserSlug enforces alphanumeric and 4-8 length limit", () => {
    expect(isValidUserSlug("abc")).toBe(false); // too short
    expect(isValidUserSlug("abcd")).toBe(true); // valid
    expect(isValidUserSlug("abcdefgh")).toBe(true); // valid
    expect(isValidUserSlug("abcdefghi")).toBe(false); // too long
    expect(isValidUserSlug("abc-d")).toBe(false); // has hyphen
    expect(isValidUserSlug("admin")).toBe(false); // reserved
  });

  test("isValidSlug enforces team slug rules (allows hyphens, length 3-32)", () => {
    expect(isValidSlug("ab")).toBe(false); // too short
    expect(isValidSlug("abc")).toBe(true); // valid
    expect(isValidSlug("team-slug")).toBe(true); // valid
    expect(isValidSlug("team--slug")).toBe(false); // invalid pattern
    expect(isValidSlug("admin")).toBe(false); // reserved
  });

  test("user slug collision resolution fallback", async () => {
    // Generate valid slug from name
    const u1 = await createUser("Bolt", "bolt");
    const u2 = await createUser("Bolt");

    // Since u2's name "Bolt" has slug "bolt", but "bolt" is already taken by u1,
    // generateUniqueUserSlug should default to a derivative using their Discord ID
    const newSlug = await generateUniqueUserSlug(prisma, "Bolt", u2);
    expect(newSlug.length).toBeGreaterThanOrEqual(4);
    expect(newSlug.length).toBeLessThanOrEqual(8);
    expect(newSlug).not.toBe("bolt");
  });

  test("ensureUserSlug lazy recovery on login", async () => {
    const userId = await createUser("Lazy Recovery", null);

    // Recovery on first sign in / ensure call
    const slug = await ensureUserSlug(userId);
    expect(slug).not.toBeNull();
    expect(slug?.length).toBeGreaterThanOrEqual(4);
    expect(slug?.length).toBeLessThanOrEqual(8);

    // Idempotent call
    const slug2 = await ensureUserSlug(userId);
    expect(slug2).toBe(slug);
  });
});
