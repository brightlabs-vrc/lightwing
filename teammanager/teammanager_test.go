package teammanager

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"sync/atomic"
	"testing"
	"time"

	"encore.dev/beta/errs"
	"encore.dev/et"

	"encore.app/shared"
)

// TestMain sets up a single shared test database for all tests in this package.
func TestMain(m *testing.M) {
	ctx := context.Background()
	testDB, err := et.NewTestDatabase(ctx, "lightwing")
	if err == nil {
		shared.SetTestDB(testDB)
	}
	code := m.Run()
	os.Exit(code)
}

var teamTestSeq atomic.Int64

func nextTeamID(prefix string) string {
	return fmt.Sprintf("%s-%d", prefix, teamTestSeq.Add(1))
}

func fptr(f float64) *float64 { return &f }
func i32ptr(i int32) *int32   { return &i }
func sptr(s string) *string   { return &s }

func bearer(token string) string { return "Bearer " + token }

func insertTestUser(t *testing.T, ctx context.Context, id, name, siteRole string) {
	t.Helper()
	now := time.Now().UTC().Format(time.RFC3339Nano)
	_, err := db.Exec(ctx,
		`INSERT INTO "user" (id, name, email, image, "siteRole", biography, "vrchatUsername", slug, "createdAt", "updatedAt")
		 VALUES ($1, $2, $3, '', $4, '', '', $5, $6, $6)`,
		id, name, id+"@example.com", siteRole, id, now,
	)
	if err != nil {
		t.Fatalf("failed to insert user: %v", err)
	}
}

func insertTestSession(t *testing.T, ctx context.Context, userID string) string {
	t.Helper()
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}
	token := hex.EncodeToString(b[:])
	now := time.Now().UTC().Format(time.RFC3339Nano)
	exp := time.Now().UTC().Add(time.Hour).Format(time.RFC3339Nano)
	_, err := db.Exec(ctx,
		`INSERT INTO "session" (id, "userId", token, "expiresAt", "createdAt", "updatedAt")
		 VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $4)`,
		userID, token, exp, now,
	)
	if err != nil {
		t.Fatalf("failed to insert session: %v", err)
	}
	return token
}

type memberSpec struct {
	userID string
	role   string
	name   string
}

// createOrgWithMembers mirrors the TS helper: it creates an organization with
// the given members (creating each user), ordered by creation sequence.
func createOrgWithMembers(t *testing.T, ctx context.Context, id, name, slug string, members []memberSpec) string {
	t.Helper()
	now := time.Now().UTC().Format(time.RFC3339Nano)
	if _, err := db.Exec(ctx,
		`INSERT INTO "organization" (id, name, slug, "updatedAt") VALUES ($1, $2, $3, $4)`,
		id, name, slug, now,
	); err != nil {
		t.Fatalf("failed to insert organization: %v", err)
	}
	base := time.Now().UTC()
	for i, m := range members {
		insertTestUser(t, ctx, m.userID, m.name, "USER")
		createdAt := base.Add(time.Duration(i) * time.Microsecond).Format(time.RFC3339Nano)
		if _, err := db.Exec(ctx,
			`INSERT INTO "member" (id, "organizationId", "userId", role, "createdAt")
			 VALUES (gen_random_uuid()::text, $1, $2, $3, $4)`,
			id, m.userID, m.role, createdAt,
		); err != nil {
			t.Fatalf("failed to insert member: %v", err)
		}
	}
	return id
}

// Mirrors ts-legacy/teammanager/teams.test.ts → "getTeam returns mapped team
// with member summaries and stats".
func TestGetTeam(t *testing.T) {
	ctx := context.Background()
	id := nextTeamID("org-get-team")
	orgID := createOrgWithMembers(t, ctx, id, "Sky Team", nextTeamID("sky-team"), []memberSpec{
		{userID: nextTeamID("user-aster"), role: "administrator", name: "Aster"},
		{userID: nextTeamID("user-blake"), role: "administrator", name: "Blake"},
		{userID: nextTeamID("user-casey"), role: "member", name: "Casey"},
	})
	if _, err := db.Exec(ctx,
		`UPDATE "organization" SET "rankingAverage" = $1, "pointsAverage" = $2,
		 "seasonRank" = $3, "averagePointsPerEvent" = $4 WHERE id = $5`,
		4.2, 91.5, 7, 14.3, orgID,
	); err != nil {
		t.Fatalf("failed to set stats: %v", err)
	}

	team, err := getTeam(ctx, orgID)
	if err != nil {
		t.Fatalf("getTeam failed: %v", err)
	}
	if team.ID != orgID || team.Name != "Sky Team" || team.Logo != nil {
		t.Errorf("identity = %+v, want Sky Team with nil logo", team)
	}
	if team.Stats.RankingAverage == nil || *team.Stats.RankingAverage != 4.2 ||
		team.Stats.PointsAverage == nil || *team.Stats.PointsAverage != 91.5 ||
		team.Stats.SeasonRank == nil || *team.Stats.SeasonRank != 7 ||
		team.Stats.AveragePointsPerEvent == nil || *team.Stats.AveragePointsPerEvent != 14.3 {
		t.Errorf("stats = %+v, want 4.2/91.5/7/14.3", team.Stats)
	}
	if team.AdministratorSlotsRemaining != 1 {
		t.Errorf("slots = %d, want 1", team.AdministratorSlotsRemaining)
	}
	if len(team.Members) != 3 {
		t.Fatalf("members = %+v, want 3 entries", team.Members)
	}
	wantRoles := []string{"administrator", "administrator", "member"}
	for i, m := range team.Members {
		if m.Role != wantRoles[i] {
			t.Errorf("members[%d].role = %q, want %q", i, m.Role, wantRoles[i])
		}
	}
	if team.Members[0].Name != "Aster" || team.Members[2].Name != "Casey" {
		t.Errorf("member names = %+v, want Aster/Blake/Casey in creation order", team.Members)
	}

	t.Run("caps administratorSlotsRemaining at zero", func(t *testing.T) {
		heavyID := nextTeamID("org-admin-slots")
		createOrgWithMembers(t, ctx, heavyID, "Admin Heavy Team", nextTeamID("admin-heavy"), []memberSpec{
			{userID: nextTeamID("user-admin-1"), role: "administrator", name: "Admin One"},
			{userID: nextTeamID("user-admin-2"), role: "administrator", name: "Admin Two"},
			{userID: nextTeamID("user-admin-3"), role: "administrator", name: "Admin Three"},
			{userID: nextTeamID("user-admin-4"), role: "administrator", name: "Admin Four"},
		})
		team, err := getTeam(ctx, heavyID)
		if err != nil {
			t.Fatalf("getTeam failed: %v", err)
		}
		if team.AdministratorSlotsRemaining != 0 {
			t.Errorf("slots = %d, want 0", team.AdministratorSlotsRemaining)
		}
	})

	t.Run("throws not found when organization is missing", func(t *testing.T) {
		_, err := getTeam(ctx, "missing-org")
		if err == nil {
			t.Fatal("expected not found error")
		}
		if errs.Code(err) != errs.NotFound {
			t.Errorf("code = %v, want not_found", errs.Code(err))
		}
	})
}

// Mirrors teams.test.ts → "updateTeamStats enforces permission and updates
// only provided fields" + the missing-organization case.
func TestUpdateTeamStats(t *testing.T) {
	ctx := context.Background()

	t.Run("enforces permission and updates only provided fields", func(t *testing.T) {
		orgID := nextTeamID("org-update-team")
		updater := nextTeamID("user-updater")
		createOrgWithMembers(t, ctx, orgID, "Update Team", nextTeamID("update-team"), []memberSpec{
			{userID: updater, role: "administrator", name: "Updater"},
		})
		token := insertTestSession(t, ctx, updater)

		team, err := updateTeamStats(ctx, bearer(token), orgID, &TeamStatsUpdate{
			RankingAverage: fptr(5.5),
			PointsAverage:  fptr(99.1),
		})
		if err != nil {
			t.Fatalf("updateTeamStats failed: %v", err)
		}
		if team.Stats.RankingAverage == nil || *team.Stats.RankingAverage != 5.5 ||
			team.Stats.PointsAverage == nil || *team.Stats.PointsAverage != 99.1 {
			t.Errorf("stats = %+v, want 5.5/99.1", team.Stats)
		}
		if team.Stats.SeasonRank != nil || team.Stats.AveragePointsPerEvent != nil {
			t.Errorf("untouched stats should stay null: %+v", team.Stats)
		}
	})

	t.Run("rejects callers without update permission", func(t *testing.T) {
		orgID := nextTeamID("org-stats-deny")
		admin := nextTeamID("user-stats-admin")
		outsider := nextTeamID("user-outsider")
		createOrgWithMembers(t, ctx, orgID, "Stats Deny", nextTeamID("stats-deny"), []memberSpec{
			{userID: admin, role: "administrator", name: "Admin"},
		})
		insertTestUser(t, ctx, outsider, "Outsider", "USER")
		token := insertTestSession(t, ctx, outsider)
		if _, err := updateTeamStats(ctx, bearer(token), orgID, &TeamStatsUpdate{
			PointsAverage: fptr(1.0),
		}); err == nil {
			t.Fatal("expected permission error")
		} else if errs.Code(err) != errs.PermissionDenied {
			t.Errorf("code = %v, want permission_denied", errs.Code(err))
		}
	})

	t.Run("throws not found for missing organization", func(t *testing.T) {
		siteAdmin := nextTeamID("site-admin-missing-org")
		insertTestUser(t, ctx, siteAdmin, "Missing Org Site Admin", "SITE_ADMIN")
		token := insertTestSession(t, ctx, siteAdmin)
		_, err := updateTeamStats(ctx, bearer(token), "missing-org", &TeamStatsUpdate{
			PointsAverage: fptr(12.3),
		})
		if err == nil {
			t.Fatal("expected not found error")
		}
		if errs.Code(err) != errs.NotFound {
			t.Errorf("code = %v, want not_found", errs.Code(err))
		}
	})
}

// Mirrors teams.test.ts → the three createTeam cases.
func TestCreateTeam(t *testing.T) {
	ctx := context.Background()

	t.Run("creates team and listTeams lists it", func(t *testing.T) {
		siteAdmin := nextTeamID("site-admin-create-team")
		insertTestUser(t, ctx, siteAdmin, "Create Team Site Admin", "SITE_ADMIN")
		token := insertTestSession(t, ctx, siteAdmin)

		name := fmt.Sprintf("Alpha Racing Syndicate %d", teamTestSeq.Add(1))
		team, err := createTeam(ctx, bearer(token), name, nil)
		if err != nil {
			t.Fatalf("createTeam failed: %v", err)
		}
		if team.Name != name {
			t.Errorf("name = %q, want %q", team.Name, name)
		}
		wantSlug := slugifyTeamName(name)
		if team.Slug != wantSlug {
			t.Errorf("slug = %q, want %q", team.Slug, wantSlug)
		}
		if len(team.Members) != 0 {
			t.Errorf("new team should have no members: %+v", team.Members)
		}

		resp, err := listTeams(ctx, "", 0, 0)
		if err != nil {
			t.Fatalf("listTeams failed: %v", err)
		}
		found := false
		for _, li := range resp.Teams {
			if li.ID == team.ID && li.Slug == wantSlug {
				found = true
			}
		}
		if !found {
			t.Errorf("created team %q missing from list (total=%d)", team.ID, resp.Total)
		}
	})

	t.Run("rejects non-site-admins", func(t *testing.T) {
		regular := nextTeamID("regular-user-create-team")
		insertTestUser(t, ctx, regular, "Regular User", "USER")
		token := insertTestSession(t, ctx, regular)
		if _, err := createTeam(ctx, bearer(token), "Forbidden Team", nil); err == nil {
			t.Fatal("expected permission error")
		} else if errs.Code(err) != errs.PermissionDenied {
			t.Errorf("code = %v, want permission_denied", errs.Code(err))
		}
	})

	t.Run("slug collision yields already_exists", func(t *testing.T) {
		siteAdmin := nextTeamID("site-admin-col")
		insertTestUser(t, ctx, siteAdmin, "Collision Site Admin", "SITE_ADMIN")
		token := insertTestSession(t, ctx, siteAdmin)
		name := fmt.Sprintf("Collision Team %d", teamTestSeq.Add(1))
		if _, err := createTeam(ctx, bearer(token), name, nil); err != nil {
			t.Fatalf("first createTeam failed: %v", err)
		}
		if _, err := createTeam(ctx, bearer(token), name, nil); err == nil {
			t.Fatal("expected already_exists error")
		} else if errs.Code(err) != errs.AlreadyExists {
			t.Errorf("code = %v, want already_exists", errs.Code(err))
		}
	})
}

// Mirrors teams.test.ts → "addTeamMember, updateTeamMemberRole, and
// removeTeamMember endpoints and limitations".
func TestTeamMembers(t *testing.T) {
	ctx := context.Background()
	orgID := nextTeamID("org-members-mgmt")
	admin1 := nextTeamID("member-admin-1")
	admin2 := nextTeamID("member-admin-2")
	createOrgWithMembers(t, ctx, orgID, "Members Management Team", nextTeamID("members-mgmt"), []memberSpec{
		{userID: admin1, role: "administrator", name: "Admin One"},
		{userID: admin2, role: "administrator", name: "Admin Two"},
	})
	adminToken := insertTestSession(t, ctx, admin1)
	authz := bearer(adminToken)

	newMember := nextTeamID("user-new-member")
	insertTestUser(t, ctx, newMember, "New Member", "USER")

	teamAfterAdd, err := addTeamMember(ctx, authz, orgID, newMember, "member")
	if err != nil {
		t.Fatalf("addTeamMember failed: %v", err)
	}
	if !hasMemberWithRole(teamAfterAdd, newMember, "member") {
		t.Errorf("added member missing: %+v", teamAfterAdd.Members)
	}

	if _, err := addTeamMember(ctx, authz, orgID, newMember, "member"); err == nil {
		t.Fatal("expected already_exists for duplicate member")
	} else if errs.Code(err) != errs.AlreadyExists {
		t.Errorf("code = %v, want already_exists", errs.Code(err))
	}

	// Administrator slots remaining is 1: adding a third admin succeeds...
	newAdmin1 := nextTeamID("user-new-admin-1")
	insertTestUser(t, ctx, newAdmin1, "New Admin One", "USER")
	if _, err := addTeamMember(ctx, authz, orgID, newAdmin1, "administrator"); err != nil {
		t.Fatalf("adding third admin failed: %v", err)
	}

	// ...but a fourth administrator hits the cap.
	newAdmin2 := nextTeamID("user-new-admin-2")
	insertTestUser(t, ctx, newAdmin2, "New Admin Two", "USER")
	if _, err := addTeamMember(ctx, authz, orgID, newAdmin2, "administrator"); err == nil {
		t.Fatal("expected failed_precondition for fourth admin")
	} else if errs.Code(err) != errs.FailedPrecondition {
		t.Errorf("code = %v, want failed_precondition", errs.Code(err))
	}

	// Role updates to a non-cap role succeed even at the cap.
	teamAfterUpdate, err := updateTeamMemberRole(ctx, authz, orgID, newMember, "organizationAdministrator")
	if err != nil {
		t.Fatalf("updateTeamMemberRole failed: %v", err)
	}
	if !hasMemberWithRole(teamAfterUpdate, newMember, "organizationAdministrator") {
		t.Errorf("updated member missing: %+v", teamAfterUpdate.Members)
	}

	// Promoting to administrator at the cap fails.
	if _, err := updateTeamMemberRole(ctx, authz, orgID, newMember, "administrator"); err == nil {
		t.Fatal("expected failed_precondition promoting at cap")
	} else if errs.Code(err) != errs.FailedPrecondition {
		t.Errorf("code = %v, want failed_precondition", errs.Code(err))
	}

	teamAfterRemove, err := removeTeamMember(ctx, authz, orgID, newMember)
	if err != nil {
		t.Fatalf("removeTeamMember failed: %v", err)
	}
	if hasMember(teamAfterRemove, newMember) {
		t.Errorf("removed member still present: %+v", teamAfterRemove.Members)
	}

	t.Run("remove missing member yields not found", func(t *testing.T) {
		if _, err := removeTeamMember(ctx, authz, orgID, newMember); err == nil {
			t.Fatal("expected not found error")
		} else if errs.Code(err) != errs.NotFound {
			t.Errorf("code = %v, want not_found", errs.Code(err))
		}
	})

	t.Run("add member to missing team is denied (permission checked first)", func(t *testing.T) {
		// Mirrors TS ordering: requirePermission runs before the
		// organization lookup, so a non-site-admin caller without a grant
		// on "missing-org" gets permission_denied, not not_found.
		if _, err := addTeamMember(ctx, authz, "missing-org", newAdmin2, "member"); err == nil {
			t.Fatal("expected permission error")
		} else if errs.Code(err) != errs.PermissionDenied {
			t.Errorf("code = %v, want permission_denied", errs.Code(err))
		}
	})
}

func hasMember(team *Team, userID string) bool {
	for _, m := range team.Members {
		if m.UserID == userID {
			return true
		}
	}
	return false
}

func hasMemberWithRole(team *Team, userID, role string) bool {
	for _, m := range team.Members {
		if m.UserID == userID && m.Role == role {
			return true
		}
	}
	return false
}

// Covers updateTeam: metadata edits, slug validation/collision, and guards.
func TestUpdateTeam(t *testing.T) {
	ctx := context.Background()
	orgID := nextTeamID("org-update-meta")
	admin := nextTeamID("user-meta-admin")
	slug := nextTeamID("meta-team")
	createOrgWithMembers(t, ctx, orgID, "Meta Team", slug, []memberSpec{
		{userID: admin, role: "administrator", name: "Admin"},
	})
	adminToken := insertTestSession(t, ctx, admin)

	t.Run("team admin can rename and reslug", func(t *testing.T) {
		newSlug := nextTeamID("renamed-team")
		team, err := updateTeam(ctx, bearer(adminToken), orgID, &UpdateTeamParams{
			Name: sptr("Renamed Team"),
			Slug: sptr(newSlug),
		})
		if err != nil {
			t.Fatalf("updateTeam failed: %v", err)
		}
		if team.Name != "Renamed Team" || team.Slug != newSlug {
			t.Errorf("team = %+v, want renamed", team)
		}
		bySlug, err := getTeamBySlug(ctx, newSlug)
		if err != nil {
			t.Fatalf("getTeamBySlug failed: %v", err)
		}
		if bySlug.ID != orgID {
			t.Errorf("bySlug.ID = %q, want %q", bySlug.ID, orgID)
		}
	})

	t.Run("rejects invalid slug", func(t *testing.T) {
		if _, err := updateTeam(ctx, bearer(adminToken), orgID, &UpdateTeamParams{
			Slug: sptr("BAD SLUG!!"),
		}); err == nil {
			t.Fatal("expected invalid_argument error")
		} else if errs.Code(err) != errs.InvalidArgument {
			t.Errorf("code = %v, want invalid_argument", errs.Code(err))
		}
	})

	t.Run("rejects slug collision", func(t *testing.T) {
		otherID := nextTeamID("org-other")
		otherSlug := nextTeamID("other-team")
		createOrgWithMembers(t, ctx, otherID, "Other Team", otherSlug, nil)
		if _, err := updateTeam(ctx, bearer(adminToken), orgID, &UpdateTeamParams{
			Slug: sptr(otherSlug),
		}); err == nil {
			t.Fatal("expected already_exists error")
		} else if errs.Code(err) != errs.AlreadyExists {
			t.Errorf("code = %v, want already_exists", errs.Code(err))
		}
	})

	t.Run("rejects outsiders and missing teams", func(t *testing.T) {
		outsider := nextTeamID("user-outsider-meta")
		insertTestUser(t, ctx, outsider, "Outsider", "USER")
		outsiderToken := insertTestSession(t, ctx, outsider)
		if _, err := updateTeam(ctx, bearer(outsiderToken), orgID, &UpdateTeamParams{
			Name: sptr("Hijacked"),
		}); err == nil {
			t.Fatal("expected permission error")
		} else if errs.Code(err) != errs.PermissionDenied {
			t.Errorf("code = %v, want permission_denied", errs.Code(err))
		}
		siteAdmin := nextTeamID("site-admin-meta")
		insertTestUser(t, ctx, siteAdmin, "Meta Site Admin", "SITE_ADMIN")
		siteToken := insertTestSession(t, ctx, siteAdmin)
		if _, err := updateTeam(ctx, bearer(siteToken), "missing-org", &UpdateTeamParams{
			Name: sptr("Ghost"),
		}); err == nil {
			t.Fatal("expected not found error")
		} else if errs.Code(err) != errs.NotFound {
			t.Errorf("code = %v, want not_found", errs.Code(err))
		}
	})
}

// Covers getTeamBySlug and listTeamMembers (search + pagination).
func TestTeamLookups(t *testing.T) {
	ctx := context.Background()
	orgID := nextTeamID("org-lookups")
	slug := nextTeamID("lookup-team")
	alice := nextTeamID("user-alice")
	bob := nextTeamID("user-bob")
	createOrgWithMembers(t, ctx, orgID, "Lookup Team", slug, []memberSpec{
		{userID: alice, role: "administrator", name: "Alice"},
		{userID: bob, role: "member", name: "Bobby"},
	})

	t.Run("getTeamBySlug round-trips", func(t *testing.T) {
		team, err := getTeamBySlug(ctx, slug)
		if err != nil {
			t.Fatalf("getTeamBySlug failed: %v", err)
		}
		if team.ID != orgID || len(team.Members) != 2 {
			t.Errorf("team = %+v, want 2 members", team)
		}
		if _, err := getTeamBySlug(ctx, "no-such-slug"); err == nil {
			t.Fatal("expected not found error")
		} else if errs.Code(err) != errs.NotFound {
			t.Errorf("code = %v, want not_found", errs.Code(err))
		}
	})

	t.Run("listTeamMembers searches and paginates", func(t *testing.T) {
		resp, err := listTeamMembers(ctx, orgID, "", 0, 0)
		if err != nil {
			t.Fatalf("listTeamMembers failed: %v", err)
		}
		if resp.Total != 2 || len(resp.Members) != 2 {
			t.Fatalf("resp = %+v, want total 2", resp)
		}
		search, err := listTeamMembers(ctx, orgID, "bob", 0, 0)
		if err != nil {
			t.Fatalf("search failed: %v", err)
		}
		if search.Total != 1 || search.Members[0].Name != "Bobby" {
			t.Errorf("search = %+v, want Bobby only", search)
		}
		page, err := listTeamMembers(ctx, orgID, "", 1, 1)
		if err != nil {
			t.Fatalf("pagination failed: %v", err)
		}
		if len(page.Members) != 1 || page.Total != 2 {
			t.Errorf("page = %+v, want 1 of 2", page)
		}
	})
}
