import { describe, expect, test } from "vitest";
import {
  administratorRole,
  eventAdministratorRole,
  memberRole,
  organizationAdministratorRole,
  roleHasPermission,
} from "../auth/permissions";

// The bulk standings endpoints (results.ts) — full-replace PUT, merge POST and
// single-result DELETE on /events/:eventId/races/:raceId/results[/:userId] — all
// delegate authorization to the parent event via
// requireEventPermission(..., "update"). For organization-owned events that maps
// the "update" action onto the "event" resource in the shared RBAC matrix; the
// dedicated "raceResult" resource governs read/write of results themselves.
// These tests pin the matrix entries the standings feature depends on so the
// endpoint gating cannot silently regress.
describe("race result standings authorization matrix", () => {
  test("event administrators may write standings (event-update gate)", () => {
    // replace/merge/delete all call requireEventPermission(..., "update").
    expect(roleHasPermission(eventAdministratorRole, "event", "update")).toBe(true);
    expect(roleHasPermission(eventAdministratorRole, "raceResult", "create")).toBe(true);
    expect(roleHasPermission(eventAdministratorRole, "raceResult", "update")).toBe(true);
    expect(roleHasPermission(eventAdministratorRole, "raceResult", "delete")).toBe(true);
  });

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

  test("organization-only admins cannot write standings", () => {
    expect(roleHasPermission(organizationAdministratorRole, "event", "update")).toBe(false);
    expect(roleHasPermission(organizationAdministratorRole, "raceResult", "create")).toBe(false);
    expect(roleHasPermission(organizationAdministratorRole, "raceResult", "delete")).toBe(false);
  });
});
