package teammanager

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"encore.dev/beta/errs"
	"encore.app/auth"
)

// --- getTeam (mirrors ts-legacy/teammanager/teams.ts getTeam) ---

func getTeam(ctx context.Context, id string) (*Team, error) {
	if cached, err := teamCache.Get(ctx, teamCacheKey{ID: id}); err == nil {
		team := cached
		return &team, nil
	}
	team, err := loadTeam(ctx, id)
	if err != nil {
		return nil, err
	}
	_ = teamCache.Set(ctx, teamCacheKey{ID: id}, *team)
	return team, nil
}

// --- getTeamBySlug (mirrors getTeamBySlug) ---

func getTeamBySlug(ctx context.Context, slug string) (*Team, error) {
	var org orgRow
	err := scanOrgRow(&org, db.QueryRow(ctx,
		`SELECT `+orgColumns+` FROM "organization" WHERE slug = $1`, slug))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, &errs.Error{Code: errs.NotFound, Message: "team not found"}
	}
	if err != nil {
		return nil, err
	}
	members, err := loadMemberRows(ctx, org.ID)
	if err != nil {
		return nil, err
	}
	return toTeam(&org, members), nil
}

// --- listTeams (mirrors listTeams) ---

type ListTeamsResponse struct {
	Teams []TeamListItem `json:"teams"`
	Total int            `json:"total"`
}

func listTeams(ctx context.Context, search string, limit, offset int) (*ListTeamsResponse, error) {
	where := ""
	args := []any{}
	if search != "" {
		args = append(args, "%"+search+"%")
		where = `WHERE name ILIKE $1 OR slug ILIKE $1`
	}
	var total int
	if err := db.QueryRow(ctx,
		`SELECT COUNT(*) FROM "organization" `+where, args...,
	).Scan(&total); err != nil {
		return nil, err
	}
	query := `SELECT id, name, slug, logo FROM "organization" ` + where + ` ORDER BY name ASC`
	if limit > 0 {
		args = append(args, limit)
		query += fmt.Sprintf(` LIMIT $%d`, len(args))
	}
	if offset > 0 {
		args = append(args, offset)
		query += fmt.Sprintf(` OFFSET $%d`, len(args))
	}
	rows, err := db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	type orgStub struct {
		ID, Name, Slug string
		Logo           sql.NullString
	}
	stubs := []orgStub{}
	for rows.Next() {
		var s orgStub
		if err := rows.Scan(&s.ID, &s.Name, &s.Slug, &s.Logo); err != nil {
			return nil, err
		}
		stubs = append(stubs, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	teams := make([]TeamListItem, 0, len(stubs))
	for _, s := range stubs {
		var memberCount, adminCount int
		if err := db.QueryRow(ctx,
			`SELECT COUNT(*), COUNT(*) FILTER (WHERE role = $2) FROM "member" WHERE "organizationId" = $1`,
			s.ID, auth.AdministratorRole,
		).Scan(&memberCount, &adminCount); err != nil {
			return nil, err
		}
		slots := auth.AdministratorRoleLimit - adminCount
		if slots < 0 {
			slots = 0
		}
		var logo *string
		if s.Logo.Valid {
			logo = &s.Logo.String
		}
		teams = append(teams, TeamListItem{
			ID: s.ID, Name: s.Name, Slug: s.Slug, Logo: logo,
			AdministratorSlotsRemaining: slots,
			MemberCount:                 memberCount,
		})
	}
	return &ListTeamsResponse{Teams: teams, Total: total}, nil
}

// --- createTeam (mirrors createTeam; site-admin gated) ---

func createTeam(ctx context.Context, authorization, name string, logo *string) (*Team, error) {
	if _, err := auth.RequireSiteAdmin(ctx, authorization); err != nil {
		return nil, err
	}
	slug := slugifyTeamName(name)
	var existing string
	err := db.QueryRow(ctx,
		`SELECT id FROM "organization" WHERE slug = $1`, slug,
	).Scan(&existing)
	if err == nil {
		return nil, &errs.Error{Code: errs.AlreadyExists, Message: "team with this slug already exists"}
	} else if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	var logoVal sql.NullString
	if logo != nil {
		logoVal = sql.NullString{String: *logo, Valid: true}
	}
	var id string
	err = db.QueryRow(ctx,
		`INSERT INTO "organization" (id, name, slug, logo, "updatedAt")
		 VALUES (gen_random_uuid()::text, $1, $2, $3, $4) RETURNING id`,
		name, slug, logoVal, time.Now().UTC(),
	).Scan(&id)
	if isUniqueViolation(err) {
		return nil, &errs.Error{Code: errs.AlreadyExists, Message: "team with this slug already exists"}
	}
	if err != nil {
		return nil, err
	}
	return loadTeam(ctx, id)
}

// --- updateTeam (mirrors updateTeam) ---

// UpdateTeamParams carries optional metadata updates. A nil pointer leaves
// the field unchanged; ClearLogo resets the logo to NULL.
type UpdateTeamParams struct {
	Name      *string
	Slug      *string
	Logo      *string
	ClearLogo bool
}

func updateTeam(ctx context.Context, authorization, id string, p *UpdateTeamParams) (*Team, error) {
	actor, err := auth.ResolveActor(ctx, authorization)
	if err != nil {
		return nil, err
	}
	if !auth.IsSiteAdmin(actor.SiteRole) {
		if _, _, err := auth.RequirePermission(ctx, authorization, id, "organization", "update"); err != nil {
			return nil, &errs.Error{Code: errs.PermissionDenied, Message: "cannot update team metadata"}
		}
	}
	var existingSlug string
	err = db.QueryRow(ctx,
		`SELECT slug FROM "organization" WHERE id = $1`, id,
	).Scan(&existingSlug)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, &errs.Error{Code: errs.NotFound, Message: "team not found"}
	}
	if err != nil {
		return nil, err
	}
	nextSlug := existingSlug
	if p.Slug != nil && *p.Slug != existingSlug {
		if !auth.IsValidSlug(*p.Slug) {
			return nil, &errs.Error{Code: errs.InvalidArgument, Message: "invalid slug format or length"}
		}
		var collision string
		err := db.QueryRow(ctx,
			`SELECT id FROM "organization" WHERE slug = $1`, *p.Slug,
		).Scan(&collision)
		if err == nil {
			return nil, &errs.Error{Code: errs.AlreadyExists, Message: "team slug is already in use"}
		} else if !errors.Is(err, sql.ErrNoRows) {
			return nil, err
		}
		nextSlug = *p.Slug
	}
	set := []string{`"slug" = $1`, `"updatedAt" = $2`}
	args := []any{nextSlug, time.Now().UTC()}
	if p.Name != nil {
		args = append(args, *p.Name)
		set = append(set, fmt.Sprintf(`"name" = $%d`, len(args)))
	}
	if p.ClearLogo {
		set = append(set, `"logo" = NULL`)
	} else if p.Logo != nil {
		args = append(args, *p.Logo)
		set = append(set, fmt.Sprintf(`"logo" = $%d`, len(args)))
	}
	args = append(args, id)
	_, err = db.Exec(ctx,
		`UPDATE "organization" SET `+strings.Join(set, ", ")+fmt.Sprintf(` WHERE id = $%d`, len(args)),
		args...,
	)
	if isUniqueViolation(err) {
		return nil, &errs.Error{Code: errs.AlreadyExists, Message: "team slug is already in use"}
	}
	if err != nil {
		return nil, err
	}
	invalidateTeamCache(ctx, id)
	return loadTeam(ctx, id)
}

// --- HTTP endpoints (thin wrappers over the cores above) ---

//encore:api public method=GET path=/api/teams/:id
func (s *Service) GetTeam(ctx context.Context, id string) (*Team, error) {
	return getTeam(ctx, id)
}

// GetTeamBySlugParams carries the slug query param. It lives at
// /api/teams-by-slug (rather than nested under /api/teams/) because static
// sub-paths route-conflict with /api/teams/:id under Encore's router.
type GetTeamBySlugParams struct {
	Slug string `query:"slug"`
}

//encore:api public method=GET path=/api/teams-by-slug
func (s *Service) GetTeamBySlug(ctx context.Context, p *GetTeamBySlugParams) (*Team, error) {
	return getTeamBySlug(ctx, p.Slug)
}

// ListTeamsRequest carries search/pagination query params.
type ListTeamsRequest struct {
	Search string `query:"search"`
	Limit  int    `query:"limit"`
	Offset int    `query:"offset"`
}

//encore:api public method=GET path=/api/teams
func (s *Service) ListTeams(ctx context.Context, p *ListTeamsRequest) (*ListTeamsResponse, error) {
	return listTeams(ctx, p.Search, p.Limit, p.Offset)
}

// CreateTeamRequest carries the auth header plus the new team's fields.
type CreateTeamRequest struct {
	Authorization string  `header:"Authorization"`
	Name          string  `json:"name"`
	Logo          *string `json:"logo,omitempty"`
}

//encore:api public method=POST path=/api/teams
func (s *Service) CreateTeam(ctx context.Context, p *CreateTeamRequest) (*Team, error) {
	return createTeam(ctx, p.Authorization, p.Name, p.Logo)
}

// UpdateTeamRequest carries the target id, auth header, and editable fields.
// The id travels in the body because this Encore version only accepts scalar
// params alongside path params.
type UpdateTeamRequest struct {
	ID            string  `json:"id"`
	Authorization string  `header:"Authorization"`
	Name          *string `json:"name,omitempty"`
	Slug          *string `json:"slug,omitempty"`
	Logo          *string `json:"logo,omitempty"`
	ClearLogo     bool    `json:"clearLogo,omitempty"`
}

//encore:api public method=PATCH path=/api/teams
func (s *Service) UpdateTeam(ctx context.Context, p *UpdateTeamRequest) (*Team, error) {
	return updateTeam(ctx, p.Authorization, p.ID, &UpdateTeamParams{
		Name: p.Name, Slug: p.Slug, Logo: p.Logo, ClearLogo: p.ClearLogo,
	})
}
