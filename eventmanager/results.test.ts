import { describe, expect, test } from "vitest";
import {
  administratorRole,
  memberRole,
  roleHasPermission,
} from "../auth/permissions";

describe("race result standings authorization matrix", () => {
  test("organization administrators manage standings via the event grant", () => {
    // Standings mutations are gated by the "event"/"update" action, so full org
    // administrators inherit management through their event grant.
    expect(roleHasPermission(administratorRole, "event", "update")).toBe(true);
    expect(roleHasPermission(administratorRole, "raceResult", "create")).toBe(true);
    expect(roleHasPermission(administratorRole, "raceResult", "delete")).toBe(true);
  });

  test("plain members can only read standings", () => {
    expect(roleHasPermission(memberRole, "raceResult", "read")).toBe(true);
    expect(roleHasPermission(memberRole, "event", "update")).toBe(false);
    expect(roleHasPermission(memberRole, "raceResult", "create")).toBe(false);
    expect(roleHasPermission(memberRole, "raceResult", "update")).toBe(false);
    expect(roleHasPermission(memberRole, "raceResult", "delete")).toBe(false);
  });
});
