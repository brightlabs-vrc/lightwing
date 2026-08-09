import { afterEach, describe, expect, test, vi } from "vitest";

const originalEnv = process.env;

async function loadFrontendUrlModule(
  secretValueFactory: () => string = () => "https://secret.example.com/",
) {
  vi.resetModules();
  vi.doMock("encore.dev/config", () => ({
    secret: (name: string) => () => {
      if (name === "FRONTEND_URL") {
        return secretValueFactory();
      }

      return "";
    },
  }));

  return import("./frontend-url");
}

afterEach(() => {
  Object.defineProperty(process, "env", {
    value: originalEnv,
    configurable: true,
  });
  vi.resetModules();
});

describe("frontend URL configuration", () => {
  test("normalizes string values", async () => {
    const { normalizeFrontendUrl } = await loadFrontendUrlModule();

    expect(normalizeFrontendUrl(" https://example.com/ ")).toBe("https://example.com");
    expect(normalizeFrontendUrl("")).toBeUndefined();
    expect(normalizeFrontendUrl("   ")).toBeUndefined();
  });

  test("prefers a valid environment value over the secret", async () => {
    const { getFrontendUrl } = await loadFrontendUrlModule(() => "https://secret.example.com/");

    process.env.FRONTEND_URL = "https://env.example.com/";

    expect(getFrontendUrl()).toBe("https://env.example.com");
  });

  test("falls back to the FRONTEND_URL secret when the environment value is malformed", async () => {
    const { getFrontendUrl } = await loadFrontendUrlModule();

    Object.defineProperty(process, "env", {
      value: {
        ...originalEnv,
        FRONTEND_URL: { invalid: true },
      } as unknown as NodeJS.ProcessEnv,
      configurable: true,
    });

    expect(getFrontendUrl()).toBe("https://secret.example.com");
  });

  test("returns undefined when neither the environment nor the secret provide a usable URL", async () => {
    const { getFrontendUrl } = await loadFrontendUrlModule(() => {
      throw new Error("missing secret");
    });

    delete process.env.FRONTEND_URL;

    expect(getFrontendUrl()).toBeUndefined();
  });
});
