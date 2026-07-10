import { describe, expect, test } from "vitest";
import {
  administratorRole,
  eventAdministratorRole,
  memberRole,
  organizationAdministratorRole,
  roleHasPermission,
} from "../auth/permissions";

// The race CRUD endpoints (raceevents.ts) delegate authorization to the parent
// event via requireEventPermission, which for organization-owned events maps
// the requested action onto the shared RBAC matrix. These tests pin the matrix
// entries the race feature depends on so the endpoint gating cannot silently
// regress.
describe("race event authorization matrix", () => {
  test("event administrators may create, update and delete races", () => {
    expect(roleHasPermission(eventAdministratorRole, "raceEvent", "create")).toBe(true);
    expect(roleHasPermission(eventAdministratorRole, "raceEvent", "update")).toBe(true);
    expect(roleHasPermission(eventAdministratorRole, "raceEvent", "delete")).toBe(true);
  });

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

  test("organization-only admins cannot manage races", () => {
    expect(roleHasPermission(organizationAdministratorRole, "event", "update")).toBe(false);
    expect(roleHasPermission(organizationAdministratorRole, "raceEvent", "create")).toBe(false);
  });
});
