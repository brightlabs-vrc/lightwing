package teammanager

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	encoreauth "encore.dev/beta/auth"
	"encore.dev/beta/errs"

	"encore.app/auth"
	"encore.app/shared"
	"encore.app/teammanager/sqlc"
)

const (
	NewsletterStatusDraft     = "DRAFT"
	NewsletterStatusPublished = "PUBLISHED"
)

// Newsletter is an organization's community newsletter post.
type Newsletter struct {
	ID               string  `json:"id"`
	OrganizationID   string  `json:"organizationId"`
	OrganizationName string  `json:"organizationName"`
	OrganizationSlug string  `json:"organizationSlug"`
	OrganizationLogo *string `json:"organizationLogo,omitempty"`
	AuthorID         string  `json:"authorId"`
	AuthorName       string  `json:"authorName"`
	AuthorSlug       *string `json:"authorSlug,omitempty"`
	AuthorImage      *string `json:"authorImage,omitempty"`
	Title            string  `json:"title"`
	Slug             string  `json:"slug"`
	Summary          *string `json:"summary,omitempty"`
	ThumbnailURL     *string `json:"thumbnailUrl,omitempty"`
	Content          string  `json:"content"`
	Status           string  `json:"status"`
	PublishedAt      *string `json:"publishedAt,omitempty"`
	CreatedAt        string  `json:"createdAt"`
	UpdatedAt        string  `json:"updatedAt"`
}

// ListNewslettersResponse is a paginated list of newsletters.
type ListNewslettersResponse struct {
	Newsletters []Newsletter `json:"newsletters"`
	Total       int          `json:"total"`
}

func nullStrToPtr(n sql.NullString) *string {
	if !n.Valid || n.String == "" {
		return nil
	}
	v := n.String
	return &v
}

func nullTimeToRFC3339Ptr(n sql.NullTime) *string {
	if !n.Valid {
		return nil
	}
	v := n.Time.UTC().Format(time.RFC3339)
	return &v
}

func newsletterFromFields(
	id, orgID, orgName, orgSlug string,
	orgLogo sql.NullString,
	authorID, authorName string,
	authorVRC, authorSlug, authorImage sql.NullString,
	title, slug string,
	summary, thumbnailURL sql.NullString,
	content, status string,
	publishedAt sql.NullTime,
	createdAt, updatedAt time.Time,
) Newsletter {
	return Newsletter{
		ID:               id,
		OrganizationID:   orgID,
		OrganizationName: orgName,
		OrganizationSlug: orgSlug,
		OrganizationLogo: nullStrToPtr(orgLogo),
		AuthorID:         authorID,
		AuthorName:       displayName(authorName, authorVRC),
		AuthorSlug:       nullStrToPtr(authorSlug),
		AuthorImage:      nullStrToPtr(authorImage),
		Title:            title,
		Slug:             slug,
		Summary:          nullStrToPtr(summary),
		ThumbnailURL:     nullStrToPtr(thumbnailURL),
		Content:          content,
		Status:           status,
		PublishedAt:      nullTimeToRFC3339Ptr(publishedAt),
		CreatedAt:        createdAt.UTC().Format(time.RFC3339),
		UpdatedAt:        updatedAt.UTC().Format(time.RFC3339),
	}
}

func normalizeNewsletterStatus(s string) (string, error) {
	u := strings.ToUpper(strings.TrimSpace(s))
	if u == "" {
		return NewsletterStatusDraft, nil
	}
	if u != NewsletterStatusDraft && u != NewsletterStatusPublished {
		return "", &errs.Error{
			Code:    errs.InvalidArgument,
			Message: "status must be DRAFT or PUBLISHED",
		}
	}
	return u, nil
}

func uniqueNewsletterSlug(ctx context.Context, orgID, title, excludeID string) string {
	base := slugifyTeamName(title)
	if base == "" {
		base = "newsletter"
	}
	candidate := base
	for i := 2; i <= 50; i++ {
		_, err := q().NewsletterSlugExistsForOrg(ctx, sqlc.NewsletterSlugExistsForOrgParams{
			OrganizationId: orgID,
			Slug:           candidate,
			ID:             excludeID,
		})
		if errors.Is(err, sql.ErrNoRows) {
			return candidate
		}
		candidate = fmt.Sprintf("%s-%d", base, i)
	}
	return fmt.Sprintf("%s-%s", base, shared.NewID()[:8])
}

func requireOrganizationExists(ctx context.Context, orgID string) (string, error) {
	org, err := q().GetOrgByID(ctx, orgID)
	if errors.Is(err, sql.ErrNoRows) {
		orgSlug, sErr := q().GetOrgBySlug(ctx, orgID)
		if sErr != nil {
			return "", &errs.Error{Code: errs.NotFound, Message: "organization not found"}
		}
		if orgSlug.OrgType.Valid && orgSlug.OrgType.String != "" && orgSlug.OrgType.String != "ORGANIZATION" {
			return "", &errs.Error{Code: errs.InvalidArgument, Message: "only organizations can publish newsletters"}
		}
		return orgSlug.ID, nil
	}
	if err != nil {
		return "", err
	}
	if org.OrgType.Valid && org.OrgType.String != "" && org.OrgType.String != "ORGANIZATION" {
		return "", &errs.Error{Code: errs.InvalidArgument, Message: "only organizations can publish newsletters"}
	}
	return org.ID, nil
}

// --- Core handlers ---

func listPublicNewsletters(ctx context.Context, orgID, search string, limit, offset int) (*ListNewslettersResponse, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	resolvedOrgID := strings.TrimSpace(orgID)
	if resolvedOrgID != "" {
		if id, err := requireOrganizationExists(ctx, resolvedOrgID); err == nil {
			resolvedOrgID = id
		}
	}

	search = strings.TrimSpace(search)

	total, err := q().CountPublishedNewsletters(ctx, sqlc.CountPublishedNewslettersParams{
		OrganizationID: resolvedOrgID,
		Search:         search,
	})
	if err != nil {
		return nil, err
	}

	rows, err := q().ListPublishedNewsletters(ctx, sqlc.ListPublishedNewslettersParams{
		OrganizationID: resolvedOrgID,
		Search:         search,
		LimitVal:       int32(limit),
		OffsetVal:      int32(offset),
	})
	if err != nil {
		return nil, err
	}

	items := make([]Newsletter, 0, len(rows))
	for _, r := range rows {
		items = append(items, newsletterFromFields(
			r.ID, r.OrganizationId, r.OrgName, r.OrgSlug, r.OrgLogo,
			r.AuthorId, r.AuthorName, r.AuthorVrc, r.AuthorSlug, r.AuthorImage,
			r.Title, r.Slug, r.Summary, r.ThumbnailUrl, r.Content, r.Status,
			r.PublishedAt, r.CreatedAt, r.UpdatedAt,
		))
	}

	return &ListNewslettersResponse{
		Newsletters: items,
		Total:       int(total),
	}, nil
}

func getPublicNewsletter(ctx context.Context, idOrSlug string) (*Newsletter, error) {
	r, err := q().GetPublishedNewsletterByIDOrSlug(ctx, strings.TrimSpace(idOrSlug))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, &errs.Error{Code: errs.NotFound, Message: "newsletter not found"}
	}
	if err != nil {
		return nil, err
	}
	n := newsletterFromFields(
		r.ID, r.OrganizationId, r.OrgName, r.OrgSlug, r.OrgLogo,
		r.AuthorId, r.AuthorName, r.AuthorVrc, r.AuthorSlug, r.AuthorImage,
		r.Title, r.Slug, r.Summary, r.ThumbnailUrl, r.Content, r.Status,
		r.PublishedAt, r.CreatedAt, r.UpdatedAt,
	)
	return &n, nil
}

func listOrgNewsletters(ctx context.Context, actor *auth.Actor, orgID string, limit, offset int) (*ListNewslettersResponse, error) {
	if actor == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "missing session token"}
	}
	resolvedOrgID, err := requireOrganizationExists(ctx, strings.TrimSpace(orgID))
	if err != nil {
		return nil, err
	}
	if _, _, err := auth.RequirePermission(ctx, actor, resolvedOrgID, auth.ResourceNewsletter, auth.ActionCreate); err != nil {
		return nil, err
	}

	if limit <= 0 || limit > 100 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	total, err := q().CountOrgNewsletters(ctx, resolvedOrgID)
	if err != nil {
		return nil, err
	}
	rows, err := q().ListOrgNewsletters(ctx, sqlc.ListOrgNewslettersParams{
		OrganizationID: resolvedOrgID,
		LimitVal:       int32(limit),
		OffsetVal:      int32(offset),
	})
	if err != nil {
		return nil, err
	}

	items := make([]Newsletter, 0, len(rows))
	for _, r := range rows {
		items = append(items, newsletterFromFields(
			r.ID, r.OrganizationId, r.OrgName, r.OrgSlug, r.OrgLogo,
			r.AuthorId, r.AuthorName, r.AuthorVrc, r.AuthorSlug, r.AuthorImage,
			r.Title, r.Slug, r.Summary, r.ThumbnailUrl, r.Content, r.Status,
			r.PublishedAt, r.CreatedAt, r.UpdatedAt,
		))
	}

	return &ListNewslettersResponse{
		Newsletters: items,
		Total:       int(total),
	}, nil
}

type createNewsletterParams struct {
	OrganizationID string
	Title          string
	Summary        *string
	ThumbnailURL   *string
	Content        string
	Status         string
}

func createNewsletter(ctx context.Context, actor *auth.Actor, p *createNewsletterParams) (*Newsletter, error) {
	if actor == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "missing session token"}
	}
	resolvedOrgID, err := requireOrganizationExists(ctx, strings.TrimSpace(p.OrganizationID))
	if err != nil {
		return nil, err
	}
	if _, _, err := auth.RequirePermission(ctx, actor, resolvedOrgID, auth.ResourceNewsletter, auth.ActionCreate); err != nil {
		return nil, err
	}

	title := strings.TrimSpace(p.Title)
	if title == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "title is required"}
	}
	if len(title) > 200 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "title must be 200 characters or fewer"}
	}

	status, err := normalizeNewsletterStatus(p.Status)
	if err != nil {
		return nil, err
	}

	id := shared.NewID()
	slug := uniqueNewsletterSlug(ctx, resolvedOrgID, title, id)

	var summaryVal, thumbVal sql.NullString
	if p.Summary != nil && strings.TrimSpace(*p.Summary) != "" {
		summaryVal = sql.NullString{String: strings.TrimSpace(*p.Summary), Valid: true}
	}
	if p.ThumbnailURL != nil && strings.TrimSpace(*p.ThumbnailURL) != "" {
		thumbVal = sql.NullString{String: strings.TrimSpace(*p.ThumbnailURL), Valid: true}
	}

	var publishedAt sql.NullTime
	if status == NewsletterStatusPublished {
		publishedAt = sql.NullTime{Time: time.Now().UTC(), Valid: true}
	}

	_, err = q().CreateNewsletter(ctx, sqlc.CreateNewsletterParams{
		ID:             id,
		OrganizationId: resolvedOrgID,
		AuthorId:       actor.UserID,
		Title:          title,
		Slug:           slug,
		Summary:        summaryVal,
		ThumbnailUrl:   thumbVal,
		Content:        p.Content,
		Status:         status,
		PublishedAt:    publishedAt,
	})
	if err != nil {
		return nil, err
	}

	r, err := q().GetNewsletterByID(ctx, id)
	if err != nil {
		return nil, err
	}
	n := newsletterFromFields(
		r.ID, r.OrganizationId, r.OrgName, r.OrgSlug, r.OrgLogo,
		r.AuthorId, r.AuthorName, r.AuthorVrc, r.AuthorSlug, r.AuthorImage,
		r.Title, r.Slug, r.Summary, r.ThumbnailUrl, r.Content, r.Status,
		r.PublishedAt, r.CreatedAt, r.UpdatedAt,
	)
	return &n, nil
}

type updateNewsletterParams struct {
	ID             string
	Title          *string
	Summary        *string
	ClearSummary   bool
	ThumbnailURL   *string
	ClearThumbnail bool
	Content        *string
	Status         *string
}

func updateNewsletter(ctx context.Context, actor *auth.Actor, p *updateNewsletterParams) (*Newsletter, error) {
	if actor == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "missing session token"}
	}
	existing, err := q().GetNewsletterByID(ctx, strings.TrimSpace(p.ID))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, &errs.Error{Code: errs.NotFound, Message: "newsletter not found"}
	}
	if err != nil {
		return nil, err
	}

	if _, _, err := auth.RequirePermission(ctx, actor, existing.OrganizationId, auth.ResourceNewsletter, auth.ActionUpdate); err != nil {
		return nil, err
	}

	title := existing.Title
	slug := existing.Slug
	if p.Title != nil {
		trimmed := strings.TrimSpace(*p.Title)
		if trimmed == "" {
			return nil, &errs.Error{Code: errs.InvalidArgument, Message: "title cannot be empty"}
		}
		if len(trimmed) > 200 {
			return nil, &errs.Error{Code: errs.InvalidArgument, Message: "title must be 200 characters or fewer"}
		}
		if trimmed != existing.Title {
			title = trimmed
			slug = uniqueNewsletterSlug(ctx, existing.OrganizationId, title, existing.ID)
		}
	}

	summary := existing.Summary
	if p.ClearSummary {
		summary = sql.NullString{}
	} else if p.Summary != nil {
		trimmed := strings.TrimSpace(*p.Summary)
		if trimmed == "" {
			summary = sql.NullString{}
		} else {
			summary = sql.NullString{String: trimmed, Valid: true}
		}
	}

	thumb := existing.ThumbnailUrl
	if p.ClearThumbnail {
		thumb = sql.NullString{}
	} else if p.ThumbnailURL != nil {
		trimmed := strings.TrimSpace(*p.ThumbnailURL)
		if trimmed == "" {
			thumb = sql.NullString{}
		} else {
			thumb = sql.NullString{String: trimmed, Valid: true}
		}
	}

	content := existing.Content
	if p.Content != nil {
		content = *p.Content
	}

	status := existing.Status
	publishedAt := existing.PublishedAt
	if p.Status != nil {
		nextStatus, sErr := normalizeNewsletterStatus(*p.Status)
		if sErr != nil {
			return nil, sErr
		}
		status = nextStatus
		if status == NewsletterStatusPublished && !publishedAt.Valid {
			publishedAt = sql.NullTime{Time: time.Now().UTC(), Valid: true}
		} else if status == NewsletterStatusDraft {
			publishedAt = sql.NullTime{}
		}
	}

	err = q().UpdateNewsletter(ctx, sqlc.UpdateNewsletterParams{
		ID:           existing.ID,
		Title:        title,
		Slug:         slug,
		Summary:      summary,
		ThumbnailUrl: thumb,
		Content:      content,
		Status:       status,
		PublishedAt:  publishedAt,
		AuthorID:     actor.UserID,
	})
	if err != nil {
		return nil, err
	}

	r, err := q().GetNewsletterByID(ctx, existing.ID)
	if err != nil {
		return nil, err
	}
	n := newsletterFromFields(
		r.ID, r.OrganizationId, r.OrgName, r.OrgSlug, r.OrgLogo,
		r.AuthorId, r.AuthorName, r.AuthorVrc, r.AuthorSlug, r.AuthorImage,
		r.Title, r.Slug, r.Summary, r.ThumbnailUrl, r.Content, r.Status,
		r.PublishedAt, r.CreatedAt, r.UpdatedAt,
	)
	return &n, nil
}

func deleteNewsletter(ctx context.Context, actor *auth.Actor, id string) error {
	if actor == nil {
		return &errs.Error{Code: errs.Unauthenticated, Message: "missing session token"}
	}
	existing, err := q().GetNewsletterByID(ctx, strings.TrimSpace(id))
	if errors.Is(err, sql.ErrNoRows) {
		return &errs.Error{Code: errs.NotFound, Message: "newsletter not found"}
	}
	if err != nil {
		return err
	}
	if _, _, err := auth.RequirePermission(ctx, actor, existing.OrganizationId, auth.ResourceNewsletter, auth.ActionDelete); err != nil {
		return err
	}
	return q().DeleteNewsletter(ctx, existing.ID)
}

// --- Encore HTTP Endpoints ---

type ListPublicNewslettersRequest struct {
	OrganizationID string `query:"organizationId"`
	Search         string `query:"search"`
	Limit          int    `query:"limit"`
	Offset         int    `query:"offset"`
}

//encore:api public method=GET path=/api/newsletters
func (s *Service) ListPublicNewsletters(ctx context.Context, p *ListPublicNewslettersRequest) (*ListNewslettersResponse, error) {
	return listPublicNewsletters(ctx, p.OrganizationID, p.Search, p.Limit, p.Offset)
}

//encore:api public method=GET path=/api/newsletters/:id
func (s *Service) GetPublicNewsletter(ctx context.Context, id string) (*Newsletter, error) {
	return getPublicNewsletter(ctx, id)
}

type ListOrgNewslettersRequest struct {
	OrganizationID string `query:"organizationId"`
	Limit          int    `query:"limit"`
	Offset         int    `query:"offset"`
}

//encore:api auth method=GET path=/api/org-newsletters
func (s *Service) ListOrgNewsletters(ctx context.Context, p *ListOrgNewslettersRequest) (*ListNewslettersResponse, error) {
	actor := encoreauth.Data().(*auth.Actor)
	return listOrgNewsletters(ctx, actor, p.OrganizationID, p.Limit, p.Offset)
}

type CreateNewsletterRequest struct {
	OrganizationID string  `json:"organizationId"`
	Title          string  `json:"title"`
	Summary        *string `json:"summary,omitempty"`
	ThumbnailURL   *string `json:"thumbnailUrl,omitempty"`
	Content        string  `json:"content"`
	Status         string  `json:"status"`
}

//encore:api auth method=POST path=/api/newsletters
func (s *Service) CreateNewsletter(ctx context.Context, p *CreateNewsletterRequest) (*Newsletter, error) {
	actor := encoreauth.Data().(*auth.Actor)
	return createNewsletter(ctx, actor, &createNewsletterParams{
		OrganizationID: p.OrganizationID,
		Title:          p.Title,
		Summary:        p.Summary,
		ThumbnailURL:   p.ThumbnailURL,
		Content:        p.Content,
		Status:         p.Status,
	})
}

type UpdateNewsletterRequest struct {
	ID             string  `json:"id"`
	Title          *string `json:"title,omitempty"`
	Summary        *string `json:"summary,omitempty"`
	ClearSummary   bool    `json:"clearSummary,omitempty"`
	ThumbnailURL   *string `json:"thumbnailUrl,omitempty"`
	ClearThumbnail bool    `json:"clearThumbnail,omitempty"`
	Content        *string `json:"content,omitempty"`
	Status         *string `json:"status,omitempty"`
}

//encore:api auth method=PATCH path=/api/newsletters
func (s *Service) UpdateNewsletter(ctx context.Context, p *UpdateNewsletterRequest) (*Newsletter, error) {
	actor := encoreauth.Data().(*auth.Actor)
	return updateNewsletter(ctx, actor, &updateNewsletterParams{
		ID:             p.ID,
		Title:          p.Title,
		Summary:        p.Summary,
		ClearSummary:   p.ClearSummary,
		ThumbnailURL:   p.ThumbnailURL,
		ClearThumbnail: p.ClearThumbnail,
		Content:        p.Content,
		Status:         p.Status,
	})
}

//encore:api auth method=DELETE path=/api/newsletters/:id
func (s *Service) DeleteNewsletter(ctx context.Context, id string) error {
	actor := encoreauth.Data().(*auth.Actor)
	return deleteNewsletter(ctx, actor, id)
}
