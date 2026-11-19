package teammanager

import (
	"context"
	"errors"
	"testing"

	"encore.dev/beta/errs"

	"encore.app/auth"
)

func insertTestOrg(t *testing.T, ctx context.Context, orgID, name, slug, orgType string) {
	t.Helper()
	_, err := db.Exec(ctx,
		`INSERT INTO "organization" (id, name, slug, "orgType", status, "createdAt", "updatedAt")
		 VALUES ($1, $2, $3, $4, 'APPROVED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		 ON CONFLICT (id) DO NOTHING`,
		orgID, name, slug, orgType,
	)
	if err != nil {
		t.Fatalf("failed to insert organization: %v", err)
	}
}

func insertTestOrgMember(t *testing.T, ctx context.Context, orgID, userID, role string) {
	t.Helper()
	_, err := db.Exec(ctx,
		`INSERT INTO "member" (id, "organizationId", "userId", role, "createdAt")
		 VALUES (gen_random_uuid()::text, $1, $2, $3, CURRENT_TIMESTAMP)
		 ON CONFLICT ("organizationId", "userId") DO UPDATE SET role = EXCLUDED.role`,
		orgID, userID, role,
	)
	if err != nil {
		t.Fatalf("failed to insert member: %v", err)
	}
}

func TestNewsletters_CRUDAndPermissions(t *testing.T) {
	ctx := context.Background()

	orgID := nextTeamID("nl-org")
	adminID := nextTeamID("nl-admin")
	eventAdminID := nextTeamID("nl-evadmin")
	memberID := nextTeamID("nl-member")
	outsiderID := nextTeamID("nl-outsider")
	siteAdminID := nextTeamID("nl-siteadmin")

	insertTestOrg(t, ctx, orgID, "Lightwing Racing Club", orgID, "ORGANIZATION")
	insertTestUser(t, ctx, adminID, "Org Admin", "USER")
	insertTestUser(t, ctx, eventAdminID, "Org Event Admin", "USER")
	insertTestUser(t, ctx, memberID, "Org Member", "USER")
	insertTestUser(t, ctx, outsiderID, "Outsider", "USER")
	insertTestUser(t, ctx, siteAdminID, "Site Admin", "SITE_ADMIN")

	insertTestOrgMember(t, ctx, orgID, adminID, "administrator")
	insertTestOrgMember(t, ctx, orgID, eventAdminID, "eventAdmin")
	insertTestOrgMember(t, ctx, orgID, memberID, "member")

	// 1. Regular member & outsider cannot create a newsletter
	for _, uid := range []string{memberID, outsiderID} {
		_, err := createNewsletter(ctx, testActor(uid, "USER"), &createNewsletterParams{
			OrganizationID: orgID,
			Title:          "Unauthorized Post",
			Content:        "Hello",
			Status:         NewsletterStatusPublished,
		})
		var e *errs.Error
		if !errors.As(err, &e) || e.Code != errs.PermissionDenied {
			t.Fatalf("expected PermissionDenied for %s, got %v", uid, err)
		}
	}

	// 2. Org admin creates a DRAFT newsletter
	draft, err := createNewsletter(ctx, testActor(adminID, "USER"), &createNewsletterParams{
		OrganizationID: orgID,
		Title:          "Season 4 Kickoff",
		Summary:        sptr("Everything you need to know for Season 4."),
		ThumbnailURL:   sptr("https://example.com/thumb.png"),
		Content:        "# Welcome\n\nLet's race!",
		Status:         NewsletterStatusDraft,
	})
	if err != nil {
		t.Fatalf("createNewsletter draft failed: %v", err)
	}
	if draft.Status != NewsletterStatusDraft || draft.PublishedAt != nil {
		t.Fatalf("expected DRAFT with nil PublishedAt, got status=%s pub=%v", draft.Status, draft.PublishedAt)
	}
	if draft.ThumbnailURL == nil || *draft.ThumbnailURL != "https://example.com/thumb.png" {
		t.Fatalf("expected thumbnailUrl to be preserved, got %v", draft.ThumbnailURL)
	}

	// 3. Draft is hidden from public list & public get
	pubList, err := listPublicNewsletters(ctx, orgID, "", 20, 0)
	if err != nil {
		t.Fatalf("listPublicNewsletters failed: %v", err)
	}
	if pubList.Total != 0 {
		t.Fatalf("expected 0 published newsletters, got %d", pubList.Total)
	}
	if _, err := getPublicNewsletter(ctx, draft.ID); err == nil {
		t.Fatalf("expected draft to be hidden from getPublicNewsletter")
	}

	// 4. Org eventAdmin can list org newsletters (including drafts) and publish it
	orgList, err := listOrgNewsletters(ctx, testActor(eventAdminID, "USER"), orgID, 20, 0)
	if err != nil {
		t.Fatalf("listOrgNewsletters failed: %v", err)
	}
	if orgList.Total != 1 || orgList.Newsletters[0].ID != draft.ID {
		t.Fatalf("expected 1 org newsletter, got %+v", orgList)
	}

	published, err := updateNewsletter(ctx, testActor(eventAdminID, "USER"), &updateNewsletterParams{
		ID:     draft.ID,
		Status: sptr(NewsletterStatusPublished),
	})
	if err != nil {
		t.Fatalf("updateNewsletter publish failed: %v", err)
	}
	if published.Status != NewsletterStatusPublished || published.PublishedAt == nil {
		t.Fatalf("expected PUBLISHED with non-nil PublishedAt, got status=%s pub=%v", published.Status, published.PublishedAt)
	}

	// 5. Published newsletter is now visible publicly by ID and slug
	pubList, err = listPublicNewsletters(ctx, orgID, "Season 4", 20, 0)
	if err != nil {
		t.Fatalf("listPublicNewsletters failed: %v", err)
	}
	if pubList.Total != 1 || pubList.Newsletters[0].ID != draft.ID {
		t.Fatalf("expected 1 published newsletter, got %+v", pubList)
	}

	fetchedBySlug, err := getPublicNewsletter(ctx, published.Slug)
	if err != nil {
		t.Fatalf("getPublicNewsletter by slug failed: %v", err)
	}
	if fetchedBySlug.ID != published.ID {
		t.Fatalf("expected %s, got %s", published.ID, fetchedBySlug.ID)
	}

	// 6. Regular member cannot delete, site admin can delete
	err = deleteNewsletter(ctx, testActor(memberID, "USER"), published.ID)
	var e *errs.Error
	if !errors.As(err, &e) || e.Code != errs.PermissionDenied {
		t.Fatalf("expected PermissionDenied on delete by member, got %v", err)
	}

	if err := deleteNewsletter(ctx, testActor(siteAdminID, string(auth.SiteRoleSiteAdmin)), published.ID); err != nil {
		t.Fatalf("deleteNewsletter by site admin failed: %v", err)
	}

	if _, err := getPublicNewsletter(ctx, published.ID); err == nil {
		t.Fatalf("expected deleted newsletter to return NotFound")
	}
}
