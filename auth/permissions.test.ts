import { describe, expect, test } from "vitest";
import {
  administratorRole,
  administratorRoleLimit,
  isSiteAdmin,
  memberRole,
  roleHasPermission,
  siteAdminRole,
} from "./permissions";

describe("roleHasPermission", () => {
  test("administrators can manage every resource", () => {
    expect(roleHasPermission(administratorRole, "event", "delete")).toBe(true);
    expect(roleHasPermission(administratorRole, "organization", "update")).toBe(true);
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

  test("administrators get full race CRUD", () => {
    for (const action of ["read", "create", "update", "delete"] as const) {
      expect(roleHasPermission(administratorRole, "raceEvent", action)).toBe(true);
      expect(roleHasPermission(administratorRole, "raceResult", action)).toBe(true);
    }
  });

  test("members only read races", () => {
    expect(roleHasPermission(memberRole, "raceEvent", "read")).toBe(true);
    expect(roleHasPermission(memberRole, "raceResult", "read")).toBe(true);
    expect(roleHasPermission(memberRole, "raceEvent", "create")).toBe(false);
    expect(roleHasPermission(memberRole, "raceResult", "update")).toBe(false);
  });
});

describe("isSiteAdmin", () => {
  test("recognizes the site admin role", () => {
    expect(isSiteAdmin(siteAdminRole)).toBe(true);
    expect(isSiteAdmin("SITE_ADMIN")).toBe(true);
  });

  test("rejects regular users and unknown values", () => {
    expect(isSiteAdmin("USER")).toBe(false);
    expect(isSiteAdmin(null)).toBe(false);
    expect(isSiteAdmin(undefined)).toBe(false);
    expect(isSiteAdmin(administratorRole)).toBe(false);
  });
});
