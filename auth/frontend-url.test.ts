import { afterEach, describe, expect, test, vi } from "vitest";
import { getFrontendUrl, normalizeFrontendUrl } from "./frontend-url";

vi.mock("encore.dev/config", () => ({
  secret: (name: string) => () => {
    if (name === "FRONTEND_URL") {
      return "https://secret.example.com/";
    }

    return "";
  },
}));

const originalEnv = process.env;

afterEach(() => {
  Object.defineProperty(process, "env", {
    value: originalEnv,
    configurable: true,
  });
});

describe("frontend URL configuration", () => {
  test("normalizes string values", () => {
    expect(normalizeFrontendUrl(" https://example.com/ ")).toBe("https://example.com");
    expect(normalizeFrontendUrl("")).toBeUndefined();
    expect(normalizeFrontendUrl("   ")).toBeUndefined();
  });

  test("falls back to the FRONTEND_URL secret when the environment value is malformed", () => {
    Object.defineProperty(process, "env", {
      value: {
        ...originalEnv,
        FRONTEND_URL: { invalid: true },
      } as unknown as NodeJS.ProcessEnv,
      configurable: true,
    });

    expect(getFrontendUrl()).toBe("https://secret.example.com");
  });
});
