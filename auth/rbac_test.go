package auth

import (
	"context"
	"os"
	"testing"
	"time"

	"encore.dev/beta/errs"
	"encore.dev/et"
	"encore.app/shared"
)

// TestMain sets up a single test database for all tests in this package.
func TestMain(m *testing.M) {
	ctx := context.Background()
	testDB, err := et.NewTestDatabase(ctx, "lightwing")
	if err == nil {
		shared.SetTestDB(testDB)
	}
	code := m.Run()
	os.Exit(code)
}

// insertTestUser inserts a test user with the given siteRole into the database.
func insertTestUser(t *testing.T, ctx context.Context, id, name, siteRole, slug string) {
	t.Helper()
	now := time.Now().UTC().Format(time.RFC3339Nano)
	// Mirror TS tests: deterministic placeholder email derived from the user id.
	_, err := shared.DB.Exec(ctx,
		`INSERT INTO "user" (id, name, email, image, "siteRole", "vrchatUsername", slug, "createdAt", "updatedAt")
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		id, name, id+"@discord.invalid", "", siteRole, "", slug, now, now,
	)
	if err != nil {
		t.Fatalf("failed to insert user: %v", err)
	}
}

// insertTestSession creates a session token for the given user.
func insertTestSession(t *testing.T, ctx context.Context, userId, token string, expiresAt time.Time) {
	t.Helper()
	now := time.Now().UTC().Format(time.RFC3339Nano)
	_, err := shared.DB.Exec(ctx,
		`INSERT INTO "session" (id, "userId", token, "activeOrganizationId", "expiresAt", "createdAt", "updatedAt")
		 VALUES (gen_random_uuid()::text, $1, $2, NULL, $3, $4, $4)`,
	// Store UTC wall clock: the column is TIMESTAMP (no TZ), so a local
	// offset would be silently dropped and skew expiry comparisons.
		userId, token, expiresAt.UTC().Format(time.RFC3339Nano), now,
	)
	if err != nil {
		t.Fatalf("failed to insert session: %v", err)
	}
}

// Test_resolveActor validates session token resolution.
//
// Mirrors ts-legacy/auth/rbac.test.ts → "resolveActor"
func Test_resolveActor(t *testing.T) {
	ctx := context.Background()

	insertTestUser(t, ctx, "user-1", "Test User", string(SiteRoleUser), "test-user")
	insertTestSession(t, ctx, "user-1", "valid-token", time.Now().Add(1*time.Hour))

	t.Run("valid token", func(t *testing.T) {
		actor, err := resolveActor(ctx, "Bearer valid-token")
		if err != nil {
			t.Fatalf("resolveActor failed: %v", err)
		}
		if actor.UserID != "user-1" {
			t.Errorf("actor.UserID = %q, want %q", actor.UserID, "user-1")
		}
		if actor.SiteRole != SiteRoleUser {
			t.Errorf("actor.SiteRole = %q, want %q", actor.SiteRole, SiteRoleUser)
		}
	})

	t.Run("missing token", func(t *testing.T) {
		_, err := resolveActor(ctx, "")
		if err == nil {
			t.Fatal("expected error for missing token")
		}
		if !isUnauthenticated(err) {
			t.Errorf("expected unauthenticated error, got: %v", err)
		}
	})

	t.Run("invalid token", func(t *testing.T) {
		_, err := resolveActor(ctx, "Bearer nonexistent-token")
		if err == nil {
			t.Fatal("expected error for invalid token")
		}
		if !isUnauthenticated(err) {
			t.Errorf("expected unauthenticated error, got: %v", err)
		}
	})

	t.Run("expired token", func(t *testing.T) {
		insertTestSession(t, ctx, "user-1", "expired-token", time.Now().Add(-1*time.Hour))
		_, err := resolveActor(ctx, "Bearer expired-token")
		if err == nil {
			t.Fatal("expected error for expired token")
		}
		if !isUnauthenticated(err) {
			t.Errorf("expected unauthenticated error for expired token, got: %v", err)
		}
	})

	t.Run("site admin", func(t *testing.T) {
		insertTestUser(t, ctx, "admin-1", "Admin User", string(SiteRoleSiteAdmin), "admin-user")
		insertTestSession(t, ctx, "admin-1", "admin-token", time.Now().Add(1*time.Hour))
		actor, err := resolveActor(ctx, "Bearer admin-token")
		if err != nil {
			t.Fatalf("resolveActor failed: %v", err)
		}
		if actor.SiteRole != SiteRoleSiteAdmin {
			t.Errorf("actor.SiteRole = %q, want %q", actor.SiteRole, SiteRoleSiteAdmin)
		}
	})
}

// Test_requireSiteAdmin validates that only SITE_ADMIN actors pass.
//
// Mirrors ts-legacy/auth/rbac.test.ts → "requireSiteAdmin"
func Test_requireSiteAdmin(t *testing.T) {
	ctx := context.Background()

	t.Run("site admin passes", func(t *testing.T) {
		insertTestUser(t, ctx, "admin-2", "Admin", string(SiteRoleSiteAdmin), "admin2")
		insertTestSession(t, ctx, "admin-2", "admin-token-2", time.Now().Add(1*time.Hour))
		actor, err := requireSiteAdmin(ctx, "Bearer admin-token-2")
		if err != nil {
			t.Fatalf("requireSiteAdmin failed: %v", err)
		}
		if actor.UserID != "admin-2" {
			t.Errorf("actor.UserID = %q, want %q", actor.UserID, "admin-2")
		}
	})

	t.Run("regular user denied", func(t *testing.T) {
		insertTestUser(t, ctx, "user-2", "Regular", string(SiteRoleUser), "user2")
		insertTestSession(t, ctx, "user-2", "user-token-2", time.Now().Add(1*time.Hour))
		_, err := requireSiteAdmin(ctx, "Bearer user-token-2")
		if err == nil {
			t.Fatal("expected error for non-admin")
		}
		if !isPermissionDenied(err) {
			t.Errorf("expected permission denied, got: %v", err)
		}
	})

	t.Run("unauthenticated denied", func(t *testing.T) {
		_, err := requireSiteAdmin(ctx, "")
		if err == nil {
			t.Fatal("expected error for unauthenticated")
		}
	})
}

// Test_requirePermission validates organization-scoped permission checks.
//
// Mirrors ts-legacy/auth/rbac.test.ts → "requirePermission"
func Test_requirePermission(t *testing.T) {
	ctx := context.Background()
	now := time.Now().UTC().Format(time.RFC3339Nano)

	// Create organization
	_, err := shared.DB.Exec(ctx,
		`INSERT INTO "organization" (id, name, slug, "createdAt", "updatedAt")
		 VALUES ($1, $2, $3, $4, $5)`,
		"org-1", "Test Org", "test-org", now, now,
	)
	if err != nil {
		t.Fatalf("failed to insert org: %v", err)
	}

	t.Run("site admin bypasses org check", func(t *testing.T) {
		insertTestUser(t, ctx, "admin-3", "Admin", string(SiteRoleSiteAdmin), "admin3")
		insertTestSession(t, ctx, "admin-3", "admin-token-3", time.Now().Add(1*time.Hour))
		_, role, err := requirePermission(ctx, "Bearer admin-token-3", "org-1", ResourceEvent, ActionRead)
		if err != nil {
			t.Fatalf("requirePermission failed for site admin: %v", err)
		}
		if role != string(SiteRoleSiteAdmin) {
			t.Errorf("role = %q, want %q", role, SiteRoleSiteAdmin)
		}
	})

	t.Run("org admin can perform actions", func(t *testing.T) {
		insertTestUser(t, ctx, "org-admin", "OrgAdmin", string(SiteRoleUser), "orgadmin")
		insertTestSession(t, ctx, "org-admin", "org-admin-token", time.Now().Add(1*time.Hour))
		_, err := shared.DB.Exec(ctx,
			`INSERT INTO "member" ("id", "userId", "organizationId", "role", "createdAt")
			 VALUES (gen_random_uuid()::text, $1, $2, $3, $4)`,
			"org-admin", "org-1", administratorRole, now,
		)
		if err != nil {
			t.Fatalf("failed to insert member: %v", err)
		}

		actor, role, err := requirePermission(ctx, "Bearer org-admin-token", "org-1", ResourceEvent, ActionCreate)
		if err != nil {
			t.Fatalf("requirePermission failed for org admin: %v", err)
		}
		if role != administratorRole {
			t.Errorf("role = %q, want %q", role, administratorRole)
		}
		if actor.UserID != "org-admin" {
			t.Errorf("actor.UserID = %q, want %q", actor.UserID, "org-admin")
		}
	})

	t.Run("org member can only read", func(t *testing.T) {
		insertTestUser(t, ctx, "org-member", "OrgMember", string(SiteRoleUser), "orgmember")
		insertTestSession(t, ctx, "org-member", "member-token", time.Now().Add(1*time.Hour))
		_, err := shared.DB.Exec(ctx,
			`INSERT INTO "member" ("id", "userId", "organizationId", "role", "createdAt")
			 VALUES (gen_random_uuid()::text, $1, $2, $3, $4)`,
			"org-member", "org-1", memberRole, now,
		)
		if err != nil {
			t.Fatalf("failed to insert member: %v", err)
		}

		// Member can read
		_, _, err = requirePermission(ctx, "Bearer member-token", "org-1", ResourceEvent, ActionRead)
		if err != nil {
			t.Errorf("member should be able to read: %v", err)
		}

		// Member cannot create
		_, _, err = requirePermission(ctx, "Bearer member-token", "org-1", ResourceEvent, ActionCreate)
		if err == nil {
			t.Fatal("member should not be able to create")
		}
		if !isPermissionDenied(err) {
			t.Errorf("expected permission denied, got: %v", err)
		}
	})

	t.Run("user not in org denied", func(t *testing.T) {
		insertTestUser(t, ctx, "outsider", "Outsider", string(SiteRoleUser), "outsider")
		insertTestSession(t, ctx, "outsider", "outsider-token", time.Now().Add(1*time.Hour))

		_, _, err := requirePermission(ctx, "Bearer outsider-token", "org-1", ResourceEvent, ActionRead)
		if err == nil {
			t.Fatal("expected error for user not in org")
		}
		if !isPermissionDenied(err) {
			t.Errorf("expected permission denied, got: %v", err)
		}
	})
}

// Test_requireEventPermission validates event-scoped permission checks.
//
// Mirrors ts-legacy/auth/rbac.test.ts → "requireEventPermission"
func Test_requireEventPermission(t *testing.T) {
	ctx := context.Background()
	now := time.Now().UTC().Format(time.RFC3339Nano)

	// Create user-owned event (owner user must exist: event_ownerUserId_fkey).
	insertTestUser(t, ctx, "event-owner", "Owner", string(SiteRoleUser), "owner")
	_, err := shared.DB.Exec(ctx,
		`INSERT INTO "event" (id, name, "organizationId", "ownerUserId", "ownerType", "scoringType", "createdAt", "updatedAt")
		 VALUES ($1, $2, NULL, $3, $4, 0, $5, $5)`,
		"event-user-owned", "Test Event", "event-owner", string(EventOwnerTypeUser), now,
	)
	if err != nil {
		t.Fatalf("failed to insert event: %v", err)
	}

	// Create org-owned event
	_, err = shared.DB.Exec(ctx,
		`INSERT INTO "event" (id, name, "organizationId", "ownerUserId", "ownerType", "scoringType", "createdAt", "updatedAt")
		 VALUES ($1, $2, $3, NULL, $4, 0, $5, $5)`,
		"event-org-owned", "Org Event", "org-1", string(EventOwnerTypeOrganization), now,
	)
	if err != nil {
		t.Fatalf("failed to insert event: %v", err)
	}

	t.Run("event owner has access", func(t *testing.T) {
		// "event-owner" user was created alongside the event above.
		insertTestSession(t, ctx, "event-owner", "owner-token", time.Now().Add(1*time.Hour))

		actor, err := requireEventPermission(ctx, "Bearer owner-token", "event-user-owned", ActionUpdate)
		if err != nil {
			t.Fatalf("requireEventPermission failed for owner: %v", err)
		}
		if actor.UserID != "event-owner" {
			t.Errorf("actor.UserID = %q, want %q", actor.UserID, "event-owner")
		}
	})

	t.Run("non-owner denied for user-owned event", func(t *testing.T) {
		insertTestUser(t, ctx, "non-owner", "NonOwner", string(SiteRoleUser), "nonowner")
		insertTestSession(t, ctx, "non-owner", "non-owner-token", time.Now().Add(1*time.Hour))

		_, err := requireEventPermission(ctx, "Bearer non-owner-token", "event-user-owned", ActionUpdate)
		if err == nil {
			t.Fatal("expected error for non-owner on user-owned event")
		}
		if !isPermissionDenied(err) {
			t.Errorf("expected permission denied, got: %v", err)
		}
	})

	t.Run("site admin bypasses all checks", func(t *testing.T) {
		insertTestUser(t, ctx, "site-admin-2", "SiteAdmin", string(SiteRoleSiteAdmin), "siteadmin2")
		insertTestSession(t, ctx, "site-admin-2", "site-admin-token-2", time.Now().Add(1*time.Hour))

		_, err := requireEventPermission(ctx, "Bearer site-admin-token-2", "event-user-owned", ActionDelete)
		if err != nil {
			t.Fatalf("requireEventPermission should pass for site admin: %v", err)
		}
	})
}

// Test_getMemberRole validates member role retrieval.
//
// Mirrors ts-legacy/auth/rbac.test.ts → "getMemberRole"
func Test_getMemberRole(t *testing.T) {
	ctx := context.Background()
	now := time.Now().UTC().Format(time.RFC3339Nano)

	insertTestUser(t, ctx, "role-user", "Role User", string(SiteRoleUser), "roleuser")

	_, err := shared.DB.Exec(ctx,
		`INSERT INTO "member" ("id", "userId", "organizationId", "role", "createdAt")
		 VALUES (gen_random_uuid()::text, $1, $2, $3, $4)`,
		"role-user", "org-1", administratorRole, now,
	)
	if err != nil {
		t.Fatalf("failed to insert member: %v", err)
	}

	role, err := getMemberRole(ctx, "org-1", "role-user")
	if err != nil {
		t.Fatalf("getMemberRole failed: %v", err)
	}
	if role != administratorRole {
		t.Errorf("getMemberRole = %q, want %q", role, administratorRole)
	}

	// User not in org → empty role
	role, err = getMemberRole(ctx, "org-1", "non-member")
	if err != nil {
		t.Fatalf("getMemberRole failed for non-member: %v", err)
	}
	if role != "" {
		t.Errorf("getMemberRole for non-member = %q, want \"\"", role)
	}
}

// isUnauthenticated checks if err is an Unauthenticated error.
func isUnauthenticated(err error) bool {
	return err != nil && errs.Code(err) == errs.Unauthenticated
}

// isPermissionDenied checks if err is a PermissionDenied error.
func isPermissionDenied(err error) bool {
	return err != nil && errs.Code(err) == errs.PermissionDenied
}
