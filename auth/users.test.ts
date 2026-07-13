import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, test } from "vitest";
import { prisma } from "./prisma";
import { listUsers } from "./users";

const createdUserIds: string[] = [];
const createdSessionTokens: string[] = [];

async function createUser(prefix: string, name: string, siteRole: "USER" | "SITE_ADMIN" = "USER") {
  const id = `${prefix}-${randomUUID()}`;
  await prisma.user.create({
    data: {
      id,
      name,
      email: `${id}@example.com`,
      siteRole,
    },
  });
  createdUserIds.push(id);
  return id;
}

async function createSession(userId: string) {
  const token = `token-${randomUUID()}`;
  await prisma.session.create({
    data: {
      id: `session-${randomUUID()}`,
      token,
      userId,
      expiresAt: new Date(Date.now() + 60_000 * 60),
    },
  });
  createdSessionTokens.push(token);
  return token;
}

afterEach(async () => {
  if (createdSessionTokens.length > 0) {
    await prisma.session.deleteMany({ where: { token: { in: createdSessionTokens } } });
    createdSessionTokens.length = 0;
  }

  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
});

describe("listUsers endpoint", () => {
  test("returns list of users with organization affiliations for site admin", async () => {
    const userOneId = await createUser("user-one", "Alice User");
    const userTwoId = await createUser("user-two", "Bob User");
    const adminUserId = await createUser("admin-user", "Root Admin", "SITE_ADMIN");

    const token = await createSession(adminUserId);

    const response = await listUsers({
      authorization: `Bearer ${token}`,
    });

    expect(response.total).toBeGreaterThanOrEqual(3);
    expect(response.users.some((u) => u.id === userOneId)).toBe(true);
    expect(response.users.some((u) => u.id === userTwoId)).toBe(true);
  });

  test("rejects regular users", async () => {
    const regularUserId = await createUser("regular-user", "Regular Alice");
    const token = await createSession(regularUserId);

    await expect(
      listUsers({
        authorization: `Bearer ${token}`,
      })
    ).rejects.toMatchObject({
      code: "permission_denied",
    });
  });

  test("filters users by name or email with search query", async () => {
    const aliceId = await createUser("alice-doe", "Alice Unique Doe");
    const johnId = await createUser("john-doe", "John Unique Doe");
    const adminId = await createUser("root-admin", "Root Admin", "SITE_ADMIN");

    const token = await createSession(adminId);

    const response = await listUsers({
      authorization: `Bearer ${token}`,
      search: "Unique Doe",
    });

    expect(response.users.some((u) => u.id === aliceId)).toBe(true);
    expect(response.users.some((u) => u.id === johnId)).toBe(true);
    expect(response.users.some((u) => u.id === adminId)).toBe(false);
  });

  test("paginates users with limit and offset query params", async () => {
    const p1 = await createUser("p-one", "P1");
    const p2 = await createUser("p-two", "P2");
    const p3 = await createUser("p-three", "P3");
    const adminId = await createUser("p-admin", "P Admin", "SITE_ADMIN");

    const token = await createSession(adminId);

    const response = await listUsers({
      authorization: `Bearer ${token}`,
      limit: 2,
    });

    expect(response.users.length).toBeLessThanOrEqual(2);
  });
});
