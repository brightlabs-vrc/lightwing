package teammanager

import (
	"context"
	"database/sql"
	"errors"

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

// --- addTeamMember (mirrors addTeamMember) ---

func addTeamMember(ctx context.Context, authorization, id, userID, role string) (*Team, error) {
	if _, _, err := auth.RequirePermission(ctx, authorization, id, "member", "create"); err != nil {
		return nil, err
	}
	targetRole := role
	if targetRole == "" {
		targetRole = "member"
	}
	if _, err := q().OrgIDByID(ctx, id); errors.Is(err, sql.ErrNoRows) {
		return nil, &errs.Error{Code: errs.NotFound, Message: "team not found"}
	} else if err != nil {
		return nil, err
	}
	if _, err := q().UserIDByID(ctx, userID); errors.Is(err, sql.ErrNoRows) {
		return nil, &errs.Error{Code: errs.NotFound, Message: "user not found"}
	} else if err != nil {
		return nil, err
	}
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
	return loadTeam(ctx, id)
}

// --- updateTeamMemberRole (mirrors updateTeamMemberRole) ---

func updateTeamMemberRole(ctx context.Context, authorization, id, userID, role string) (*Team, error) {
	if _, _, err := auth.RequirePermission(ctx, authorization, id, "member", "update"); err != nil {
		return nil, err
	}
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
	return loadTeam(ctx, id)
}

// --- removeTeamMember (mirrors removeTeamMember) ---

func removeTeamMember(ctx context.Context, authorization, id, userID string) (*Team, error) {
	if _, _, err := auth.RequirePermission(ctx, authorization, id, "member", "delete"); err != nil {
		return nil, err
	}
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
	return loadTeam(ctx, id)
}

// --- HTTP endpoints (thin wrappers over the cores above) ---
//
// Member ids travel in the body/query rather than :path params because this
// Encore version only accepts scalar params alongside path params.

// ListTeamMembersRequest carries the team id plus search/pagination query params.
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

// AddTeamMemberRequest carries the team id, auth header, and new membership.
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

// UpdateTeamMemberRoleRequest carries the team/user ids, auth header, and role.
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

// RemoveTeamMemberRequest carries the team/user ids plus the auth header.
type RemoveTeamMemberRequest struct {
	ID            string `query:"id"`
	UserID        string `query:"userId"`
	Authorization string `header:"Authorization"`
}

//encore:api public method=DELETE path=/api/team-members
func (s *Service) RemoveTeamMember(ctx context.Context, p *RemoveTeamMemberRequest) (*Team, error) {
	return removeTeamMember(ctx, p.Authorization, p.ID, p.UserID)
}
