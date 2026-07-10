import { describe, expect, test } from "vitest";
import {
  administratorRole,
  administratorRoleLimit,
  eventAdministratorRole,
  isSiteAdmin,
  memberRole,
  organizationAdministratorRole,
  roleHasPermission,
  siteAdminRole,
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

  test("administrators and event administrators get full race CRUD", () => {
    for (const role of [administratorRole, eventAdministratorRole]) {
      for (const action of ["read", "create", "update", "delete"] as const) {
        expect(roleHasPermission(role, "raceEvent", action)).toBe(true);
        expect(roleHasPermission(role, "raceResult", action)).toBe(true);
      }
    }
  });

  test("members and organization admins only read races", () => {
    for (const role of [memberRole, organizationAdministratorRole]) {
      expect(roleHasPermission(role, "raceEvent", "read")).toBe(true);
      expect(roleHasPermission(role, "raceResult", "read")).toBe(true);
      expect(roleHasPermission(role, "raceEvent", "create")).toBe(false);
      expect(roleHasPermission(role, "raceResult", "update")).toBe(false);
    }
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
