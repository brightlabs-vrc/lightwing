import { describe, expect, test } from "vitest";
import {
  administratorRole,
  memberRole,
  roleHasPermission,
} from "../auth/permissions";

describe("race event authorization matrix", () => {
  test("organization administrators manage races (event action) via the event grant", () => {
    // Race mutations are gated by the "event" action in requireEventPermission,
    // so full org administrators inherit management through their event grant.
    expect(roleHasPermission(administratorRole, "event", "create")).toBe(true);
    expect(roleHasPermission(administratorRole, "event", "delete")).toBe(true);
  });

  test("plain members can only read races", () => {
    expect(roleHasPermission(memberRole, "raceEvent", "read")).toBe(true);
    expect(roleHasPermission(memberRole, "raceEvent", "create")).toBe(false);
    expect(roleHasPermission(memberRole, "raceEvent", "delete")).toBe(false);
  });
});
