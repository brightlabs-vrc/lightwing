import { vi } from "vitest";

// Mock encore.dev/config BEFORE importing auth
vi.mock("encore.dev/config", () => {
  return {
    secret: (name: string) => {
      if (name === "BETTER_AUTH_SECRET") {
        return () => "test-secret-at-least-32-chars-long-abcdef";
      }
      return () => "mock-secret";
    }
  };
});

import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, test } from "vitest";
import { serializeSignedCookie } from "better-call";
import { prisma } from "./prisma";
import { auth } from "./auth";

const TEST_SECRET = "test-secret-at-least-32-chars-long-abcdef";

const createdUserIds: string[] = [];
const createdSessionTokens: string[] = [];

async function createUser(prefix: string, name: string, vrchatUsername: string | null = null) {
  const id = `${prefix}-${randomUUID()}`;
  await prisma.user.create({
    data: {
      id,
      name,
      email: `${id}@example.com`,
      siteRole: "USER",
      vrchatUsername,
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

describe("Better-Auth vrchatUsername in session", () => {
  test("vrchatUsername is registered in user additionalFields", () => {
    expect(auth.options.user?.additionalFields).toHaveProperty("vrchatUsername");
    const field = (auth.options.user?.additionalFields as any).vrchatUsername;
    expect(field).toMatchObject({
      type: "string",
      required: false,
      input: false,
    });
  });

  test("returns vrchatUsername in session user object if set", async () => {
    const vrchatUsername = "TestVRChatUser123";
    const userId = await createUser("vrc-user", "VRC User", vrchatUsername);
    const token = await createSession(userId);

    const secret = auth.options.secret || TEST_SECRET;
    const cookieName = "better-auth.session_token";
    const serializedCookie = await serializeSignedCookie(cookieName, token, secret);

    // Call better-auth API to retrieve the session
    const response = await auth.api.getSession({
      headers: new Headers({
        cookie: serializedCookie,
      }),
    });

    expect(response).not.toBeNull();
    expect(response?.user).toHaveProperty("vrchatUsername");
    expect(response?.user.vrchatUsername).toBe(vrchatUsername);
  });

  test("returns null/undefined or falsy vrchatUsername in session if not set", async () => {
    const userId = await createUser("novrc-user", "No VRC User", null);
    const token = await createSession(userId);

    const secret = auth.options.secret || TEST_SECRET;
    const cookieName = "better-auth.session_token";
    const serializedCookie = await serializeSignedCookie(cookieName, token, secret);

    // Call better-auth API to retrieve the session
    const response = await auth.api.getSession({
      headers: new Headers({
        cookie: serializedCookie,
      }),
    });

    expect(response).not.toBeNull();
    // It should either be null, undefined, or missing/not set (falsy)
    expect(!response?.user.vrchatUsername).toBe(true);
  });
});
