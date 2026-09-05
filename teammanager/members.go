package teammanager

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"encore.dev/beta/errs"
	"encore.app/auth"
)

// --- listTeamMembers (mirrors listTeamMembers; publicly accessible) ---

type ListTeamMembersResponse struct {
	Members []MemberListItem `json:"members"`
	Total   int              `json:"total"`
}

func listTeamMembers(ctx context.Context, id, search string, limit, offset int) (*ListTeamMembersResponse, error) {
	where := `m."organizationId" = $1`
	args := []any{id}
	if search != "" {
		args = append(args, "%"+search+"%")
		where += fmt.Sprintf(` AND (u.name ILIKE $%d OR u."vrchatUsername" ILIKE $%d OR u.slug ILIKE $%d)`,
			len(args), len(args), len(args))
	}
	var total int
	if err := db.QueryRow(ctx,
		`SELECT COUNT(*) FROM "member" m JOIN "user" u ON u.id = m."userId" WHERE `+where,
		args...,
	).Scan(&total); err != nil {
		return nil, err
	}
	query := `SELECT m."userId", m.role, u.name, u."vrchatUsername", u.slug
		FROM "member" m JOIN "user" u ON u.id = m."userId"
		WHERE ` + where + ` ORDER BY m."createdAt" ASC`
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
	members := []MemberListItem{}
	for rows.Next() {
		var m memberRow
		if err := rows.Scan(&m.UserID, &m.Role, &m.Name, &m.VrchatUsername, &m.Slug); err != nil {
			return nil, err
		}
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
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &ListTeamMembersResponse{Members: members, Total: total}, nil
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
	var orgExists string
	if err := db.QueryRow(ctx,
		`SELECT id FROM "organization" WHERE id = $1`, id,
	).Scan(&orgExists); errors.Is(err, sql.ErrNoRows) {
		return nil, &errs.Error{Code: errs.NotFound, Message: "team not found"}
	} else if err != nil {
		return nil, err
	}
	var userExists string
	if err := db.QueryRow(ctx,
		`SELECT id FROM "user" WHERE id = $1`, userID,
	).Scan(&userExists); errors.Is(err, sql.ErrNoRows) {
		return nil, &errs.Error{Code: errs.NotFound, Message: "user not found"}
	} else if err != nil {
		return nil, err
	}
	if targetRole == auth.AdministratorRole {
		if err := assertAdminCapNotReached(ctx, id); err != nil {
			return nil, err
		}
	}
	var dup string
	err := db.QueryRow(ctx,
		`SELECT id FROM "member" WHERE "organizationId" = $1 AND "userId" = $2`, id, userID,
	).Scan(&dup)
	if err == nil {
		return nil, &errs.Error{Code: errs.AlreadyExists, Message: "user is already a member of this team"}
	} else if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	_, err = db.Exec(ctx,
		`INSERT INTO "member" (id, "organizationId", "userId", role)
		 VALUES (gen_random_uuid()::text, $1, $2, $3)`,
		id, userID, targetRole,
	)
	if isUniqueViolation(err) {
		return nil, &errs.Error{Code: errs.AlreadyExists, Message: "user is already a member of this team"}
	}
	if err != nil {
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
	var currentRole string
	err := db.QueryRow(ctx,
		`SELECT role FROM "member" WHERE "organizationId" = $1 AND "userId" = $2`, id, userID,
	).Scan(&currentRole)
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
	if _, err := db.Exec(ctx,
		`UPDATE "member" SET role = $1 WHERE "organizationId" = $2 AND "userId" = $3`,
		role, id, userID,
	); err != nil {
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
	var exists string
	err := db.QueryRow(ctx,
		`SELECT id FROM "member" WHERE "organizationId" = $1 AND "userId" = $2`, id, userID,
	).Scan(&exists)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, &errs.Error{Code: errs.NotFound, Message: "member not found"}
	}
	if err != nil {
		return nil, err
	}
	if _, err := db.Exec(ctx,
		`DELETE FROM "member" WHERE "organizationId" = $1 AND "userId" = $2`, id, userID,
	); err != nil {
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
