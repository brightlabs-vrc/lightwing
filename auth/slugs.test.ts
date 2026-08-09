import { describe, expect, test, afterEach, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import {
  slugify,
  isReservedSlug,
  isValidUserSlug,
  isValidSlug,
  generateUniqueUserSlug,
  generateUniqueOrgSlug,
} from "../lib/slugs";
import { ensureUserSlug } from "./auth";

vi.mock("encore.dev/config", () => ({
  secret: () => () => "test-secret-at-least-32-chars-long-abcdef",
}));

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

  test("isValidUserSlug enforces alphanumeric and 4-24 length limit", () => {
    expect(isValidUserSlug("abc")).toBe(false); // too short
    expect(isValidUserSlug("abcd")).toBe(true); // valid
    expect(isValidUserSlug("a".repeat(24))).toBe(true); // valid (max limit)
    expect(isValidUserSlug("a".repeat(25))).toBe(false); // too long
    expect(isValidUserSlug("abc-d")).toBe(false); // has hyphen
    expect(isValidUserSlug("admin")).toBe(false); // reserved
  });

  test("isValidSlug enforces team slug rules (allows hyphens, length 3-24)", () => {
    expect(isValidSlug("ab")).toBe(false); // too short
    expect(isValidSlug("abc")).toBe(true); // valid
    expect(isValidSlug("a".repeat(24))).toBe(true); // valid (max limit)
    expect(isValidSlug("a".repeat(25))).toBe(false); // too long
    expect(isValidSlug("team-slug")).toBe(true); // valid
    expect(isValidSlug("team--slug")).toBe(false); // invalid pattern
    expect(isValidSlug("admin")).toBe(false); // reserved
  });

  test("user slug truncation to 24 characters", async () => {
    const longName = "a".repeat(30);
    const slug = await generateUniqueUserSlug(prisma, longName, `user-${randomUUID()}`);
    expect(slug.length).toBe(24);
    expect(slug).toBe("a".repeat(24));
  });

  test("user slug collision resolution within 24 characters limit", async () => {
    const userId1 = await createUser("CollisionUser", "collisionuser");
    const userId2 = `user-${randomUUID()}`;

    const slug = await generateUniqueUserSlug(prisma, "CollisionUser", userId2);
    expect(slug.length).toBeLessThanOrEqual(24);
    expect(slug).toBe("collisionuser2");

    // Multiple collisions
    const userId3 = await createUser("CollisionUser", "collisionuser2");
    const slug2 = await generateUniqueUserSlug(prisma, "CollisionUser", `user-${randomUUID()}`);
    expect(slug2).toBe("collisionuser3");
    expect(slug2.length).toBeLessThanOrEqual(24);
  });

  test("team slug truncation to 24 characters", async () => {
    const longTeamName = "a".repeat(30);
    const slug = await generateUniqueOrgSlug(prisma, longTeamName);
    expect(slug.length).toBe(24);
    expect(slug).toBe("a".repeat(24));
  });

  test("team slug collision resolution within 24 characters limit", async () => {
    const orgPrisma = {
      organization: {
        findUnique: async ({ where: { slug } }: any) => {
          if (slug === "myteam" || slug === "myteam-2") {
            return { id: "existing" };
          }
          return null;
        }
      }
    };
    const slug = await generateUniqueOrgSlug(orgPrisma, "myteam");
    expect(slug).toBe("myteam-3");
    expect(slug.length).toBeLessThanOrEqual(24);
  });

  test("user slug collision resolution fallback", async () => {
    // Generate valid slug from name
    const u1 = await createUser("Bolt", "bolt");
    const u2 = await createUser("Bolt");

    // Since u2's name "Bolt" has slug "bolt", but "bolt" is already taken by u1,
    // generateUniqueUserSlug should default to a derivative using their Discord ID
    const newSlug = await generateUniqueUserSlug(prisma, "Bolt", u2);
    expect(newSlug.length).toBeGreaterThanOrEqual(4);
    expect(newSlug.length).toBeLessThanOrEqual(24);
    expect(newSlug).not.toBe("bolt");
  });

  test("ensureUserSlug lazy recovery on login", async () => {
    const userId = await createUser("Lazy Recovery", null);

    // Recovery on first sign in / ensure call
    const slug = await ensureUserSlug(userId);
    expect(slug).not.toBeNull();
    expect(slug?.length).toBeGreaterThanOrEqual(4);
    expect(slug?.length).toBeLessThanOrEqual(24);

    // Idempotent call
    const slug2 = await ensureUserSlug(userId);
    expect(slug2).toBe(slug);
  });
});
