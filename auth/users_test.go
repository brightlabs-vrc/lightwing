package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"testing"
	"time"

	"encore.dev/beta/errs"
	"encore.app/shared"
)

var usersTestSeq int

func strptr(s string) *string { return &s }

// createUsersTestUser inserts a user with unique id/email/slug so tests stay
// isolated on the shared test database. Mirrors the TS createUser helper
// (deterministic placeholder email, like `${id}@discord.invalid`).
func createUsersTestUser(t *testing.T, ctx context.Context, name, siteRole, bio, vrc string) string {
	t.Helper()
	usersTestSeq++
	id := fmt.Sprintf("userstest-%d", usersTestSeq)
	now := time.Now().UTC().Format(time.RFC3339Nano)
	_, err := shared.DB.Exec(ctx,
		`INSERT INTO "user" (id, name, email, image, "siteRole", biography, "vrchatUsername", slug, "createdAt", "updatedAt")
		 VALUES ($1, $2, $3, '', $4, $5, $6, $7, $8, $8)`,
		id, name, id+"@discord.invalid", siteRole,
		nullIfEmpty(bio), nullIfEmpty(vrc), id, now,
	)
	if err != nil {
		t.Fatalf("failed to insert user: %v", err)
	}
	return id
}

// createUsersTestSession creates a 1-hour session and returns its token.
func createUsersTestSession(t *testing.T, ctx context.Context, userID string) string {
	t.Helper()
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}
	token := hex.EncodeToString(b[:])
	now := time.Now().UTC().Format(time.RFC3339Nano)
	exp := time.Now().UTC().Add(time.Hour).Format(time.RFC3339Nano)
	_, err := shared.DB.Exec(ctx,
		`INSERT INTO "session" (id, "userId", token, "expiresAt", "createdAt", "updatedAt")
		 VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $4)`,
		userID, token, exp, now,
	)
	if err != nil {
		t.Fatalf("failed to insert session: %v", err)
	}
	return token
}

func mustResolveActor(t *testing.T, ctx context.Context, token string) *Actor {
	t.Helper()
	actor, err := resolveActor(ctx, "Bearer "+token)
	if err != nil {
		t.Fatalf("resolveActor failed: %v", err)
	}
	return actor
}

// Test_updateUserProfile mirrors ts-legacy/auth/users.test.ts →
// "updateUserProfile endpoint".
func Test_updateUserProfile(t *testing.T) {
	ctx := context.Background()

	t.Run("allows self updates", func(t *testing.T) {
		userID := createUsersTestUser(t, ctx, "Self Update", string(SiteRoleUser), "", "")
		actor := mustResolveActor(t, ctx, createUsersTestSession(t, ctx, userID))

		updated, err := updateUserProfile(ctx, actor, userID, &UpdateUserProfileParams{
			Biography: strptr("Self updated bio"),
		})
		if err != nil {
			t.Fatalf("updateUserProfile failed: %v", err)
		}
		if updated.Biography == nil || *updated.Biography != "Self updated bio" {
			t.Errorf("biography = %v, want %q", updated.Biography, "Self updated bio")
		}
	})

	t.Run("allows site admin updates for another user", func(t *testing.T) {
		userID := createUsersTestUser(t, ctx, "Other Update", string(SiteRoleUser), "", "")
		adminID := createUsersTestUser(t, ctx, "Admin Updater", string(SiteRoleSiteAdmin), "", "")
		admin := mustResolveActor(t, ctx, createUsersTestSession(t, ctx, adminID))

		updated, err := updateUserProfile(ctx, admin, userID, &UpdateUserProfileParams{
			Biography: strptr("Admin updated bio"),
		})
		if err != nil {
			t.Fatalf("updateUserProfile failed: %v", err)
		}
		if updated.Biography == nil || *updated.Biography != "Admin updated bio" {
			t.Errorf("biography = %v, want %q", updated.Biography, "Admin updated bio")
		}
	})

	t.Run("denies non-admin updates for another user", func(t *testing.T) {
		targetID := createUsersTestUser(t, ctx, "Target User", string(SiteRoleUser), "", "")
		regularID := createUsersTestUser(t, ctx, "Regular User", string(SiteRoleUser), "", "")
		regular := mustResolveActor(t, ctx, createUsersTestSession(t, ctx, regularID))

		_, err := updateUserProfile(ctx, regular, targetID, &UpdateUserProfileParams{
			Biography: strptr("Hacked bio"),
		})
		if err == nil {
			t.Fatal("expected permission error")
		}
		if errs.Code(err) != errs.PermissionDenied {
			t.Errorf("code = %v, want permission_denied", errs.Code(err))
		}
	})

	t.Run("rejects invalid slug", func(t *testing.T) {
		userID := createUsersTestUser(t, ctx, "Slug User", string(SiteRoleUser), "", "")
		actor := mustResolveActor(t, ctx, createUsersTestSession(t, ctx, userID))

		_, err := updateUserProfile(ctx, actor, userID, &UpdateUserProfileParams{
			Slug: strptr("has-hyphen"),
		})
		if err == nil {
			t.Fatal("expected invalid slug error")
		}
		if errs.Code(err) != errs.InvalidArgument {
			t.Errorf("code = %v, want invalid_argument", errs.Code(err))
		}
	})

	t.Run("rejects taken slug", func(t *testing.T) {
		firstID := createUsersTestUser(t, ctx, "First Holder", string(SiteRoleUser), "", "")
		secondID := createUsersTestUser(t, ctx, "Second Holder", string(SiteRoleUser), "", "")
		adminID := createUsersTestUser(t, ctx, "Slug Admin", string(SiteRoleSiteAdmin), "", "")
		admin := mustResolveActor(t, ctx, createUsersTestSession(t, ctx, adminID))

		var firstSlug = "takenuser1"
		if _, err := shared.DB.Exec(ctx, `UPDATE "user" SET slug = $1 WHERE id = $2`, firstSlug, firstID); err != nil {
			t.Fatalf("failed to set slug: %v", err)
		}
		_ = secondID
		_, err := updateUserProfile(ctx, admin, secondID, &UpdateUserProfileParams{
			Slug: strptr(firstSlug),
		})
		if err == nil {
			t.Fatal("expected slug collision error")
		}
		if errs.Code(err) != errs.AlreadyExists {
			t.Errorf("code = %v, want already_exists", errs.Code(err))
		}
	})

	t.Run("returns not found for missing user", func(t *testing.T) {
		adminID := createUsersTestUser(t, ctx, "Missing Admin", string(SiteRoleSiteAdmin), "", "")
		admin := mustResolveActor(t, ctx, createUsersTestSession(t, ctx, adminID))

		_, err := updateUserProfile(ctx, admin, "userstest-nonexistent", &UpdateUserProfileParams{
			Biography: strptr("x"),
		})
		if err == nil {
			t.Fatal("expected not found error")
		}
		if errs.Code(err) != errs.NotFound {
			t.Errorf("code = %v, want not_found", errs.Code(err))
		}
	})
}

// Test_listUsers mirrors ts-legacy/auth/users.test.ts → "listUsers endpoint".
func Test_listUsers(t *testing.T) {
	ctx := context.Background()

	contains := func(users []UserProfile, id string) bool {
		for _, u := range users {
			if u.ID == id {
				return true
			}
		}
		return false
	}

	t.Run("returns users for site admin", func(t *testing.T) {
		oneID := createUsersTestUser(t, ctx, "Alice User", string(SiteRoleUser), "", "")
		twoID := createUsersTestUser(t, ctx, "Bob User", string(SiteRoleUser), "", "")
		adminID := createUsersTestUser(t, ctx, "Root Admin", string(SiteRoleSiteAdmin), "", "")
		admin := mustResolveActor(t, ctx, createUsersTestSession(t, ctx, adminID))

		resp, err := listUsers(ctx, admin, ListUsersQuery{})
		if err != nil {
			t.Fatalf("listUsers failed: %v", err)
		}
		if resp.Total < 3 {
			t.Errorf("total = %d, want >= 3", resp.Total)
		}
		if !contains(resp.Users, oneID) || !contains(resp.Users, twoID) {
			t.Errorf("response missing created users (total=%d)", resp.Total)
		}
	})

	t.Run("rejects regular users", func(t *testing.T) {
		regularID := createUsersTestUser(t, ctx, "Regular Alice", string(SiteRoleUser), "", "")
		regular := mustResolveActor(t, ctx, createUsersTestSession(t, ctx, regularID))

		_, err := listUsers(ctx, regular, ListUsersQuery{})
		if err == nil {
			t.Fatal("expected permission error")
		}
		if errs.Code(err) != errs.PermissionDenied {
			t.Errorf("code = %v, want permission_denied", errs.Code(err))
		}
	})

	t.Run("filters by name or email", func(t *testing.T) {
		aliceID := createUsersTestUser(t, ctx, "Alice Unique Doe", string(SiteRoleUser), "", "")
		johnID := createUsersTestUser(t, ctx, "John Unique Doe", string(SiteRoleUser), "", "")
		adminID := createUsersTestUser(t, ctx, "Search Admin", string(SiteRoleSiteAdmin), "", "")
		admin := mustResolveActor(t, ctx, createUsersTestSession(t, ctx, adminID))

		resp, err := listUsers(ctx, admin, ListUsersQuery{Search: "Unique Doe"})
		if err != nil {
			t.Fatalf("listUsers failed: %v", err)
		}
		if !contains(resp.Users, aliceID) || !contains(resp.Users, johnID) {
			t.Errorf("search missed expected users: %+v", resp.Users)
		}
		if contains(resp.Users, adminID) {
			t.Errorf("search should not match admin")
		}
	})

	t.Run("filters by vrchatUsername", func(t *testing.T) {
		vrcID := createUsersTestUser(t, ctx, "Discord Name", string(SiteRoleUser), "", "UniqueVrcName")
		adminID := createUsersTestUser(t, ctx, "VRC Admin", string(SiteRoleSiteAdmin), "", "")
		admin := mustResolveActor(t, ctx, createUsersTestSession(t, ctx, adminID))

		resp, err := listUsers(ctx, admin, ListUsersQuery{Search: "UniqueVrcName"})
		if err != nil {
			t.Fatalf("listUsers failed: %v", err)
		}
		if !contains(resp.Users, vrcID) {
			t.Errorf("search missed vrchat user: %+v", resp.Users)
		}
		if contains(resp.Users, adminID) {
			t.Errorf("search should not match admin")
		}
	})

	t.Run("paginates with limit", func(t *testing.T) {
		createUsersTestUser(t, ctx, "P1", string(SiteRoleUser), "", "")
		createUsersTestUser(t, ctx, "P2", string(SiteRoleUser), "", "")
		createUsersTestUser(t, ctx, "P3", string(SiteRoleUser), "", "")
		adminID := createUsersTestUser(t, ctx, "Page Admin", string(SiteRoleSiteAdmin), "", "")
		admin := mustResolveActor(t, ctx, createUsersTestSession(t, ctx, adminID))

		resp, err := listUsers(ctx, admin, ListUsersQuery{Limit: 2})
		if err != nil {
			t.Fatalf("listUsers failed: %v", err)
		}
		if len(resp.Users) > 2 {
			t.Errorf("len(users) = %d, want <= 2", len(resp.Users))
		}
	})
}

// Test_setUserSiteRole covers the admin-only role assignment endpoint.
func Test_setUserSiteRole(t *testing.T) {
	ctx := context.Background()

	t.Run("admin can grant site admin", func(t *testing.T) {
		userID := createUsersTestUser(t, ctx, "Grant Target", string(SiteRoleUser), "", "")
		adminID := createUsersTestUser(t, ctx, "Grant Admin", string(SiteRoleSiteAdmin), "", "")
		admin := mustResolveActor(t, ctx, createUsersTestSession(t, ctx, adminID))

		updated, err := setUserSiteRole(ctx, admin, &SetUserSiteRoleParams{
			UserID:   userID,
			SiteRole: string(SiteRoleSiteAdmin),
		})
		if err != nil {
			t.Fatalf("setUserSiteRole failed: %v", err)
		}
		if updated.SiteRole != string(SiteRoleSiteAdmin) {
			t.Errorf("siteRole = %q, want SITE_ADMIN", updated.SiteRole)
		}
	})

	t.Run("regular user cannot grant roles", func(t *testing.T) {
		userID := createUsersTestUser(t, ctx, "Grant Victim", string(SiteRoleUser), "", "")
		regularID := createUsersTestUser(t, ctx, "Grant Regular", string(SiteRoleUser), "", "")
		regular := mustResolveActor(t, ctx, createUsersTestSession(t, ctx, regularID))

		_, err := setUserSiteRole(ctx, regular, &SetUserSiteRoleParams{
			UserID:   userID,
			SiteRole: string(SiteRoleSiteAdmin),
		})
		if err == nil {
			t.Fatal("expected permission error")
		}
		if errs.Code(err) != errs.PermissionDenied {
			t.Errorf("code = %v, want permission_denied", errs.Code(err))
		}
	})

	t.Run("rejects invalid role", func(t *testing.T) {
		userID := createUsersTestUser(t, ctx, "Role Target", string(SiteRoleUser), "", "")
		adminID := createUsersTestUser(t, ctx, "Role Admin", string(SiteRoleSiteAdmin), "", "")
		admin := mustResolveActor(t, ctx, createUsersTestSession(t, ctx, adminID))

		_, err := setUserSiteRole(ctx, admin, &SetUserSiteRoleParams{
			UserID:   userID,
			SiteRole: "SUPERUSER",
		})
		if err == nil {
			t.Fatal("expected invalid role error")
		}
		if errs.Code(err) != errs.InvalidArgument {
			t.Errorf("code = %v, want invalid_argument", errs.Code(err))
		}
	})

	t.Run("returns not found for missing user", func(t *testing.T) {
		adminID := createUsersTestUser(t, ctx, "Role Admin 2", string(SiteRoleSiteAdmin), "", "")
		admin := mustResolveActor(t, ctx, createUsersTestSession(t, ctx, adminID))

		_, err := setUserSiteRole(ctx, admin, &SetUserSiteRoleParams{
			UserID:   "userstest-nonexistent",
			SiteRole: string(SiteRoleUser),
		})
		if err == nil {
			t.Fatal("expected not found error")
		}
		if errs.Code(err) != errs.NotFound {
			t.Errorf("code = %v, want not_found", errs.Code(err))
		}
	})
}
