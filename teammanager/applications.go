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
	"encore.app/teammanager/sqlc"
)

type SubmitOrgApplicationRequest struct {
	Name          string   `json:"name"`
	Slug          *string  `json:"slug,omitempty"`
	Logo          *string  `json:"logo,omitempty"`
	DiscordInvite string   `json:"discordInvite"`
	VrchatGroupID string   `json:"vrchatGroupId"`
	InitialRoster []string `json:"initialRoster,omitempty"`
}

type SubmitTeamApplicationRequest struct {
	TeamID                   *string  `json:"teamId,omitempty"`
	Name                     string   `json:"name"`
	Slug                     *string  `json:"slug,omitempty"`
	Logo                     *string  `json:"logo,omitempty"`
	PrimaryOrganizationID    string   `json:"primaryOrganizationId"`
	SecondaryOrganizationIDs []string `json:"secondaryOrganizationIds,omitempty"`
	InitialRoster            []string `json:"initialRoster,omitempty"`
}

type ReviewApplicationRequest struct {
	ID     string `json:"id"`
	Type   string `json:"type"`   // "ORGANIZATION" | "TEAM"
	Action string `json:"action"` // "APPROVE" | "REJECT"
}

type ListApplicationsRequest struct{}

type LinkSecondaryOrgRequest struct {
	TeamID         string `json:"teamId"`
	OrganizationID string `json:"organizationId"`
}

type UnlinkSecondaryOrgRequest struct {
	TeamID         string `json:"teamId"`
	OrganizationID string `json:"organizationId"`
}

type LinkedOrganization struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Slug      string  `json:"slug"`
	Logo      *string `json:"logo"`
	OrgType   string  `json:"orgType"`
	Status    string  `json:"status"`
	IsPrimary bool    `json:"isPrimary"`
}

type OrgApplicationView struct {
	ID                string              `json:"id"`
	Name              string              `json:"name"`
	Slug              string              `json:"slug"`
	Logo              *string             `json:"logo"`
	OrgType           string              `json:"orgType"`
	Status            string              `json:"status"`
	DiscordInvite     string              `json:"discordInvite"`
	VrchatGroupID     string              `json:"vrchatGroupId"`
	SubmittedByUserID string              `json:"submittedByUserId"`
	CreatedAt         string              `json:"createdAt"`
	UpdatedAt         string              `json:"updatedAt"`
	Members           []TeamMemberSummary `json:"members"`
}

type TeamApplicationView struct {
	ID                     string               `json:"id"`
	Name                   string               `json:"name"`
	Slug                   string               `json:"slug"`
	Logo                   *string              `json:"logo"`
	Status                 string               `json:"status"`
	SubmittedByUserID      string               `json:"submittedByUserId"`
	CreatedAt              string               `json:"createdAt"`
	UpdatedAt              string               `json:"updatedAt"`
	PrimaryOrganization    LinkedOrganization   `json:"primaryOrganization"`
	SecondaryOrganizations []LinkedOrganization `json:"secondaryOrganizations"`
	Members                []TeamMemberSummary  `json:"members"`
}

type ListApplicationsResponse struct {
	Organizations []OrgApplicationView  `json:"organizations"`
	Teams         []TeamApplicationView `json:"teams"`
}

type ListOrganizationsResponse struct {
	Organizations []LinkedOrganization `json:"organizations"`
}

func getOrgApplicationView(ctx context.Context, id string) (*OrgApplicationView, error) {
	org, err := q().GetOrgByID(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, &errs.Error{Code: errs.NotFound, Message: "organization not found"}
	}
	if err != nil {
		return nil, err
	}

	members, err := loadMemberRows(ctx, id)
	if err != nil {
		return nil, err
	}

	summaries := make([]TeamMemberSummary, 0, len(members))
	for _, m := range members {
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

	var logo *string
	if org.Logo.Valid && org.Logo.String != "" {
		l := org.Logo.String
		logo = &l
	}
	orgType := "ORGANIZATION"
	if org.OrgType.Valid {
		orgType = org.OrgType.String
	}
	status := "PENDING"
	if org.Status.Valid {
		status = org.Status.String
	}
	dInvite := ""
	if org.DiscordInvite.Valid {
		dInvite = org.DiscordInvite.String
	}
	vGroup := ""
	if org.VrchatGroupId.Valid {
		vGroup = org.VrchatGroupId.String
	}
	submittedBy := ""
	if org.SubmittedByUserId.Valid {
		submittedBy = org.SubmittedByUserId.String
	}

	updatedAtStr := ""
	if org.UpdatedAt.Valid {
		updatedAtStr = org.UpdatedAt.Time.UTC().Format(time.RFC3339Nano)
	}

	return &OrgApplicationView{
		ID:                org.ID,
		Name:              org.Name,
		Slug:              org.Slug,
		Logo:              logo,
		OrgType:           orgType,
		Status:            status,
		DiscordInvite:     dInvite,
		VrchatGroupID:     vGroup,
		SubmittedByUserID: submittedBy,
		CreatedAt:         org.CreatedAt.UTC().Format(time.RFC3339Nano),
		UpdatedAt:         updatedAtStr,
		Members:           summaries,
	}, nil
}

func getTeamApplicationView(ctx context.Context, id string) (*TeamApplicationView, error) {
	teamRow, err := q().GetTeamByID(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, &errs.Error{Code: errs.NotFound, Message: "team not found"}
	}
	if err != nil {
		return nil, err
	}

	orgRows, err := q().ListOrgsForTeam(ctx, id)
	if err != nil {
		return nil, err
	}

	var primaryOrg LinkedOrganization
	secondaryOrgs := make([]LinkedOrganization, 0)

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
		linked := LinkedOrganization{
			ID:        r.ID,
			Name:      r.Name,
			Slug:      r.Slug,
			Logo:      logo,
			OrgType:   orgType,
			Status:    status,
			IsPrimary: r.IsPrimary,
		}
		if r.IsPrimary {
			primaryOrg = linked
		} else {
			secondaryOrgs = append(secondaryOrgs, linked)
		}
	}

	roster, err := q().ListRosterForTeam(ctx, id)
	if err != nil {
		return nil, err
	}

	summaries := make([]TeamMemberSummary, 0, len(roster))
	for _, m := range roster {
		var slug *string
		if m.Slug.Valid && m.Slug.String != "" {
			s := m.Slug.String
			slug = &s
		}
		role := "member"
		if m.Role.Valid && m.Role.String != "" {
			role = m.Role.String
		}
		summaries = append(summaries, TeamMemberSummary{
			UserID: m.UserId,
			Name:   displayName(m.Name, m.VrchatUsername),
			Slug:   slug,
			Role:   role,
		})
	}

	var logo *string
	if teamRow.Logo.Valid && teamRow.Logo.String != "" {
		l := teamRow.Logo.String
		logo = &l
	}
	submittedBy := ""
	if teamRow.SubmittedByUserId.Valid {
		submittedBy = teamRow.SubmittedByUserId.String
	}
	updatedAtStr := ""
	if teamRow.UpdatedAt.Valid {
		updatedAtStr = teamRow.UpdatedAt.Time.UTC().Format(time.RFC3339Nano)
	}

	return &TeamApplicationView{
		ID:                     teamRow.ID,
		Name:                   teamRow.Name,
		Slug:                   teamRow.Slug,
		Logo:                   logo,
		Status:                 teamRow.Status,
		SubmittedByUserID:      submittedBy,
		CreatedAt:              teamRow.CreatedAt.UTC().Format(time.RFC3339Nano),
		UpdatedAt:              updatedAtStr,
		PrimaryOrganization:    primaryOrg,
		SecondaryOrganizations: secondaryOrgs,
		Members:                summaries,
	}, nil
}

func submitOrganizationApplication(ctx context.Context, actor *auth.Actor, p *SubmitOrgApplicationRequest) (*OrgApplicationView, error) {
	if actor == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "missing session token"}
	}
	if strings.TrimSpace(p.Name) == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "organization name is required"}
	}
	if strings.TrimSpace(p.DiscordInvite) == "" || strings.TrimSpace(p.VrchatGroupID) == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "discord invite and vrchat group ID are required"}
	}

	slug := slugifyTeamName(p.Name)
	if p.Slug != nil && strings.TrimSpace(*p.Slug) != "" {
		slug = strings.TrimSpace(*p.Slug)
		if !auth.IsValidSlug(slug) {
			return nil, &errs.Error{Code: errs.InvalidArgument, Message: "invalid slug format"}
		}
	}
	if _, err := q().OrgIDBySlug(ctx, slug); err == nil {
		return nil, &errs.Error{Code: errs.AlreadyExists, Message: "organization slug is already in use"}
	} else if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	// Build staff roster (must include creator as administrator, capped at 3 total)
	rosterMap := make(map[string]bool)
	rosterMap[actor.UserID] = true
	for _, uid := range p.InitialRoster {
		if uid != "" {
			rosterMap[uid] = true
		}
	}
	if len(rosterMap) > auth.AdministratorRoleLimit {
		return nil, &errs.Error{
			Code:    errs.InvalidArgument,
			Message: fmt.Sprintf("staff roster cannot exceed %d administrators", auth.AdministratorRoleLimit),
		}
	}

	var logoVal sql.NullString
	if p.Logo != nil && *p.Logo != "" {
		logoVal = sql.NullString{String: *p.Logo, Valid: true}
	}

	orgID, err := q().CreateOrg(ctx, sqlc.CreateOrgParams{
		Name:              p.Name,
		Slug:              slug,
		Logo:              logoVal,
		OrgType:           sql.NullString{String: "ORGANIZATION", Valid: true},
		Status:            sql.NullString{String: "PENDING", Valid: true},
		DiscordInvite:     sql.NullString{String: p.DiscordInvite, Valid: true},
		VrchatGroupId:     sql.NullString{String: p.VrchatGroupID, Valid: true},
		SubmittedByUserId: sql.NullString{String: actor.UserID, Valid: true},
		UpdatedAt:         sql.NullTime{Time: time.Now().UTC(), Valid: true},
	})
	if isUniqueViolation(err) {
		return nil, &errs.Error{Code: errs.AlreadyExists, Message: "organization slug is already in use"}
	}
	if err != nil {
		return nil, err
	}

	// Insert staff roster members into `member` table
	for uid := range rosterMap {
		if err := q().InsertMember(ctx, sqlc.InsertMemberParams{
			OrganizationId: orgID,
			UserId:         uid,
			Role:           auth.AdministratorRole,
		}); err != nil {
			return nil, fmt.Errorf("failed to insert org member: %w", err)
		}
	}

	return getOrgApplicationView(ctx, orgID)
}

func submitTeamApplication(ctx context.Context, actor *auth.Actor, p *SubmitTeamApplicationRequest) (*TeamApplicationView, error) {
	if actor == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "missing session token"}
	}

	if p.TeamID != nil && *p.TeamID != "" {
		teamRow, err := q().GetTeamByID(ctx, *p.TeamID)
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "team not found"}
		}
		if err != nil {
			return nil, err
		}

		isTeamAdmin := false
		roster, err := q().ListRosterForTeam(ctx, teamRow.ID)
		if err == nil {
			for _, m := range roster {
				if m.UserId == actor.UserID && m.Role.Valid && m.Role.String == auth.AdministratorRole {
					isTeamAdmin = true
					break
				}
			}
		}
		if !isTeamAdmin && !auth.IsSiteAdmin(actor.SiteRole) && !auth.IsEventAdmin(actor.SiteRole) {
			primOrg, err := q().GetPrimaryOrgForTeam(ctx, teamRow.ID)
			if err == nil && primOrg.ID != "" {
				role, err := q().MemberRoleByOrgAndUser(ctx, sqlc.MemberRoleByOrgAndUserParams{OrganizationId: primOrg.ID, UserId: actor.UserID})
				if err == nil && role == auth.AdministratorRole {
					isTeamAdmin = true
				}
			}
		}
		if !isTeamAdmin && !auth.IsSiteAdmin(actor.SiteRole) && !auth.IsEventAdmin(actor.SiteRole) {
			return nil, &errs.Error{Code: errs.PermissionDenied, Message: "must be a team administrator to apply to an organization"}
		}

		if strings.TrimSpace(p.PrimaryOrganizationID) == "" {
			return nil, &errs.Error{Code: errs.InvalidArgument, Message: "primary organization ID is required"}
		}

		primOrg, err := q().GetOrgByID(ctx, p.PrimaryOrganizationID)
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &errs.Error{Code: errs.NotFound, Message: "primary organization not found"}
		}
		if err != nil {
			return nil, err
		}
		if !primOrg.Status.Valid || primOrg.Status.String != "APPROVED" {
			return nil, &errs.Error{Code: errs.FailedPrecondition, Message: "primary organization must be approved"}
		}

		if currentPrim, err := q().GetPrimaryOrgForTeam(ctx, teamRow.ID); err == nil && currentPrim.ID != "" {
			_ = q().DeleteTeamOrganization(ctx, sqlc.DeleteTeamOrganizationParams{
				TeamId:         teamRow.ID,
				OrganizationId: currentPrim.ID,
			})
		}
		_ = q().InsertTeamOrganization(ctx, sqlc.InsertTeamOrganizationParams{
			TeamId:         teamRow.ID,
			OrganizationId: p.PrimaryOrganizationID,
			IsPrimary:      true,
		})

		_ = q().UpdateTeamStatus(ctx, sqlc.UpdateTeamStatusParams{
			Status:            "PENDING",
			ReviewedByUserId: sql.NullString{},
			ReviewedAt:        sql.NullTime{},
			ID:                teamRow.ID,
		})

		invalidateTeamCache(ctx, teamRow.ID)
		return getTeamApplicationView(ctx, teamRow.ID)
	}

	if strings.TrimSpace(p.Name) == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "team name is required"}
	}
	if strings.TrimSpace(p.PrimaryOrganizationID) == "" {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "primary organization ID is required"}
	}

	// Verify primary org exists and is APPROVED
	primOrg, err := q().GetOrgByID(ctx, p.PrimaryOrganizationID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, &errs.Error{Code: errs.NotFound, Message: "primary organization not found"}
	}
	if err != nil {
		return nil, err
	}
	if !primOrg.Status.Valid || primOrg.Status.String != "APPROVED" {
		return nil, &errs.Error{Code: errs.FailedPrecondition, Message: "primary organization must be approved"}
	}

	// Verify secondary orgs exist and are APPROVED
	secOrgIDs := make([]string, 0)
	for _, secID := range p.SecondaryOrganizationIDs {
		if secID == "" || secID == p.PrimaryOrganizationID {
			continue
		}
		sOrg, err := q().GetOrgByID(ctx, secID)
		if errors.Is(err, sql.ErrNoRows) {
			return nil, &errs.Error{Code: errs.NotFound, Message: fmt.Sprintf("secondary organization %s not found", secID)}
		}
		if err != nil {
			return nil, err
		}
		if !sOrg.Status.Valid || sOrg.Status.String != "APPROVED" {
			return nil, &errs.Error{Code: errs.FailedPrecondition, Message: fmt.Sprintf("secondary organization %s must be approved", secID)}
		}
		secOrgIDs = append(secOrgIDs, secID)
	}

	slug := slugifyTeamName(p.Name)
	if p.Slug != nil && strings.TrimSpace(*p.Slug) != "" {
		slug = strings.TrimSpace(*p.Slug)
		if !auth.IsValidSlug(slug) {
			return nil, &errs.Error{Code: errs.InvalidArgument, Message: "invalid slug format"}
		}
	}
	if _, err := q().TeamIDBySlug(ctx, slug); err == nil {
		return nil, &errs.Error{Code: errs.AlreadyExists, Message: "team slug is already in use"}
	} else if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	var logoVal sql.NullString
	if p.Logo != nil && *p.Logo != "" {
		logoVal = sql.NullString{String: *p.Logo, Valid: true}
	}

	teamID, err := q().CreateTeam(ctx, sqlc.CreateTeamParams{
		Name:              p.Name,
		Slug:              slug,
		Logo:              logoVal,
		Status:            "PENDING",
		SubmittedByUserId: sql.NullString{String: actor.UserID, Valid: true},
	})
	if isUniqueViolation(err) {
		return nil, &errs.Error{Code: errs.AlreadyExists, Message: "team slug is already in use"}
	}
	if err != nil {
		return nil, err
	}

	// Insert primary teamOrganization link
	if err := q().InsertTeamOrganization(ctx, sqlc.InsertTeamOrganizationParams{
		TeamId:         teamID,
		OrganizationId: p.PrimaryOrganizationID,
		IsPrimary:      true,
	}); err != nil {
		return nil, fmt.Errorf("failed to link primary organization: %w", err)
	}

	// Insert secondary teamOrganization links
	for _, secID := range secOrgIDs {
		if err := q().InsertTeamOrganization(ctx, sqlc.InsertTeamOrganizationParams{
			TeamId:         teamID,
			OrganizationId: secID,
			IsPrimary:      false,
		}); err != nil {
			return nil, fmt.Errorf("failed to link secondary organization: %w", err)
		}
	}

	// Insert preliminary roster members
	for _, uid := range p.InitialRoster {
		if uid == "" {
			continue
		}
		_ = q().InsertTeamMemberRow(ctx, sqlc.InsertTeamMemberRowParams{
			TeamId: teamID,
			UserId: uid,
			Role:   sql.NullString{String: "member", Valid: true},
		})
	}

	return getTeamApplicationView(ctx, teamID)
}

func listAdminApplications(ctx context.Context, actor *auth.Actor) (*ListApplicationsResponse, error) {
	if actor == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "missing session token"}
	}

	resp := &ListApplicationsResponse{
		Organizations: []OrgApplicationView{},
		Teams:         []TeamApplicationView{},
	}

	// SITE_ADMIN sees org applications
	if auth.IsSiteAdmin(actor.SiteRole) {
		orgRows, err := q().ListPendingOrgs(ctx)
		if err != nil {
			return nil, err
		}
		for _, o := range orgRows {
			view, err := getOrgApplicationView(ctx, o.ID)
			if err == nil {
				resp.Organizations = append(resp.Organizations, *view)
			}
		}
	}

	// SITE_ADMIN and site EVENT_ADMIN see all team applications
	// Org admins and org eventAdmins see team applications targeting their managed orgs
	teamRows, err := q().ListPendingTeams(ctx)
	if err != nil {
		return nil, err
	}

	managedOrgIDs := make(map[string]bool)
	if !auth.IsSiteAdmin(actor.SiteRole) && !auth.IsEventAdmin(actor.SiteRole) {
		memberOrgs, err := q().ListMemberOrgsForUser(ctx, actor.UserID)
		if err == nil {
			for _, mo := range memberOrgs {
				r := strings.ToLower(mo.Role)
				if r == "administrator" || r == "eventadmin" || r == "event_admin" || r == "eventadministrator" {
					managedOrgIDs[mo.ID] = true
				}
			}
		}
	}

	for _, t := range teamRows {
		view, err := getTeamApplicationView(ctx, t.ID)
		if err == nil {
			if auth.IsSiteAdmin(actor.SiteRole) || auth.IsEventAdmin(actor.SiteRole) || managedOrgIDs[view.PrimaryOrganization.ID] {
				resp.Teams = append(resp.Teams, *view)
			}
		}
	}

	return resp, nil
}

func reviewApplication(ctx context.Context, actor *auth.Actor, p *ReviewApplicationRequest) error {
	if actor == nil {
		return &errs.Error{Code: errs.Unauthenticated, Message: "missing session token"}
	}

	status := "APPROVED"
	if strings.ToUpper(p.Action) == "REJECT" || strings.ToUpper(p.Action) == "REJECTED" {
		status = "REJECTED"
	}

	switch strings.ToUpper(p.Type) {
	case "ORGANIZATION":
		if !auth.IsSiteAdmin(actor.SiteRole) {
			return &errs.Error{Code: errs.PermissionDenied, Message: "site admin required for organization applications"}
		}
		if err := q().UpdateOrgStatus(ctx, sqlc.UpdateOrgStatusParams{
			Status: sql.NullString{String: status, Valid: true},
			ID:     p.ID,
		}); err != nil {
			return err
		}
	case "TEAM":
		isAuthorized := auth.IsSiteAdmin(actor.SiteRole) || auth.IsEventAdmin(actor.SiteRole)
		if !isAuthorized {
			// Check if actor is an admin/eventAdmin on the team's primary org
			primOrg, err := q().GetPrimaryOrgForTeam(ctx, p.ID)
			if err == nil && primOrg.ID != "" {
				role, err := q().MemberRoleByOrgAndUser(ctx, sqlc.MemberRoleByOrgAndUserParams{
					OrganizationId: primOrg.ID,
					UserId:         actor.UserID,
				})
				if err == nil {
					r := strings.ToLower(role)
					if r == "administrator" || r == "eventadmin" || r == "event_admin" || r == "eventadministrator" {
						isAuthorized = true
					}
				}
			}
		}
		if !isAuthorized {
			return &errs.Error{Code: errs.PermissionDenied, Message: "administrative access required for team applications"}
		}
		if err := q().UpdateTeamStatus(ctx, sqlc.UpdateTeamStatusParams{
			Status:            status,
			ReviewedByUserId: sql.NullString{String: actor.UserID, Valid: true},
			ReviewedAt:        sql.NullTime{Time: time.Now().UTC(), Valid: true},
			ID:                p.ID,
		}); err != nil {
			return err
		}
	default:
		return &errs.Error{Code: errs.InvalidArgument, Message: "invalid application type"}
	}

	return nil
}

func linkSecondaryOrganization(ctx context.Context, actor *auth.Actor, p *LinkSecondaryOrgRequest) (*Team, error) {
	if actor == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "missing session token"}
	}

	primOrg, err := q().GetPrimaryOrgForTeam(ctx, p.TeamID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, &errs.Error{Code: errs.NotFound, Message: "team primary organization not found"}
	}
	if err != nil {
		return nil, err
	}

	targetOrg, err := q().GetOrgByID(ctx, p.OrganizationID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, &errs.Error{Code: errs.NotFound, Message: "target organization not found"}
	}
	if err != nil {
		return nil, err
	}
	if !targetOrg.Status.Valid || targetOrg.Status.String != "APPROVED" {
		return nil, &errs.Error{Code: errs.FailedPrecondition, Message: "target organization must be approved"}
	}

	// Check permissions: caller must be administrator on primary org AND target org (unless site admin)
	if !auth.IsSiteAdmin(actor.SiteRole) {
		primRole, err := q().MemberRoleByOrgAndUser(ctx, sqlc.MemberRoleByOrgAndUserParams{OrganizationId: primOrg.ID, UserId: actor.UserID})
		if err != nil || primRole != auth.AdministratorRole {
			return nil, &errs.Error{Code: errs.PermissionDenied, Message: "must be an administrator of the primary organization"}
		}

		targetRole, err := q().MemberRoleByOrgAndUser(ctx, sqlc.MemberRoleByOrgAndUserParams{OrganizationId: targetOrg.ID, UserId: actor.UserID})
		if err != nil || targetRole != auth.AdministratorRole {
			return nil, &errs.Error{Code: errs.PermissionDenied, Message: "must be an administrator of the target organization to link it"}
		}
	}

	if _, err := q().CheckTeamOrgLink(ctx, sqlc.CheckTeamOrgLinkParams{TeamId: p.TeamID, OrganizationId: p.OrganizationID}); err == nil {
		return nil, &errs.Error{Code: errs.AlreadyExists, Message: "organization is already linked to this team"}
	} else if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	if err := q().InsertTeamOrganization(ctx, sqlc.InsertTeamOrganizationParams{
		TeamId:         p.TeamID,
		OrganizationId: p.OrganizationID,
		IsPrimary:      false,
	}); err != nil {
		return nil, fmt.Errorf("failed to link secondary organization: %w", err)
	}

	invalidateTeamCache(ctx, p.TeamID)
	return loadTeam(ctx, p.TeamID)
}

func unlinkSecondaryOrganization(ctx context.Context, actor *auth.Actor, p *UnlinkSecondaryOrgRequest) (*Team, error) {
	if actor == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "missing session token"}
	}

	primOrg, err := q().GetPrimaryOrgForTeam(ctx, p.TeamID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, &errs.Error{Code: errs.NotFound, Message: "team primary organization not found"}
	}
	if err != nil {
		return nil, err
	}

	if p.OrganizationID == primOrg.ID {
		return nil, &errs.Error{Code: errs.FailedPrecondition, Message: "cannot unlink the team's primary organization"}
	}

	if !auth.IsSiteAdmin(actor.SiteRole) {
		primRole, err := q().MemberRoleByOrgAndUser(ctx, sqlc.MemberRoleByOrgAndUserParams{OrganizationId: primOrg.ID, UserId: actor.UserID})
		if err != nil || primRole != auth.AdministratorRole {
			return nil, &errs.Error{Code: errs.PermissionDenied, Message: "must be an administrator of the primary organization"}
		}
	}

	if err := q().DeleteTeamOrganization(ctx, sqlc.DeleteTeamOrganizationParams{
		TeamId:         p.TeamID,
		OrganizationId: p.OrganizationID,
	}); err != nil {
		return nil, fmt.Errorf("failed to unlink secondary organization: %w", err)
	}

	invalidateTeamCache(ctx, p.TeamID)
	return loadTeam(ctx, p.TeamID)
}

func listApprovedOrganizations(ctx context.Context) (*ListOrganizationsResponse, error) {
	rows, err := q().ListApprovedOrgs(ctx)
	if err != nil {
		return nil, err
	}
	orgs := make([]LinkedOrganization, 0, len(rows))
	for _, r := range rows {
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
		orgs = append(orgs, LinkedOrganization{
			ID:        r.ID,
			Name:      r.Name,
			Slug:      r.Slug,
			Logo:      logo,
			OrgType:   orgType,
			Status:    status,
			IsPrimary: false,
		})
	}
	return &ListOrganizationsResponse{Organizations: orgs}, nil
}

// --- HTTP Endpoints ---

//encore:api auth method=POST path=/api/applications/organization
func (s *Service) SubmitOrganizationApplication(ctx context.Context, p *SubmitOrgApplicationRequest) (*OrgApplicationView, error) {
	actor := encoreauth.Data().(*auth.Actor)
	return submitOrganizationApplication(ctx, actor, p)
}

//encore:api auth method=POST path=/api/applications/team
func (s *Service) SubmitTeamApplication(ctx context.Context, p *SubmitTeamApplicationRequest) (*TeamApplicationView, error) {
	actor := encoreauth.Data().(*auth.Actor)
	return submitTeamApplication(ctx, actor, p)
}

//encore:api auth method=GET path=/api/admin/applications
func (s *Service) ListApplications(ctx context.Context, p *ListApplicationsRequest) (*ListApplicationsResponse, error) {
	actor := encoreauth.Data().(*auth.Actor)
	return listAdminApplications(ctx, actor)
}

//encore:api auth method=POST path=/api/admin/applications/review
func (s *Service) ReviewApplication(ctx context.Context, p *ReviewApplicationRequest) error {
	actor := encoreauth.Data().(*auth.Actor)
	return reviewApplication(ctx, actor, p)
}

//encore:api auth method=POST path=/api/teams/link-secondary
func (s *Service) LinkSecondaryOrganization(ctx context.Context, p *LinkSecondaryOrgRequest) (*Team, error) {
	actor := encoreauth.Data().(*auth.Actor)
	return linkSecondaryOrganization(ctx, actor, p)
}

//encore:api auth method=POST path=/api/teams/unlink-secondary
func (s *Service) UnlinkSecondaryOrganization(ctx context.Context, p *UnlinkSecondaryOrgRequest) (*Team, error) {
	actor := encoreauth.Data().(*auth.Actor)
	return unlinkSecondaryOrganization(ctx, actor, p)
}

//encore:api public method=GET path=/api/organizations
func (s *Service) ListApprovedOrganizations(ctx context.Context) (*ListOrganizationsResponse, error) {
	return listApprovedOrganizations(ctx)
}
