package teammanager

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
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
		resetStdPool()
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
		 VALUES ($1, $2, $3, '', $4, '', '', $5, $6, $6)
		 ON CONFLICT (id) DO NOTHING`,
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

func createTeamWithRoster(t *testing.T, ctx context.Context, id, name, slug string, members []memberSpec) string {
	t.Helper()
	now := time.Now().UTC().Format(time.RFC3339Nano)
	if _, err := db.Exec(ctx,
		`INSERT INTO "team" (id, name, slug, status, "createdAt", "updatedAt") VALUES ($1, $2, $3, 'APPROVED', $4, $4)`,
		id, name, slug, now,
	); err != nil {
		t.Fatalf("failed to insert team: %v", err)
	}
	base := time.Now().UTC()
	for i, m := range members {
		insertTestUser(t, ctx, m.userID, m.name, "USER")
		createdAt := base.Add(time.Duration(i) * time.Microsecond).Format(time.RFC3339Nano)
		if _, err := db.Exec(ctx,
			`INSERT INTO "teamMember" (id, "teamId", "userId", role, "createdAt")
			 VALUES (gen_random_uuid()::text, $1, $2, $3, $4)`,
			id, m.userID, m.role, createdAt,
		); err != nil {
			t.Fatalf("failed to insert team member: %v", err)
		}
	}
	return id
}

// Tests getTeam for competition teams stored in `team` table.
func TestGetTeam(t *testing.T) {
	ctx := context.Background()
	id := nextTeamID("team-get-team")
	teamID := createTeamWithRoster(t, ctx, id, "Sky Team", nextTeamID("sky-team"), []memberSpec{
		{userID: nextTeamID("user-aster"), role: "administrator", name: "Aster"},
		{userID: nextTeamID("user-blake"), role: "administrator", name: "Blake"},
		{userID: nextTeamID("user-casey"), role: "member", name: "Casey"},
	})

	team, err := getTeam(ctx, teamID)
	if err != nil {
		t.Fatalf("getTeam failed: %v", err)
	}
	if team.ID != teamID || team.Name != "Sky Team" || team.Logo != nil {
		t.Errorf("identity = %+v, want Sky Team with nil logo", team)
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

	t.Run("throws not found when team is missing", func(t *testing.T) {
		_, err := getTeam(ctx, "missing-team-999")
		if err == nil {
			t.Fatal("expected not found error")
		}
		if errs.Code(err) != errs.NotFound {
			t.Errorf("code = %v, want not_found", errs.Code(err))
		}
	})
}

// Tests getAdminOrganization for organizations stored in `organization` table.
func TestGetAdminOrganization(t *testing.T) {
	ctx := context.Background()
	id := nextTeamID("org-get-admin")
	orgID := createOrgWithMembers(t, ctx, id, "Apex Association", nextTeamID("apex-assoc"), []memberSpec{
		{userID: nextTeamID("user-org-admin1"), role: "administrator", name: "Org Admin One"},
		{userID: nextTeamID("user-org-admin2"), role: "administrator", name: "Org Admin Two"},
	})

	orgDetail, err := getAdminOrganization(ctx, orgID)
	if err != nil {
		t.Fatalf("getAdminOrganization failed: %v", err)
	}
	if orgDetail.ID != orgID || orgDetail.Name != "Apex Association" {
		t.Errorf("orgDetail = %+v, want Apex Association", orgDetail)
	}
	if orgDetail.AdministratorSlotsRemaining != 1 {
		t.Errorf("slots = %d, want 1", orgDetail.AdministratorSlotsRemaining)
	}
	if len(orgDetail.Members) != 2 {
		t.Fatalf("members = %+v, want 2 entries", orgDetail.Members)
	}
}

func Test_ApplicationsAndPrimarySecondaryLinking(t *testing.T) {
	ctx := context.Background()

	// Setup users and roles
	applicantUser := nextTeamID("applicant")
	insertTestUser(t, ctx, applicantUser, "Applicant User", "USER")
	applicantToken := insertTestSession(t, ctx, applicantUser)

	siteAdmin := nextTeamID("app-site-admin")
	insertTestUser(t, ctx, siteAdmin, "App Site Admin", "SITE_ADMIN")
	siteAdminToken := insertTestSession(t, ctx, siteAdmin)

	eventAdmin := nextTeamID("app-event-admin")
	insertTestUser(t, ctx, eventAdmin, "App Event Admin", "EVENT_ADMIN")
	eventAdminToken := insertTestSession(t, ctx, eventAdmin)

	t.Run("Submit and review Organization application", func(t *testing.T) {
		orgApp, err := submitOrganizationApplication(ctx, &SubmitOrgApplicationRequest{
			Authorization: bearer(applicantToken),
			Name:          "Apex Esports",
			DiscordInvite: "https://discord.gg/apex",
			VrchatGroupID: "grp_apex_123",
		})
		if err != nil {
			t.Fatalf("submitOrganizationApplication failed: %v", err)
		}
		if orgApp.Status != "PENDING" || orgApp.DiscordInvite != "https://discord.gg/apex" {
			t.Errorf("orgApp = %+v, want PENDING with discord invite", orgApp)
		}

		// EVENT_ADMIN cannot see org applications
		listEvt, err := listAdminApplications(ctx, bearer(eventAdminToken))
		if err != nil {
			t.Fatalf("listAdminApplications failed for EVENT_ADMIN: %v", err)
		}
		if len(listEvt.Organizations) != 0 {
			t.Errorf("EVENT_ADMIN should not see org applications: %+v", listEvt.Organizations)
		}

		// SITE_ADMIN sees org applications
		listSite, err := listAdminApplications(ctx, bearer(siteAdminToken))
		if err != nil {
			t.Fatalf("listAdminApplications failed for SITE_ADMIN: %v", err)
		}
		found := false
		for _, o := range listSite.Organizations {
			if o.ID == orgApp.ID {
				found = true
			}
		}
		if !found {
			t.Errorf("org app %s not found in site admin list", orgApp.ID)
		}

		// Approve organization application
		err = reviewApplication(ctx, &ReviewApplicationRequest{
			Authorization: bearer(siteAdminToken),
			ID:            orgApp.ID,
			Type:          "ORGANIZATION",
			Action:        "APPROVE",
		})
		if err != nil {
			t.Fatalf("reviewApplication APPROVE failed: %v", err)
		}
	})

	t.Run("Submit team application and primary/secondary org linking", func(t *testing.T) {
		// Create 2 approved organizations
		org1ID := createOrgWithMembers(t, ctx, nextTeamID("org-prim"), "Primary Org", nextTeamID("prim-slug"), []memberSpec{
			{userID: applicantUser, role: "administrator", name: "Applicant"},
		})
		org2ID := createOrgWithMembers(t, ctx, nextTeamID("org-sec"), "Secondary Org", nextTeamID("sec-slug"), []memberSpec{
			{userID: applicantUser, role: "administrator", name: "Applicant"},
		})
		_, _ = db.Exec(ctx, `UPDATE "organization" SET status = 'APPROVED' WHERE id IN ($1, $2)`, org1ID, org2ID)

		teamApp, err := submitTeamApplication(ctx, &SubmitTeamApplicationRequest{
			Authorization:         bearer(applicantToken),
			Name:                  "Apex Racing Red",
			PrimaryOrganizationID: org1ID,
		})
		if err != nil {
			t.Fatalf("submitTeamApplication failed: %v", err)
		}
		if teamApp.Status != "PENDING" || teamApp.PrimaryOrganization.ID != org1ID {
			t.Errorf("teamApp = %+v, want PENDING linked to org1", teamApp)
		}

		// Approve team application via EVENT_ADMIN
		err = reviewApplication(ctx, &ReviewApplicationRequest{
			Authorization: bearer(eventAdminToken),
			ID:            teamApp.ID,
			Type:          "TEAM",
			Action:        "APPROVE",
		})
		if err != nil {
			t.Fatalf("reviewApplication for team failed: %v", err)
		}

		// Link secondary org
		linkedTeam, err := linkSecondaryOrganization(ctx, &LinkSecondaryOrgRequest{
			Authorization:  bearer(applicantToken),
			TeamID:         teamApp.ID,
			OrganizationID: org2ID,
		})
		if err != nil {
			t.Fatalf("linkSecondaryOrganization failed: %v", err)
		}
		if len(linkedTeam.Organizations) != 2 {
			t.Errorf("linkedTeam.Organizations = %+v, want 2 orgs", linkedTeam.Organizations)
		}

		// Cannot unlink primary org
		_, err = unlinkSecondaryOrganization(ctx, &UnlinkSecondaryOrgRequest{
			Authorization:  bearer(applicantToken),
			TeamID:         teamApp.ID,
			OrganizationID: org1ID,
		})
		if err == nil {
			t.Fatal("expected error when unlinking primary org")
		}

		// Unlink secondary org succeeds
		unlinkedTeam, err := unlinkSecondaryOrganization(ctx, &UnlinkSecondaryOrgRequest{
			Authorization:  bearer(applicantToken),
			TeamID:         teamApp.ID,
			OrganizationID: org2ID,
		})
		if err != nil {
			t.Fatalf("unlinkSecondaryOrganization failed: %v", err)
		}
		if len(unlinkedTeam.Organizations) != 1 {
			t.Errorf("unlinkedTeam.Organizations = %+v, want 1 org", unlinkedTeam.Organizations)
		}
	})

	t.Run("ConvertTeamToOrg and existing team application flow", func(t *testing.T) {
		siteAdminUser := nextTeamID("site-admin-cvt")
		insertTestUser(t, ctx, siteAdminUser, "Convert Site Admin", "SITE_ADMIN")
		siteAdminTok := insertTestSession(t, ctx, siteAdminUser)

		// Create an approved organization
		targetOrgID := createOrgWithMembers(t, ctx, nextTeamID("org-target"), "Target Organization", nextTeamID("target-org-slug"), []memberSpec{
			{userID: siteAdminUser, role: "administrator", name: "Site Admin"},
		})
		_, _ = db.Exec(ctx, `UPDATE "organization" SET status = 'APPROVED' WHERE id = $1`, targetOrgID)

		// Create a team via createTeam
		teamName := "Velocity Racing"
		newTeam, err := createTeam(ctx, bearer(siteAdminTok), teamName, nil, nil, nil)
		if err != nil {
			t.Fatalf("createTeam failed: %v", err)
		}

		// Add an admin user to the new team
		teamAdminUser := nextTeamID("user-team-admin")
		insertTestUser(t, ctx, teamAdminUser, "Team Admin User", "USER")
		teamAdminTok := insertTestSession(t, ctx, teamAdminUser)
		_, err = addTeamMember(ctx, bearer(siteAdminTok), newTeam.ID, teamAdminUser, "administrator")
		if err != nil {
			t.Fatalf("addTeamMember failed: %v", err)
		}

		// Convert team to organization
		convertedTeam, err := convertTeamToOrg(ctx, bearer(siteAdminTok), newTeam.ID)
		if err != nil {
			t.Fatalf("convertTeamToOrg failed: %v", err)
		}
		if convertedTeam == nil || convertedTeam.ID == "" {
			t.Errorf("convertTeamToOrg returned invalid organization: %+v", convertedTeam)
		}

		// Verify team record in `team` table is deleted
		if _, err := q().GetTeamByID(ctx, newTeam.ID); !errors.Is(err, sql.ErrNoRows) {
			t.Errorf("expected team record to be deleted, got err = %v", err)
		}

		// Verify organization record exists with migrated roster
		orgRow, err := q().GetOrgByID(ctx, convertedTeam.ID)
		if err != nil {
			t.Fatalf("GetOrgByID failed: %v", err)
		}
		if orgRow.Name != teamName {
			t.Errorf("orgRow.Name = %s, want %s", orgRow.Name, teamName)
		}

		// Check roster in member table
		members, err := q().ListMemberRows(ctx, convertedTeam.ID)
		if err != nil {
			t.Fatalf("ListMemberRows failed: %v", err)
		}
		if len(members) == 0 {
			t.Errorf("expected migrated roster members in organization, got 0")
		}

		// Existing team applies to join target organization (using a newly created team)
		secondTeam, err := createTeam(ctx, bearer(siteAdminTok), "Second Velocity Team", nil, nil, nil)
		if err != nil {
			t.Fatalf("createTeam secondTeam failed: %v", err)
		}
		_, err = addTeamMember(ctx, bearer(siteAdminTok), secondTeam.ID, teamAdminUser, "administrator")
		if err != nil {
			t.Fatalf("addTeamMember for secondTeam failed: %v", err)
		}

		appView, err := submitTeamApplication(ctx, &SubmitTeamApplicationRequest{
			Authorization:         bearer(teamAdminTok),
			TeamID:                sptr(secondTeam.ID),
			PrimaryOrganizationID: targetOrgID,
		})
		if err != nil {
			t.Fatalf("submitTeamApplication for existing team failed: %v", err)
		}
		if appView.Status != "PENDING" || appView.PrimaryOrganization.ID != targetOrgID {
			t.Errorf("appView = %+v, want PENDING with primary org = %s", appView, targetOrgID)
		}
	})

	t.Run("ConvertTeamToOrg fallback and slug lookups", func(t *testing.T) {
		siteAdminUser := nextTeamID("site-admin-cvt2")
		insertTestUser(t, ctx, siteAdminUser, "Convert Site Admin 2", "SITE_ADMIN")
		siteAdminTok := insertTestSession(t, ctx, siteAdminUser)

		// 1. Create a team and convert by team slug
		newTeam, err := createTeam(ctx, bearer(siteAdminTok), "Slug Team Test", nil, nil, nil)
		if err != nil {
			t.Fatalf("createTeam failed: %v", err)
		}
		convertedBySlug, err := convertTeamToOrg(ctx, bearer(siteAdminTok), newTeam.Slug)
		if err != nil {
			t.Fatalf("convertTeamToOrg by slug failed: %v", err)
		}
		if convertedBySlug.ID != newTeam.ID {
			t.Errorf("convertedBySlug.ID = %s, want %s", convertedBySlug.ID, newTeam.ID)
		}

		// 2. Convert a legacy organization (record in `organization` table) by ID
		legacyOrgSlug := nextTeamID("legacy-org-slug")
		legacyOrgID := createOrgWithMembers(t, ctx, nextTeamID("org-legacy"), "Legacy Org", legacyOrgSlug, []memberSpec{
			{userID: siteAdminUser, role: "administrator", name: "Site Admin"},
		})
		convertedLegacyID, err := convertTeamToOrg(ctx, bearer(siteAdminTok), legacyOrgID)
		if err != nil {
			t.Fatalf("convertTeamToOrg for legacy org ID failed: %v", err)
		}
		if convertedLegacyID.ID != legacyOrgID {
			t.Errorf("convertedLegacyID.ID = %s, want %s", convertedLegacyID.ID, legacyOrgID)
		}

		// 3. Convert a legacy organization by slug
		convertedLegacySlug, err := convertTeamToOrg(ctx, bearer(siteAdminTok), legacyOrgSlug)
		if err != nil {
			t.Fatalf("convertTeamToOrg for legacy org slug failed: %v", err)
		}
		if convertedLegacySlug.ID != legacyOrgID {
			t.Errorf("convertedLegacySlug.ID = %s, want %s", convertedLegacySlug.ID, legacyOrgID)
		}

		// 4. Missing team returns 404 Not Found
		_, err = convertTeamToOrg(ctx, bearer(siteAdminTok), "missing-team-or-org-12345")
		if err == nil {
			t.Fatal("expected error for missing team/org")
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

		// Create a competition team in the team table for stats testing
		teamName := "Update Team Competition"
		siteAdminUser := nextTeamID("site-admin-stats")
		insertTestUser(t, ctx, siteAdminUser, "Stats Site Admin", "SITE_ADMIN")
		siteToken := insertTestSession(t, ctx, siteAdminUser)
		compTeam, err := createTeam(ctx, bearer(siteToken), teamName, nil, nil, &orgID)
		if err != nil {
			t.Fatalf("createTeam failed: %v", err)
		}

		team, err := updateTeamStats(ctx, bearer(siteToken), compTeam.ID, &TeamStatsUpdate{
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
		team, err := createTeam(ctx, bearer(token), name, nil, nil, nil)
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
		if _, err := createTeam(ctx, bearer(token), "Forbidden Team", nil, nil, nil); err == nil {
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
		if _, err := createTeam(ctx, bearer(token), name, nil, nil, nil); err != nil {
			t.Fatalf("first createTeam failed: %v", err)
		}
		if _, err := createTeam(ctx, bearer(token), name, nil, nil, nil); err == nil {
			t.Fatal("expected already_exists error")
		} else if errs.Code(err) != errs.AlreadyExists {
			t.Errorf("code = %v, want already_exists", errs.Code(err))
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

// Covers updateTeam: metadata edits, slug validation/collision, and guards.
func TestUpdateTeam(t *testing.T) {
	ctx := context.Background()
	siteAdmin := nextTeamID("site-admin-update-meta")
	insertTestUser(t, ctx, siteAdmin, "Site Admin Update", "SITE_ADMIN")
	siteToken := insertTestSession(t, ctx, siteAdmin)

	teamID := createTeamWithRoster(t, ctx, nextTeamID("team-update-meta"), "Meta Team", nextTeamID("meta-team"), []memberSpec{
		{userID: siteAdmin, role: "administrator", name: "Site Admin"},
	})

	t.Run("site admin can rename and reslug", func(t *testing.T) {
		newSlug := nextTeamID("renamed-team")
		team, err := updateTeam(ctx, bearer(siteToken), teamID, &UpdateTeamParams{
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
		if bySlug.ID != teamID {
			t.Errorf("bySlug.ID = %q, want %q", bySlug.ID, teamID)
		}
	})

	t.Run("rejects invalid slug", func(t *testing.T) {
		if _, err := updateTeam(ctx, bearer(siteToken), teamID, &UpdateTeamParams{
			Slug: sptr("BAD SLUG!!"),
		}); err == nil {
			t.Fatal("expected invalid_argument error")
		} else if errs.Code(err) != errs.InvalidArgument {
			t.Errorf("code = %v, want invalid_argument", errs.Code(err))
		}
	})

	t.Run("rejects slug collision", func(t *testing.T) {
		otherID := nextTeamID("team-other")
		otherSlug := nextTeamID("other-team")
		createTeamWithRoster(t, ctx, otherID, "Other Team", otherSlug, nil)
		if _, err := updateTeam(ctx, bearer(siteToken), teamID, &UpdateTeamParams{
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
		if _, err := updateTeam(ctx, bearer(outsiderToken), teamID, &UpdateTeamParams{
			Name: sptr("Hijacked"),
		}); err == nil {
			t.Fatal("expected permission error")
		} else if errs.Code(err) != errs.PermissionDenied {
			t.Errorf("code = %v, want permission_denied", errs.Code(err))
		}
		if _, err := updateTeam(ctx, bearer(siteToken), "missing-team-999", &UpdateTeamParams{
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
	teamID := nextTeamID("team-lookups")
	slug := nextTeamID("lookup-team")
	alice := nextTeamID("user-alice")
	bob := nextTeamID("user-bob")
	createTeamWithRoster(t, ctx, teamID, "Lookup Team", slug, []memberSpec{
		{userID: alice, role: "administrator", name: "Alice"},
		{userID: bob, role: "member", name: "Bobby"},
	})

	t.Run("getTeamBySlug round-trips", func(t *testing.T) {
		team, err := getTeamBySlug(ctx, slug)
		if err != nil {
			t.Fatalf("getTeamBySlug failed: %v", err)
		}
		if team.ID != teamID || len(team.Members) != 2 {
			t.Errorf("team = %+v, want 2 members", team)
		}
		if _, err := getTeamBySlug(ctx, "no-such-slug"); err == nil {
			t.Fatal("expected not found error")
		} else if errs.Code(err) != errs.NotFound {
			t.Errorf("code = %v, want not_found", errs.Code(err))
		}
	})

	t.Run("listTeamMembers searches and paginates", func(t *testing.T) {
		resp, err := listTeamMembers(ctx, teamID, "", 0, 0)
		if err != nil {
			t.Fatalf("listTeamMembers failed: %v", err)
		}
		if resp.Total != 2 || len(resp.Members) != 2 {
			t.Fatalf("resp = %+v, want total 2", resp)
		}
		search, err := listTeamMembers(ctx, teamID, "bob", 0, 0)
		if err != nil {
			t.Fatalf("search failed: %v", err)
		}
		if search.Total != 1 || search.Members[0].Name != "Bobby" {
			t.Errorf("search = %+v, want Bobby only", search)
		}
		page, err := listTeamMembers(ctx, teamID, "", 1, 1)
		if err != nil {
			t.Fatalf("pagination failed: %v", err)
		}
		if len(page.Members) != 1 || page.Total != 2 {
			t.Errorf("page = %+v, want 1 of 2", page)
		}
	})
}
