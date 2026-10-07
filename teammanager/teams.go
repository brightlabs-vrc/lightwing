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

func createTeam(ctx context.Context, authorization, name string, logo *string, primaryOrganizationID *string) (*Team, error) {
	actor, err := auth.ResolveActor(ctx, authorization)
	if err != nil {
		return nil, err
	}
	if !auth.IsSiteAdmin(actor.SiteRole) && !auth.IsEventAdmin(actor.SiteRole) {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "administrative access required"}
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

	if primaryOrganizationID != nil && *primaryOrganizationID != "" {
		_ = q().InsertTeamOrganization(ctx, sqlc.InsertTeamOrganizationParams{
			TeamId:         id,
			OrganizationId: *primaryOrganizationID,
			IsPrimary:      true,
		})
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

	if !auth.IsSiteAdmin(actor.SiteRole) && !auth.IsEventAdmin(actor.SiteRole) {
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

	return nil, &errs.Error{Code: errs.NotFound, Message: "team not found"}
}

// --- convertTeamToOrg ---

type ConvertTeamToOrgRequest struct {
	Authorization string `header:"Authorization"`
	TeamID        string `json:"teamId"`
}

func convertTeamToOrg(ctx context.Context, authorization, teamID string) (*AdminOrganizationDetail, error) {
	actor, err := auth.ResolveActor(ctx, authorization)
	if err != nil {
		return nil, err
	}
	if !auth.IsSiteAdmin(actor.SiteRole) && !auth.IsEventAdmin(actor.SiteRole) {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "administrative access required"}
	}

	teamRow, err := q().GetTeamByID(ctx, teamID)
	if errors.Is(err, sql.ErrNoRows) {
		teamRow, err = q().GetTeamBySlug(ctx, teamID)
	}
	if errors.Is(err, sql.ErrNoRows) {
		if orgRow, orgErr := q().GetOrgByID(ctx, teamID); orgErr == nil {
			invalidateTeamCache(ctx, orgRow.ID)
			return getAdminOrganization(ctx, orgRow.ID)
		}
		if orgRow, orgErr := q().GetOrgBySlug(ctx, teamID); orgErr == nil {
			invalidateTeamCache(ctx, orgRow.ID)
			return getAdminOrganization(ctx, orgRow.ID)
		}
		return nil, &errs.Error{Code: errs.NotFound, Message: "team not found"}
	}
	if err != nil {
		return nil, err
	}

	targetTeamID := teamRow.ID
	targetSlug := teamRow.Slug

	// 1. Fetch team roster before removing team records
	roster, _ := q().ListRosterForTeam(ctx, targetTeamID)

	// 2. Delete team links and team record, freeing targetSlug in the team table
	_ = q().DeleteTeamOrganizationsForTeam(ctx, targetTeamID)
	_ = q().DeleteTeamMembersForTeam(ctx, targetTeamID)
	_ = q().DeleteTeam(ctx, targetTeamID)

	// 3. Create or update organization record
	orgID := targetTeamID
	existingOrg, errOrg := q().GetOrgByID(ctx, targetTeamID)
	if errOrg == nil {
		orgID = existingOrg.ID
		_ = q().UpdateOrg(ctx, sqlc.UpdateOrgParams{
			Slug:      targetSlug,
			UpdatedAt: sql.NullTime{Time: time.Now().UTC(), Valid: true},
			Name:      sql.NullString{String: teamRow.Name, Valid: true},
			ClearLogo: !teamRow.Logo.Valid || teamRow.Logo.String == "",
			Logo:      teamRow.Logo,
			ID:        orgID,
		})
	} else if existingOrgBySlug, errSlug := q().GetOrgBySlug(ctx, targetSlug); errSlug == nil {
		orgID = existingOrgBySlug.ID
		_ = q().UpdateOrg(ctx, sqlc.UpdateOrgParams{
			Slug:      targetSlug,
			UpdatedAt: sql.NullTime{Time: time.Now().UTC(), Valid: true},
			Name:      sql.NullString{String: teamRow.Name, Valid: true},
			ClearLogo: !teamRow.Logo.Valid || teamRow.Logo.String == "",
			Logo:      teamRow.Logo,
			ID:        orgID,
		})
	} else {
		var logoVal sql.NullString
		if teamRow.Logo.Valid && teamRow.Logo.String != "" {
			logoVal = teamRow.Logo
		}

		newOrgID, err := q().CreateOrgWithID(ctx, sqlc.CreateOrgWithIDParams{
			ID:                targetTeamID,
			Name:              teamRow.Name,
			Slug:              targetSlug,
			Logo:              logoVal,
			OrgType:           sql.NullString{String: "ORGANIZATION", Valid: true},
			Status:            sql.NullString{String: "APPROVED", Valid: true},
			DiscordInvite:     sql.NullString{String: "", Valid: false},
			VrchatGroupId:     sql.NullString{String: "", Valid: false},
			SubmittedByUserId: teamRow.SubmittedByUserId,
			UpdatedAt:         sql.NullTime{Time: time.Now().UTC(), Valid: true},
		})
		if err == nil {
			orgID = newOrgID
		}
	}

	// 4. Migrate roster into member table
	for _, m := range roster {
		mRole := auth.MemberRole
		if m.Role.Valid && m.Role.String == auth.AdministratorRole {
			mRole = auth.AdministratorRole
		}
		_ = q().InsertMember(ctx, sqlc.InsertMemberParams{
			OrganizationId: orgID,
			UserId:         m.UserId,
			Role:           mRole,
		})
	}

	invalidateTeamCache(ctx, targetTeamID)
	invalidateTeamCache(ctx, orgID)
	return getAdminOrganization(ctx, orgID)
}

// --- Admin Organization Management ---

type AdminOrganizationItem struct {
	ID                          string  `json:"id"`
	Name                        string  `json:"name"`
	Slug                        string  `json:"slug"`
	Logo                        *string `json:"logo"`
	OrgType                     string  `json:"orgType"`
	Status                      string  `json:"status"`
	DiscordInvite               *string `json:"discordInvite,omitempty"`
	VrchatGroupId               *string `json:"vrchatGroupId,omitempty"`
	SubmittedByUserId           *string `json:"submittedByUserId,omitempty"`
	AdministratorSlotsRemaining int     `json:"administratorSlotsRemaining"`
	MemberCount                 int     `json:"memberCount"`
	CreatedAt                   string  `json:"createdAt"`
	UpdatedAt                   *string `json:"updatedAt,omitempty"`
}

type AdminOrganizationDetail struct {
	ID                          string              `json:"id"`
	Name                        string              `json:"name"`
	Slug                        string              `json:"slug"`
	Logo                        *string             `json:"logo"`
	OrgType                     string              `json:"orgType"`
	Status                      string              `json:"status"`
	DiscordInvite               *string             `json:"discordInvite,omitempty"`
	VrchatGroupId               *string             `json:"vrchatGroupId,omitempty"`
	SubmittedByUserId           *string             `json:"submittedByUserId,omitempty"`
	AdministratorSlotsRemaining int                 `json:"administratorSlotsRemaining"`
	MemberCount                 int                 `json:"memberCount"`
	CreatedAt                   string              `json:"createdAt"`
	UpdatedAt                   *string             `json:"updatedAt,omitempty"`
	Members                     []TeamMemberSummary `json:"members"`
}

type ListAdminOrganizationsRequest struct {
	Search string `query:"search"`
	Limit  int    `query:"limit"`
	Offset int    `query:"offset"`
}

type ListAdminOrganizationsResponse struct {
	Organizations []AdminOrganizationItem `json:"organizations"`
	Total         int                     `json:"total"`
}

type CreateAdminOrganizationRequest struct {
	Authorization string  `header:"Authorization"`
	Name          string  `json:"name"`
	Logo          *string `json:"logo,omitempty"`
	DiscordInvite *string `json:"discordInvite,omitempty"`
	VrchatGroupId *string `json:"vrchatGroupId,omitempty"`
}

type UpdateAdminOrganizationRequest struct {
	ID            string  `json:"id"`
	Authorization string  `header:"Authorization"`
	Name          *string `json:"name,omitempty"`
	Slug          *string `json:"slug,omitempty"`
	Logo          *string `json:"logo,omitempty"`
	ClearLogo     bool    `json:"clearLogo,omitempty"`
	DiscordInvite *string `json:"discordInvite,omitempty"`
	VrchatGroupId *string `json:"vrchatGroupId,omitempty"`
}

func listAdminOrganizations(ctx context.Context, search string, limit, offset int) (*ListAdminOrganizationsResponse, error) {
	var total int64
	var rows []sqlc.AdminOrgRow
	var err error

	if search == "" {
		if total, err = q().CountAdminOrgs(ctx); err != nil {
			return nil, err
		}
		rows, err = q().ListAdminOrgs(ctx, sqlc.ListAdminOrgsParams{
			Limit:  int32(limit),
			Offset: int32(offset),
		})
	} else {
		if total, err = q().CountAdminOrgsBySearch(ctx, search); err != nil {
			return nil, err
		}
		rows, err = q().ListAdminOrgsBySearch(ctx, sqlc.ListAdminOrgsBySearchParams{
			Search: search,
			Limit:  int32(limit),
			Offset: int32(offset),
		})
	}
	if err != nil {
		return nil, err
	}

	orgIDs := make([]string, 0, len(rows))
	for _, r := range rows {
		orgIDs = append(orgIDs, r.ID)
	}

	countsByOrg := make(map[string]struct{ members, admins int })
	if len(orgIDs) > 0 {
		countRows, err := q().BatchCountMembersAndAdmins(ctx, sqlc.BatchCountMembersAndAdminsParams{
			Role:    auth.AdministratorRole,
			Column2: orgIDs,
		})
		if err == nil {
			for _, cr := range countRows {
				countsByOrg[cr.OrganizationId] = struct{ members, admins int }{
					members: int(cr.Count),
					admins:  int(cr.Count_2),
				}
			}
		}
	}

	items := make([]AdminOrganizationItem, 0, len(rows))
	for _, r := range rows {
		var logo, discord, vrchat, submitted *string
		if r.Logo.Valid && r.Logo.String != "" {
			l := r.Logo.String
			logo = &l
		}
		if r.DiscordInvite.Valid && r.DiscordInvite.String != "" {
			d := r.DiscordInvite.String
			discord = &d
		}
		if r.VrchatGroupId.Valid && r.VrchatGroupId.String != "" {
			v := r.VrchatGroupId.String
			vrchat = &v
		}
		if r.SubmittedByUserId.Valid && r.SubmittedByUserId.String != "" {
			s := r.SubmittedByUserId.String
			submitted = &s
		}
		var updatedAt *string
		if r.UpdatedAt.Valid {
			u := r.UpdatedAt.Time.Format(time.RFC3339)
			updatedAt = &u
		}

		counts := countsByOrg[r.ID]
		slots := auth.AdministratorRoleLimit - counts.admins
		if slots < 0 {
			slots = 0
		}

		orgType := "ORGANIZATION"
		if r.OrgType.Valid && r.OrgType.String != "" {
			orgType = r.OrgType.String
		}
		status := "APPROVED"
		if r.Status.Valid && r.Status.String != "" {
			status = r.Status.String
		}

		items = append(items, AdminOrganizationItem{
			ID:                          r.ID,
			Name:                        r.Name,
			Slug:                        r.Slug,
			Logo:                        logo,
			OrgType:                     orgType,
			Status:                      status,
			DiscordInvite:               discord,
			VrchatGroupId:               vrchat,
			SubmittedByUserId:           submitted,
			AdministratorSlotsRemaining: slots,
			MemberCount:                 counts.members,
			CreatedAt:                   r.CreatedAt.Format(time.RFC3339),
			UpdatedAt:                   updatedAt,
		})
	}

	return &ListAdminOrganizationsResponse{Organizations: items, Total: int(total)}, nil
}

func getAdminOrganization(ctx context.Context, id string) (*AdminOrganizationDetail, error) {
	var orgID, name, slugStr string
	var logoVal, discordVal, vrchatVal, submittedVal sql.NullString
	var orgTypeVal, statusVal sql.NullString
	var createdAtVal time.Time
	var updatedAtVal sql.NullTime

	if row, err := q().GetOrgByID(ctx, id); err == nil {
		orgID, name, slugStr = row.ID, row.Name, row.Slug
		logoVal, orgTypeVal, statusVal = row.Logo, row.OrgType, row.Status
		discordVal, vrchatVal, submittedVal = row.DiscordInvite, row.VrchatGroupId, row.SubmittedByUserId
		createdAtVal, updatedAtVal = row.CreatedAt, row.UpdatedAt
	} else if slugRow, errSlug := q().GetOrgBySlug(ctx, id); errSlug == nil {
		orgID, name, slugStr = slugRow.ID, slugRow.Name, slugRow.Slug
		logoVal, orgTypeVal, statusVal = slugRow.Logo, slugRow.OrgType, slugRow.Status
		discordVal, vrchatVal, submittedVal = slugRow.DiscordInvite, slugRow.VrchatGroupId, slugRow.SubmittedByUserId
		createdAtVal, updatedAtVal = slugRow.CreatedAt, slugRow.UpdatedAt
	} else {
		return nil, &errs.Error{Code: errs.NotFound, Message: "organization not found"}
	}

	members, err := loadMemberRows(ctx, orgID)
	if err != nil {
		return nil, err
	}

	adminCount := 0
	summaries := make([]TeamMemberSummary, 0, len(members))
	for _, m := range members {
		if m.Role == auth.AdministratorRole {
			adminCount++
		}
		var slug *string
		if m.Slug.Valid && m.Slug.String != "" {
			s := m.Slug.String
			slug = &s
		}
		summaries = append(summaries, TeamMemberSummary{
			UserID: m.UserId,
			Name:   displayName(m.Name, m.VrchatUsername),
			Slug:   slug,
			Role:   m.Role,
		})
	}

	slots := auth.AdministratorRoleLimit - adminCount
	if slots < 0 {
		slots = 0
	}

	var logo, discord, vrchat, submitted *string
	if logoVal.Valid && logoVal.String != "" {
		l := logoVal.String
		logo = &l
	}
	if discordVal.Valid && discordVal.String != "" {
		d := discordVal.String
		discord = &d
	}
	if vrchatVal.Valid && vrchatVal.String != "" {
		v := vrchatVal.String
		vrchat = &v
	}
	if submittedVal.Valid && submittedVal.String != "" {
		s := submittedVal.String
		submitted = &s
	}
	var updatedAt *string
	if updatedAtVal.Valid {
		u := updatedAtVal.Time.Format(time.RFC3339)
		updatedAt = &u
	}

	orgType := "ORGANIZATION"
	if orgTypeVal.Valid && orgTypeVal.String != "" {
		orgType = orgTypeVal.String
	}
	status := "APPROVED"
	if statusVal.Valid && statusVal.String != "" {
		status = statusVal.String
	}

	return &AdminOrganizationDetail{
		ID:                          orgID,
		Name:                        name,
		Slug:                        slugStr,
		Logo:                        logo,
		OrgType:                     orgType,
		Status:                      status,
		DiscordInvite:               discord,
		VrchatGroupId:               vrchat,
		SubmittedByUserId:           submitted,
		AdministratorSlotsRemaining: slots,
		MemberCount:                 len(members),
		CreatedAt:                   createdAtVal.Format(time.RFC3339),
		UpdatedAt:                   updatedAt,
		Members:                     summaries,
	}, nil
}

func createAdminOrganization(ctx context.Context, authorization, name string, logo, discordInvite, vrchatGroupId *string) (*AdminOrganizationDetail, error) {
	actor, err := auth.ResolveActor(ctx, authorization)
	if err != nil {
		return nil, err
	}
	if !auth.IsSiteAdmin(actor.SiteRole) && !auth.IsEventAdmin(actor.SiteRole) {
		return nil, &errs.Error{Code: errs.PermissionDenied, Message: "administrative access required"}
	}

	slug := slugifyTeamName(name)
	if _, err := q().OrgIDBySlug(ctx, slug); err == nil {
		return nil, &errs.Error{Code: errs.AlreadyExists, Message: "organization with this slug already exists"}
	}

	var logoVal, discordVal, vrchatVal sql.NullString
	if logo != nil && *logo != "" {
		logoVal = sql.NullString{String: *logo, Valid: true}
	}
	if discordInvite != nil && *discordInvite != "" {
		discordVal = sql.NullString{String: *discordInvite, Valid: true}
	}
	if vrchatGroupId != nil && *vrchatGroupId != "" {
		vrchatVal = sql.NullString{String: *vrchatGroupId, Valid: true}
	}

	id, err := q().CreateOrg(ctx, sqlc.CreateOrgParams{
		Name:              name,
		Slug:              slug,
		Logo:              logoVal,
		OrgType:           sql.NullString{String: "ORGANIZATION", Valid: true},
		Status:            sql.NullString{String: "APPROVED", Valid: true},
		DiscordInvite:     discordVal,
		VrchatGroupId:     vrchatVal,
		SubmittedByUserId: sql.NullString{String: actor.UserID, Valid: true},
		UpdatedAt:         sql.NullTime{Time: time.Now().UTC(), Valid: true},
	})
	if isUniqueViolation(err) {
		return nil, &errs.Error{Code: errs.AlreadyExists, Message: "organization with this slug already exists"}
	}
	if err != nil {
		return nil, err
	}

	_ = q().InsertMember(ctx, sqlc.InsertMemberParams{
		OrganizationId: id,
		UserId:         actor.UserID,
		Role:           auth.AdministratorRole,
	})

	return getAdminOrganization(ctx, id)
}

func updateAdminOrganization(ctx context.Context, authorization, id string, p *UpdateTeamParams, discordInvite, vrchatGroupId *string) (*AdminOrganizationDetail, error) {
	actor, err := auth.ResolveActor(ctx, authorization)
	if err != nil {
		return nil, err
	}

	if !auth.IsSiteAdmin(actor.SiteRole) && !auth.IsEventAdmin(actor.SiteRole) {
		role, err := q().MemberRoleByOrgAndUser(ctx, sqlc.MemberRoleByOrgAndUserParams{
			OrganizationId: id,
			UserId:         actor.UserID,
		})
		if err != nil || role != auth.AdministratorRole {
			return nil, &errs.Error{Code: errs.PermissionDenied, Message: "cannot update organization metadata"}
		}
	}

	existingOrgID := id
	existingOrgSlug := ""
	if row, err := q().GetOrgByID(ctx, id); err == nil {
		existingOrgSlug = row.Slug
	} else if slugRow, errSlug := q().GetOrgBySlug(ctx, id); errSlug == nil {
		existingOrgID = slugRow.ID
		existingOrgSlug = slugRow.Slug
	} else {
		return nil, &errs.Error{Code: errs.NotFound, Message: "organization not found"}
	}

	nextSlug := existingOrgSlug
	if p.Slug != nil && *p.Slug != existingOrgSlug {
		if !auth.IsValidSlug(*p.Slug) {
			return nil, &errs.Error{Code: errs.InvalidArgument, Message: "invalid slug format or length"}
		}
		if _, err := q().OrgIDBySlug(ctx, *p.Slug); err == nil {
			return nil, &errs.Error{Code: errs.AlreadyExists, Message: "organization slug is already in use"}
		} else if !errors.Is(err, sql.ErrNoRows) {
			return nil, err
		}
		nextSlug = *p.Slug
	}

	var name, logo, discord, vrchat sql.NullString
	if p.Name != nil {
		name = sql.NullString{String: *p.Name, Valid: true}
	}
	if p.Logo != nil {
		logo = sql.NullString{String: *p.Logo, Valid: true}
	}
	if discordInvite != nil {
		discord = sql.NullString{String: *discordInvite, Valid: true}
	}
	if vrchatGroupId != nil {
		vrchat = sql.NullString{String: *vrchatGroupId, Valid: true}
	}

	err = q().UpdateOrgDetails(ctx, sqlc.UpdateOrgDetailsParams{
		Slug:          nextSlug,
		UpdatedAt:     sql.NullTime{Time: time.Now().UTC(), Valid: true},
		Name:          name,
		ClearLogo:     p.ClearLogo,
		Logo:          logo,
		DiscordInvite: discord,
		VrchatGroupId: vrchat,
		ID:            existingOrgID,
	})
	if isUniqueViolation(err) {
		return nil, &errs.Error{Code: errs.AlreadyExists, Message: "organization slug is already in use"}
	}
	if err != nil {
		return nil, err
	}

	// Also update team if record exists in team table
	if _, errTeam := q().GetTeamByID(ctx, existingOrgID); errTeam == nil {
		_ = q().UpdateTeam(ctx, sqlc.UpdateTeamParams{
			Slug:      nextSlug,
			UpdatedAt: sql.NullTime{Time: time.Now().UTC(), Valid: true},
			Name:      name,
			ClearLogo: p.ClearLogo,
			Logo:      logo,
			ID:        existingOrgID,
		})
	}

	invalidateTeamCache(ctx, existingOrgID)
	return getAdminOrganization(ctx, existingOrgID)
}

//encore:api public method=GET path=/api/admin/organizations
func (s *Service) ListAdminOrganizations(ctx context.Context, p *ListAdminOrganizationsRequest) (*ListAdminOrganizationsResponse, error) {
	return listAdminOrganizations(ctx, p.Search, p.Limit, p.Offset)
}

//encore:api public method=GET path=/api/admin/organizations/:id
func (s *Service) GetAdminOrganization(ctx context.Context, id string) (*AdminOrganizationDetail, error) {
	return getAdminOrganization(ctx, id)
}

//encore:api public method=POST path=/api/admin/organizations
func (s *Service) CreateAdminOrganization(ctx context.Context, p *CreateAdminOrganizationRequest) (*AdminOrganizationDetail, error) {
	return createAdminOrganization(ctx, p.Authorization, p.Name, p.Logo, p.DiscordInvite, p.VrchatGroupId)
}

//encore:api public method=PATCH path=/api/admin/organizations
func (s *Service) UpdateAdminOrganization(ctx context.Context, p *UpdateAdminOrganizationRequest) (*AdminOrganizationDetail, error) {
	return updateAdminOrganization(ctx, p.Authorization, p.ID, &UpdateTeamParams{
		Name: p.Name, Slug: p.Slug, Logo: p.Logo, ClearLogo: p.ClearLogo,
	}, p.DiscordInvite, p.VrchatGroupId)
}

//encore:api public method=POST path=/api/admin/teams/convert-to-org
func (s *Service) ConvertTeamToOrg(ctx context.Context, p *ConvertTeamToOrgRequest) (*AdminOrganizationDetail, error) {
	return convertTeamToOrg(ctx, p.Authorization, p.TeamID)
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
	Authorization         string  `header:"Authorization"`
	Name                  string  `json:"name"`
	Logo                  *string `json:"logo,omitempty"`
	PrimaryOrganizationID *string `json:"primaryOrganizationId,omitempty"`
}

//encore:api public method=POST path=/api/teams
func (s *Service) CreateTeam(ctx context.Context, p *CreateTeamRequest) (*Team, error) {
	return createTeam(ctx, p.Authorization, p.Name, p.Logo, p.PrimaryOrganizationID)
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
