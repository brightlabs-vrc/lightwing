import { describe, expect, test } from "vitest";
import {
  administratorRole,
  administratorRoleLimit,
  eventAdministratorRole,
  memberRole,
  roleHasPermission,
} from "./permissions";

describe("roleHasPermission", () => {
  test("administrators can manage every resource", () => {
    expect(roleHasPermission(administratorRole, "event", "delete")).toBe(true);
    expect(roleHasPermission(administratorRole, "organization", "update")).toBe(true);
  });

  test("event administrators can manage events but not the organization", () => {
    expect(roleHasPermission(eventAdministratorRole, "event", "create")).toBe(true);
    expect(roleHasPermission(eventAdministratorRole, "event", "delete")).toBe(true);
    expect(roleHasPermission(eventAdministratorRole, "organization", "update")).toBe(false);
  });

  test("plain members only get read access", () => {
    expect(roleHasPermission(memberRole, "event", "read")).toBe(true);
    expect(roleHasPermission(memberRole, "event", "create")).toBe(false);
  });

  test("unknown roles are denied", () => {
    expect(roleHasPermission("ghost", "event", "read")).toBe(false);
  });

  test("organization admin cap is three", () => {
    expect(administratorRoleLimit).toBe(3);
  });
});
