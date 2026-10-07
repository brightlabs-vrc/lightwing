package teammanager

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"encore.dev/beta/errs"
	"encore.app/auth"
	"encore.app/teammanager/sqlc"
)

// --- listTeamMembers (mirrors listTeamMembers; publicly accessible) ---

type ListTeamMembersResponse struct {
	Members []MemberListItem `json:"members"`
	Total   int              `json:"total"`
}

func listTeamMembers(ctx context.Context, id, search string, limit, offset int) (*ListTeamMembersResponse, error) {
	// Try roster for team first
	_, teamErr := q().GetTeamByID(ctx, id)
	if teamErr == nil {
		roster, err := q().ListRosterForTeam(ctx, id)
		if err != nil {
			return nil, err
		}
		members := make([]MemberListItem, 0, len(roster))
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
			mName := displayName(m.Name, m.VrchatUsername)
			if search != "" {
				sLower := strings.ToLower(search)
				matchName := strings.Contains(strings.ToLower(mName), sLower)
				matchSlug := slug != nil && strings.Contains(strings.ToLower(*slug), sLower)
				if !matchName && !matchSlug {
					continue
				}
			}
			members = append(members, MemberListItem{
				UserID: m.UserId,
				Name:   mName,
				Slug:   slug,
				Role:   role,
			})
		}
		total := len(members)
		if offset > 0 {
			if offset >= len(members) {
				members = []MemberListItem{}
			} else {
				members = members[offset:]
			}
		}
		if limit > 0 && len(members) > limit {
			members = members[:limit]
		}
		return &ListTeamMembersResponse{Members: members, Total: total}, nil
	}

	// Fallback to org members
	var total int64
	var stubs []memberStub
	var err error
	if search == "" {
		if total, err = q().CountTeamMembers(ctx, id); err != nil {
			return nil, err
		}
		rows, err := q().ListTeamMemberRows(ctx, sqlc.ListTeamMemberRowsParams{
			OrganizationId: id,
			Column2:        int32(limit),
			Offset:         int32(offset),
		})
		if err != nil {
			return nil, err
		}
		stubs = make([]memberStub, 0, len(rows))
		for _, r := range rows {
			stubs = append(stubs, memberStub{
				UserID: r.UserId, Role: r.Role, Name: r.Name,
				VrchatUsername: r.VrchatUsername, Slug: r.Slug,
			})
		}
	} else {
		if total, err = q().CountTeamMembersBySearch(ctx, sqlc.CountTeamMembersBySearchParams{
			OrganizationId: id,
			Column2:        search,
		}); err != nil {
			return nil, err
		}
		rows, err := q().ListTeamMemberRowsBySearch(ctx, sqlc.ListTeamMemberRowsBySearchParams{
			OrganizationId: id,
			Column2:        search,
			Column3:        int32(limit),
			Offset:         int32(offset),
		})
		if err != nil {
			return nil, err
		}
		stubs = make([]memberStub, 0, len(rows))
		for _, r := range rows {
			stubs = append(stubs, memberStub{
				UserID: r.UserId, Role: r.Role, Name: r.Name,
				VrchatUsername: r.VrchatUsername, Slug: r.Slug,
			})
		}
	}
	members := []MemberListItem{}
	for _, m := range stubs {
		var slug *string
		if m.Slug.Valid {
			slug = &m.Slug.String
		}
		members = append(members, MemberListItem{
			UserID: m.UserID,
			Name:   displayName(m.Name, m.VrchatUsername),
			Slug:   slug,
			Role:   m.Role,
		})
	}
	return &ListTeamMembersResponse{Members: members, Total: int(total)}, nil
}

// memberStub is the shared shape of both member-row query variants.
type memberStub struct {
	UserID         string
	Role           string
	Name           string
	VrchatUsername sql.NullString
	Slug           sql.NullString
}

func resolvePrimaryOrgOrTarget(ctx context.Context, id string) (string, error) {
	primOrg, err := q().GetPrimaryOrgForTeam(ctx, id)
	if err == nil {
		return primOrg.ID, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return "", err
	}
	// Fallback: check if id is an organization directly
	orgID, err := q().OrgIDByID(ctx, id)
	if err != nil {
		return "", err
	}
	return orgID, nil
}

// --- addTeamMember (mirrors addTeamMember) ---

func addTeamMember(ctx context.Context, authorization, id, userID, role string) (*Team, error) {
	actor, err := auth.ResolveActor(ctx, authorization)
	if err != nil {
		return nil, err
	}

	if !auth.IsSiteAdmin(actor.SiteRole) && !auth.IsEventAdmin(actor.SiteRole) {
		targetOrgID, err := resolvePrimaryOrgOrTarget(ctx, id)
		if err != nil {
			return nil, &errs.Error{Code: errs.PermissionDenied, Message: "cannot update team roster"}
		}

		if _, _, err := auth.RequirePermission(ctx, authorization, targetOrgID, "member", "create"); err != nil {
			return nil, err
		}
	}
	targetRole := role
	if targetRole == "" {
		targetRole = "member"
	}

	if _, err := q().UserIDByID(ctx, userID); errors.Is(err, sql.ErrNoRows) {
		return nil, &errs.Error{Code: errs.NotFound, Message: "user not found"}
	} else if err != nil {
		return nil, err
	}

	// Check if this is a team
	teamRow, teamErr := q().GetTeamByID(ctx, id)
	if teamErr == nil {
		if err := q().InsertTeamMemberRow(ctx, sqlc.InsertTeamMemberRowParams{
			TeamId: teamRow.ID,
			UserId: userID,
			Role:   sql.NullString{String: targetRole, Valid: true},
		}); isUniqueViolation(err) {
			return nil, &errs.Error{Code: errs.AlreadyExists, Message: "user is already a member of this team"}
		} else if err != nil {
			return nil, err
		}
		invalidateTeamCache(ctx, id)
		return loadTeam(ctx, id)
	}

	// Else organization fallback
	if targetRole == auth.AdministratorRole {
		if err := assertAdminCapNotReached(ctx, id); err != nil {
			return nil, err
		}
	}
	if _, err := q().MemberIDByOrgAndUser(ctx, sqlc.MemberIDByOrgAndUserParams{
		OrganizationId: id,
		UserId:         userID,
	}); err == nil {
		return nil, &errs.Error{Code: errs.AlreadyExists, Message: "user is already a member of this team"}
	} else if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	if err := q().InsertMember(ctx, sqlc.InsertMemberParams{
		OrganizationId: id,
		UserId:         userID,
		Role:           targetRole,
	}); isUniqueViolation(err) {
		return nil, &errs.Error{Code: errs.AlreadyExists, Message: "user is already a member of this team"}
	} else if err != nil {
		return nil, err
	}
	if err := touchOrg(ctx, id); err != nil {
		return nil, err
	}
	invalidateTeamCache(ctx, id)
	_ = auth.InvalidateMemberRole(ctx, id, userID)

	if loaded, err := loadTeam(ctx, id); err == nil {
		return loaded, nil
	}
	orgDetail, orgErr := getAdminOrganization(ctx, id)
	if orgErr == nil {
		return &Team{
			ID:                          orgDetail.ID,
			Name:                        orgDetail.Name,
			Slug:                        orgDetail.Slug,
			Logo:                        orgDetail.Logo,
			Status:                      orgDetail.Status,
			PrimaryOrganizationID:       orgDetail.ID,
			IsOrganization:              true,
			Organizations:               []LinkedOrganization{},
			AdministratorSlotsRemaining: orgDetail.AdministratorSlotsRemaining,
			Members:                     orgDetail.Members,
		}, nil
	}
	return nil, orgErr
}

// --- updateTeamMemberRole (mirrors updateTeamMemberRole) ---

func updateTeamMemberRole(ctx context.Context, authorization, id, userID, role string) (*Team, error) {
	actor, err := auth.ResolveActor(ctx, authorization)
	if err != nil {
		return nil, err
	}

	if !auth.IsSiteAdmin(actor.SiteRole) && !auth.IsEventAdmin(actor.SiteRole) {
		targetOrgID, err := resolvePrimaryOrgOrTarget(ctx, id)
		if err != nil {
			return nil, &errs.Error{Code: errs.PermissionDenied, Message: "cannot update team roster"}
		}

		if _, _, err := auth.RequirePermission(ctx, authorization, targetOrgID, "member", "update"); err != nil {
			return nil, err
		}
	}

	// Check if this is a team
	teamRow, teamErr := q().GetTeamByID(ctx, id)
	if teamErr == nil {
		if err := q().UpdateTeamMemberRoleRow(ctx, sqlc.UpdateTeamMemberRoleRowParams{
			Role:   sql.NullString{String: role, Valid: true},
			TeamId: teamRow.ID,
			UserId: userID,
		}); err != nil {
			return nil, err
		}
		invalidateTeamCache(ctx, id)
		return loadTeam(ctx, id)
	}

	// Org fallback
	currentRole, err := q().MemberRoleByOrgAndUser(ctx, sqlc.MemberRoleByOrgAndUserParams{
		OrganizationId: id,
		UserId:         userID,
	})
	if errors.Is(err, sql.ErrNoRows) {
		return nil, &errs.Error{Code: errs.NotFound, Message: "member not found"}
	}
	if err != nil {
		return nil, err
	}
	if role == auth.AdministratorRole && currentRole != auth.AdministratorRole {
		if err := assertAdminCapNotReached(ctx, id); err != nil {
			return nil, err
		}
	}
	if err := q().UpdateMemberRole(ctx, sqlc.UpdateMemberRoleParams{
		Role:           role,
		OrganizationId: id,
		UserId:         userID,
	}); err != nil {
		return nil, err
	}
	if err := touchOrg(ctx, id); err != nil {
		return nil, err
	}
	invalidateTeamCache(ctx, id)
	_ = auth.InvalidateMemberRole(ctx, id, userID)

	if loaded, err := loadTeam(ctx, id); err == nil {
		return loaded, nil
	}
	orgDetail, orgErr := getAdminOrganization(ctx, id)
	if orgErr == nil {
		return &Team{
			ID:                          orgDetail.ID,
			Name:                        orgDetail.Name,
			Slug:                        orgDetail.Slug,
			Logo:                        orgDetail.Logo,
			Status:                      orgDetail.Status,
			PrimaryOrganizationID:       orgDetail.ID,
			Organizations:               []LinkedOrganization{},
			AdministratorSlotsRemaining: orgDetail.AdministratorSlotsRemaining,
			Members:                     orgDetail.Members,
		}, nil
	}
	return nil, orgErr
}

// --- removeTeamMember (mirrors removeTeamMember) ---

func removeTeamMember(ctx context.Context, authorization, id, userID string) (*Team, error) {
	actor, err := auth.ResolveActor(ctx, authorization)
	if err != nil {
		return nil, err
	}

	if !auth.IsSiteAdmin(actor.SiteRole) && !auth.IsEventAdmin(actor.SiteRole) {
		targetOrgID, err := resolvePrimaryOrgOrTarget(ctx, id)
		if err != nil {
			return nil, &errs.Error{Code: errs.PermissionDenied, Message: "cannot update team roster"}
		}

		if _, _, err := auth.RequirePermission(ctx, authorization, targetOrgID, "member", "delete"); err != nil {
			return nil, err
		}
	}

	// Check if this is a team
	teamRow, teamErr := q().GetTeamByID(ctx, id)
	if teamErr == nil {
		if err := q().DeleteTeamMemberRow(ctx, sqlc.DeleteTeamMemberRowParams{
			TeamId: teamRow.ID,
			UserId: userID,
		}); err != nil {
			return nil, err
		}
		invalidateTeamCache(ctx, id)
		return loadTeam(ctx, id)
	}

	// Org fallback
	if _, err := q().MemberIDByOrgAndUser(ctx, sqlc.MemberIDByOrgAndUserParams{
		OrganizationId: id,
		UserId:         userID,
	}); errors.Is(err, sql.ErrNoRows) {
		return nil, &errs.Error{Code: errs.NotFound, Message: "member not found"}
	} else if err != nil {
		return nil, err
	}
	if err := q().DeleteMember(ctx, sqlc.DeleteMemberParams{
		OrganizationId: id,
		UserId:         userID,
	}); err != nil {
		return nil, err
	}
	if err := touchOrg(ctx, id); err != nil {
		return nil, err
	}
	invalidateTeamCache(ctx, id)
	_ = auth.InvalidateMemberRole(ctx, id, userID)

	if loaded, err := loadTeam(ctx, id); err == nil {
		return loaded, nil
	}
	orgDetail, orgErr := getAdminOrganization(ctx, id)
	if orgErr == nil {
		return &Team{
			ID:                          orgDetail.ID,
			Name:                        orgDetail.Name,
			Slug:                        orgDetail.Slug,
			Logo:                        orgDetail.Logo,
			Status:                      orgDetail.Status,
			PrimaryOrganizationID:       orgDetail.ID,
			Organizations:               []LinkedOrganization{},
			AdministratorSlotsRemaining: orgDetail.AdministratorSlotsRemaining,
			Members:                     orgDetail.Members,
		}, nil
	}
	return nil, orgErr
}

// --- HTTP endpoints ---

type ListTeamMembersRequest struct {
	ID     string `query:"id"`
	Search string `query:"search"`
	Limit  int    `query:"limit"`
	Offset int    `query:"offset"`
}

//encore:api public method=GET path=/api/team-members
func (s *Service) ListTeamMembers(ctx context.Context, p *ListTeamMembersRequest) (*ListTeamMembersResponse, error) {
	return listTeamMembers(ctx, p.ID, p.Search, p.Limit, p.Offset)
}

type AddTeamMemberRequest struct {
	ID            string `json:"id"`
	Authorization string `header:"Authorization"`
	UserID        string `json:"userId"`
	Role          string `json:"role,omitempty"`
}

//encore:api public method=POST path=/api/team-members
func (s *Service) AddTeamMember(ctx context.Context, p *AddTeamMemberRequest) (*Team, error) {
	return addTeamMember(ctx, p.Authorization, p.ID, p.UserID, p.Role)
}

type UpdateTeamMemberRoleRequest struct {
	ID            string `json:"id"`
	UserID        string `json:"userId"`
	Authorization string `header:"Authorization"`
	Role          string `json:"role"`
}

//encore:api public method=PATCH path=/api/team-members
func (s *Service) UpdateTeamMemberRole(ctx context.Context, p *UpdateTeamMemberRoleRequest) (*Team, error) {
	return updateTeamMemberRole(ctx, p.Authorization, p.ID, p.UserID, p.Role)
}

type RemoveTeamMemberRequest struct {
	ID            string `query:"id"`
	UserID        string `query:"userId"`
	Authorization string `header:"Authorization"`
}

//encore:api public method=DELETE path=/api/team-members
func (s *Service) RemoveTeamMember(ctx context.Context, p *RemoveTeamMemberRequest) (*Team, error) {
	return removeTeamMember(ctx, p.Authorization, p.ID, p.UserID)
}
