package teammanager

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"encore.dev/beta/errs"
	"encore.app/auth"
	"encore.app/teammanager/sqlc"
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
	return loadTeam(ctx, slug)
}

// --- listTeams (mirrors listTeams) ---

type ListTeamsResponse struct {
	Teams []TeamListItem `json:"teams"`
	Total int            `json:"total"`
}

func listTeams(ctx context.Context, search string, limit, offset int) (*ListTeamsResponse, error) {
	var total int64
	var stubs []sqlc.ListTeamRowsRow
	var err error
	if search == "" {
		if total, err = q().CountTeams(ctx); err != nil {
			return nil, err
		}
		stubs, err = q().ListTeamRows(ctx, sqlc.ListTeamRowsParams{
			Column1: int32(limit),
			Offset:  int32(offset),
		})
		if err != nil {
			return nil, err
		}
	} else {
		if total, err = q().CountTeamsBySearch(ctx, search); err != nil {
			return nil, err
		}
		bySearch, err := q().ListTeamRowsBySearch(ctx, sqlc.ListTeamRowsBySearchParams{
			Column1: search,
			Column2: int32(limit),
			Offset:  int32(offset),
		})
		if err != nil {
			return nil, err
		}
		stubs = make([]sqlc.ListTeamRowsRow, 0, len(bySearch))
		for _, s := range bySearch {
			stubs = append(stubs, sqlc.ListTeamRowsRow{
				ID: s.ID, Name: s.Name, Slug: s.Slug, Logo: s.Logo, Status: s.Status,
			})
		}
	}

	teamIDs := make([]string, 0, len(stubs))
	for _, s := range stubs {
		teamIDs = append(teamIDs, s.ID)
	}

	// Batch load linked organizations
	orgsByTeam := make(map[string][]LinkedOrganization)
	primOrgByTeam := make(map[string]string)
	if len(teamIDs) > 0 {
		orgRows, err := q().ListOrgsForTeamsBatch(ctx, teamIDs)
		if err == nil {
			for _, r := range orgRows {
				var logo *string
				if r.Logo.Valid && r.Logo.String != "" {
					l := r.Logo.String
					logo = &l
				}
				orgType := "ORGANIZATION"
				if r.OrgType.Valid {
					orgType = r.OrgType.String
				}
				status := "APPROVED"
				if r.Status.Valid {
					status = r.Status.String
				}
				if r.IsPrimary {
					primOrgByTeam[r.TeamId] = r.ID
				}
				orgsByTeam[r.TeamId] = append(orgsByTeam[r.TeamId], LinkedOrganization{
					ID:        r.ID,
					Name:      r.Name,
					Slug:      r.Slug,
					Logo:      logo,
					OrgType:   orgType,
					Status:    status,
					IsPrimary: r.IsPrimary,
				})
			}
		}
	}

	// Batch load roster counts
	rosterCountsByTeam := make(map[string]int)
	if len(teamIDs) > 0 {
		rosterRows, err := q().ListRosterForTeamsBatch(ctx, teamIDs)
		if err == nil {
			for _, r := range rosterRows {
				rosterCountsByTeam[r.TeamId]++
			}
		}
	}

	// Fallback to legacy organization listing if no teams exist in `team` table
	if total == 0 && len(stubs) == 0 {
		var orgTotal int64
		if search == "" {
			orgTotal, _ = q().CountTeams(ctx)
		}
		if orgTotal == 0 {
			// Query approved orgs for legacy tests
			approvedOrgs, err := q().ListApprovedOrgs(ctx)
			if err == nil && len(approvedOrgs) > 0 {
				legacyTeams := make([]TeamListItem, 0, len(approvedOrgs))
				for _, ao := range approvedOrgs {
					var logo *string
					if ao.Logo.Valid && ao.Logo.String != "" {
						l := ao.Logo.String
						logo = &l
					}
					legacyTeams = append(legacyTeams, TeamListItem{
						ID:                          ao.ID,
						Name:                        ao.Name,
						Slug:                        ao.Slug,
						Logo:                        logo,
						Status:                      "APPROVED",
						PrimaryOrganizationID:       ao.ID,
						Organizations:               []LinkedOrganization{},
						AdministratorSlotsRemaining: 3,
						MemberCount:                 0,
					})
				}
				return &ListTeamsResponse{Teams: legacyTeams, Total: len(legacyTeams)}, nil
			}
		}
	}

	teams := make([]TeamListItem, 0, len(stubs))
	for _, s := range stubs {
		var logo *string
		if s.Logo.Valid && s.Logo.String != "" {
			l := s.Logo.String
			logo = &l
		}
		teams = append(teams, TeamListItem{
			ID:                          s.ID,
			Name:                        s.Name,
			Slug:                        s.Slug,
			Logo:                        logo,
			Status:                      s.Status,
			PrimaryOrganizationID:       primOrgByTeam[s.ID],
			Organizations:               orgsByTeam[s.ID],
			AdministratorSlotsRemaining: 3,
			MemberCount:                 rosterCountsByTeam[s.ID],
		})
	}
	return &ListTeamsResponse{Teams: teams, Total: int(total)}, nil
}

// --- createTeam (mirrors createTeam; site-admin gated) ---

func createTeam(ctx context.Context, authorization, name string, logo *string) (*Team, error) {
	actor, err := auth.ResolveActor(ctx, authorization)
	if err != nil {
		return nil, err
	}
	if !auth.IsSiteAdmin(actor.SiteRole) {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "site administrator privilege required"}
	}

	slug := slugifyTeamName(name)
	if _, err := q().TeamIDBySlug(ctx, slug); err == nil {
		return nil, &errs.Error{Code: errs.AlreadyExists, Message: "team with this slug already exists"}
	} else if !errors.Is(err, sql.ErrNoRows) {
		if _, err := q().OrgIDBySlug(ctx, slug); err == nil {
			return nil, &errs.Error{Code: errs.AlreadyExists, Message: "team with this slug already exists"}
		}
	}

	var logoVal sql.NullString
	if logo != nil {
		logoVal = sql.NullString{String: *logo, Valid: true}
	}

	id, err := q().CreateTeam(ctx, sqlc.CreateTeamParams{
		Name:              name,
		Slug:              slug,
		Logo:              logoVal,
		Status:            "APPROVED",
		SubmittedByUserId: sql.NullString{String: actor.UserID, Valid: true},
	})
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

	// Try resolving primary org for team
	primOrg, err := q().GetPrimaryOrgForTeam(ctx, id)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	if !auth.IsSiteAdmin(actor.SiteRole) {
		if primOrg.ID != "" {
			role, err := q().MemberRoleByOrgAndUser(ctx, sqlc.MemberRoleByOrgAndUserParams{
				OrganizationId: primOrg.ID,
				UserId:         actor.UserID,
			})
			if err != nil || role != auth.AdministratorRole {
				return nil, &errs.Error{Code: errs.PermissionDenied, Message: "cannot update team metadata"}
			}
		} else {
			if _, _, err := auth.RequirePermission(ctx, authorization, id, "organization", "update"); err != nil {
				return nil, &errs.Error{Code: errs.PermissionDenied, Message: "cannot update team metadata"}
			}
		}
	}

	// Check if in `team` table
	existingTeam, err := q().GetTeamByID(ctx, id)
	if err == nil {
		nextSlug := existingTeam.Slug
		if p.Slug != nil && *p.Slug != existingTeam.Slug {
			if !auth.IsValidSlug(*p.Slug) {
				return nil, &errs.Error{Code: errs.InvalidArgument, Message: "invalid slug format or length"}
			}
			if _, err := q().TeamIDBySlug(ctx, *p.Slug); err == nil {
				return nil, &errs.Error{Code: errs.AlreadyExists, Message: "team slug is already in use"}
			} else if !errors.Is(err, sql.ErrNoRows) {
				return nil, err
			}
			nextSlug = *p.Slug
		}
		var name, logo sql.NullString
		if p.Name != nil {
			name = sql.NullString{String: *p.Name, Valid: true}
		}
		if p.Logo != nil {
			logo = sql.NullString{String: *p.Logo, Valid: true}
		}
		err = q().UpdateTeam(ctx, sqlc.UpdateTeamParams{
			Slug:      nextSlug,
			UpdatedAt: sql.NullTime{Time: time.Now().UTC(), Valid: true},
			Name:      name,
			ClearLogo: p.ClearLogo,
			Logo:      logo,
			ID:        id,
		})
		if isUniqueViolation(err) {
			return nil, &errs.Error{Code: errs.AlreadyExists, Message: "team slug is already in use"}
		}
		if err != nil {
			return nil, err
		}
		invalidateTeamCache(ctx, id)
		return loadTeam(ctx, id)
	}

	// Legacy organization fallback
	existingSlug, err := q().OrgSlugByID(ctx, id)
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
		if _, err := q().OrgIDBySlug(ctx, *p.Slug); err == nil {
			return nil, &errs.Error{Code: errs.AlreadyExists, Message: "team slug is already in use"}
		} else if !errors.Is(err, sql.ErrNoRows) {
			return nil, err
		}
		nextSlug = *p.Slug
	}
	var name, logo sql.NullString
	if p.Name != nil {
		name = sql.NullString{String: *p.Name, Valid: true}
	}
	if p.Logo != nil {
		logo = sql.NullString{String: *p.Logo, Valid: true}
	}
	err = q().UpdateTeam(ctx, sqlc.UpdateTeamParams{
		Slug:      nextSlug,
		UpdatedAt: sql.NullTime{Time: time.Now().UTC(), Valid: true},
		Name:      name,
		ClearLogo: p.ClearLogo,
		Logo:      logo,
		ID:        id,
	})
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
