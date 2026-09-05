// Package teammanager implements team (organization) management: teams,
// membership, and aggregate team statistics.
//
// Mirrors ts-legacy/teammanager/teams.ts, team-members.ts, team-stats.ts,
// and team-guards.ts. A team is modelled as a better-auth organization row;
// all state lives in the shared lightwing database (shared.DB).
package teammanager

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"encore.dev/beta/errs"
	"encore.dev/storage/cache"
	"encore.app/auth"
	"encore.app/shared"
)

//encore:service
type Service struct{}

// --- Types (mirror the TS interfaces) ---

// TeamStats holds a team's aggregate "container" statistics.
type TeamStats struct {
	RankingAverage        *float64 `json:"rankingAverage"`
	PointsAverage         *float64 `json:"pointsAverage"`
	SeasonRank            *int32   `json:"seasonRank"`
	AveragePointsPerEvent *float64 `json:"averagePointsPerEvent"`
}

// TeamMemberSummary is a single membership with display name.
type TeamMemberSummary struct {
	UserID string `json:"userId"`
	Name   string `json:"name"`
	Role   string `json:"role"`
}

// Team is a team with its members and aggregate statistics.
type Team struct {
	ID                          string              `json:"id"`
	Name                        string              `json:"name"`
	Slug                        string              `json:"slug"`
	Logo                        *string             `json:"logo"`
	Stats                       TeamStats           `json:"stats"`
	AdministratorSlotsRemaining int                 `json:"administratorSlotsRemaining"`
	Members                     []TeamMemberSummary `json:"members"`
}

// TeamListItem is a team row for list views.
type TeamListItem struct {
	ID                          string  `json:"id"`
	Name                        string  `json:"name"`
	Slug                        string  `json:"slug"`
	Logo                        *string `json:"logo"`
	AdministratorSlotsRemaining int     `json:"administratorSlotsRemaining"`
	MemberCount                 int     `json:"memberCount"`
}

// MemberListItem is a membership row for member list views.
type MemberListItem struct {
	UserID string  `json:"userId"`
	Name   string  `json:"name"`
	Slug   *string `json:"slug"`
	Role   string  `json:"role"`
}

// --- Cache (mirrors teamCache in teams.ts) ---

type teamCacheKey struct {
	ID string
}

var teamCache = cache.NewStructKeyspace[teamCacheKey, Team](shared.Cache, cache.KeyspaceConfig{
	KeyPattern:    "team/:ID",
	DefaultExpiry: cache.ExpireIn(300 * time.Second),
})

func invalidateTeamCache(ctx context.Context, id string) {
	_, _ = teamCache.Delete(ctx, teamCacheKey{ID: id})
}

// --- Shared loaders ---

type orgRow struct {
	ID                    string
	Name                  string
	Slug                  string
	Logo                  sql.NullString
	RankingAverage        sql.NullFloat64
	PointsAverage         sql.NullFloat64
	SeasonRank            sql.NullInt64
	AveragePointsPerEvent sql.NullFloat64
}

func nullFloatToPtr(n sql.NullFloat64) *float64 {
	if !n.Valid {
		return nil
	}
	v := n.Float64
	return &v
}

func nullInt32ToPtr(n sql.NullInt64) *int32 {
	if !n.Valid {
		return nil
	}
	v := int32(n.Int64)
	return &v
}

func scanOrgRow(row *orgRow, scanner interface {
	Scan(dest ...any) error
}) error {
	return scanner.Scan(&row.ID, &row.Name, &row.Slug, &row.Logo,
		&row.RankingAverage, &row.PointsAverage, &row.SeasonRank, &row.AveragePointsPerEvent)
}

const orgColumns = `id, name, slug, logo, "rankingAverage", "pointsAverage", "seasonRank", "averagePointsPerEvent"`

type memberRow struct {
	UserID         string
	Role           string
	Name           string
	VrchatUsername sql.NullString
	Slug           sql.NullString
}

func displayName(name string, vrc sql.NullString) string {
	if vrc.Valid && vrc.String != "" {
		return vrc.String
	}
	return name
}

func loadMemberRows(ctx context.Context, organizationID string) ([]memberRow, error) {
	rows, err := shared.DB.Query(ctx,
		`SELECT m."userId", m.role, u.name, u."vrchatUsername", u.slug
		 FROM "member" m JOIN "user" u ON u.id = m."userId"
		 WHERE m."organizationId" = $1 ORDER BY m."createdAt" ASC`,
		organizationID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	members := []memberRow{}
	for rows.Next() {
		var m memberRow
		if err := rows.Scan(&m.UserID, &m.Role, &m.Name, &m.VrchatUsername, &m.Slug); err != nil {
			return nil, err
		}
		members = append(members, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return members, nil
}

// toTeam maps an organization row plus its members to the public Team shape.
// Mirrors toTeam in ts-legacy/teammanager/teams.ts.
func toTeam(org *orgRow, members []memberRow) *Team {
	adminCount := 0
	summaries := make([]TeamMemberSummary, 0, len(members))
	for _, m := range members {
		if m.Role == auth.AdministratorRole {
			adminCount++
		}
		summaries = append(summaries, TeamMemberSummary{
			UserID: m.UserID,
			Name:   displayName(m.Name, m.VrchatUsername),
			Role:   m.Role,
		})
	}
	slots := auth.AdministratorRoleLimit - adminCount
	if slots < 0 {
		slots = 0
	}
	var logo *string
	if org.Logo.Valid {
		logo = &org.Logo.String
	}
	return &Team{
		ID:   org.ID,
		Name: org.Name,
		Slug: org.Slug,
		Logo: logo,
		Stats: TeamStats{
			RankingAverage:        nullFloatToPtr(org.RankingAverage),
			PointsAverage:         nullFloatToPtr(org.PointsAverage),
			SeasonRank:            nullInt32ToPtr(org.SeasonRank),
			AveragePointsPerEvent: nullFloatToPtr(org.AveragePointsPerEvent),
		},
		AdministratorSlotsRemaining: slots,
		Members:                     summaries,
	}
}

func loadTeam(ctx context.Context, id string) (*Team, error) {
	var org orgRow
	err := scanOrgRow(&org, shared.DB.QueryRow(ctx,
		`SELECT `+orgColumns+` FROM "organization" WHERE id = $1`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, &errs.Error{Code: errs.NotFound, Message: "team not found"}
	}
	if err != nil {
		return nil, err
	}
	members, err := loadMemberRows(ctx, id)
	if err != nil {
		return nil, err
	}
	return toTeam(&org, members), nil
}

func touchOrg(ctx context.Context, id string) error {
	_, err := shared.DB.Exec(ctx,
		`UPDATE "organization" SET "updatedAt" = $1 WHERE id = $2`, time.Now().UTC(), id)
	return err
}

// --- Guard (mirrors team-guards.ts) ---

// assertAdminCapNotReached rejects when the organization already has the
// maximum number of administrators.
func assertAdminCapNotReached(ctx context.Context, organizationID string) error {
	var count int
	if err := shared.DB.QueryRow(ctx,
		`SELECT COUNT(*) FROM "member" WHERE "organizationId" = $1 AND role = $2`,
		organizationID, auth.AdministratorRole,
	).Scan(&count); err != nil {
		return err
	}
	if count >= auth.AdministratorRoleLimit {
		return &errs.Error{
			Code:    errs.FailedPrecondition,
			Message: "At most three administrators can belong to an organization.",
		}
	}
	return nil
}

// slugifyTeamName lowercases and hyphen-separates a team name.
// Mirrors slugify in ts-legacy/teammanager/teams.ts.
func slugifyTeamName(name string) string {
	s := strings.ToLower(name)
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		} else {
			b.WriteRune('-')
		}
	}
	return strings.Trim(b.String(), "-")
}

// isUniqueViolation reports Postgres unique-violation errors (SQLSTATE 23505),
// which surface for slug and membership collisions.
func isUniqueViolation(err error) bool {
	return err != nil && strings.Contains(err.Error(), "23505")
}
