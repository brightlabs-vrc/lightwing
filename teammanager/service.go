// Package teammanager implements team (organization) management: teams,
// membership, and aggregate team statistics.
//
// Mirrors ts-legacy/teammanager/teams.ts, team-members.ts, team-stats.ts,
// and team-guards.ts. A team is modelled as a better-auth organization row;
// all state lives in the shared lightwing database (db).
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
	"encore.app/teammanager/sqlc"
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
	UserID string  `json:"userId"`
	Name   string  `json:"name"`
	Slug   *string `json:"slug"`
	Role   string  `json:"role"`
}

// Team is a team with its members and aggregate statistics.
type Team struct {
	ID                          string               `json:"id"`
	Name                        string               `json:"name"`
	Slug                        string               `json:"slug"`
	Logo                        *string              `json:"logo"`
	Status                      string               `json:"status"`
	Organizations               []LinkedOrganization `json:"organizations"`
	PrimaryOrganizationID       string               `json:"primaryOrganizationId"`
	Stats                       TeamStats            `json:"stats"`
	AdministratorSlotsRemaining int                  `json:"administratorSlotsRemaining"`
	Members                     []TeamMemberSummary  `json:"members"`
}

// TeamListItem is a team row for list views.
type TeamListItem struct {
	ID                          string               `json:"id"`
	Name                        string               `json:"name"`
	Slug                        string               `json:"slug"`
	Logo                        *string              `json:"logo"`
	Status                      string               `json:"status"`
	PrimaryOrganizationID       string               `json:"primaryOrganizationId"`
	Organizations               []LinkedOrganization `json:"organizations"`
	AdministratorSlotsRemaining int                  `json:"administratorSlotsRemaining"`
	MemberCount                 int                  `json:"memberCount"`
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

func nullFloatToPtr(n sql.NullFloat64) *float64 {
	if !n.Valid {
		return nil
	}
	v := n.Float64
	return &v
}

func nullInt32ToPtr(n sql.NullInt32) *int32 {
	if !n.Valid {
		return nil
	}
	v := n.Int32
	return &v
}

func displayName(name string, vrc sql.NullString) string {
	if vrc.Valid && vrc.String != "" {
		return vrc.String
	}
	return name
}

func loadMemberRows(ctx context.Context, organizationID string) ([]sqlc.ListMemberRowsRow, error) {
	return q().ListMemberRows(ctx, organizationID)
}

// toOrg converts a GetOrgByID row to the shared Organization shape.
func toOrg(r sqlc.GetOrgByIDRow) *sqlc.Organization {
	return &sqlc.Organization{
		ID: r.ID, Name: r.Name, Slug: r.Slug, Logo: r.Logo,
		RankingAverage: r.RankingAverage, PointsAverage: r.PointsAverage,
		SeasonRank: r.SeasonRank, AveragePointsPerEvent: r.AveragePointsPerEvent,
	}
}

// toOrgBySlug converts a GetOrgBySlug row to the shared Organization shape.
func toOrgBySlug(r sqlc.GetOrgBySlugRow) *sqlc.Organization {
	return &sqlc.Organization{
		ID: r.ID, Name: r.Name, Slug: r.Slug, Logo: r.Logo,
		RankingAverage: r.RankingAverage, PointsAverage: r.PointsAverage,
		SeasonRank: r.SeasonRank, AveragePointsPerEvent: r.AveragePointsPerEvent,
	}
}

// toTeam maps an organization row plus its members to the public Team shape.
// Mirrors toTeam in ts-legacy/teammanager/teams.ts.
func toTeam(org *sqlc.Organization, members []sqlc.ListMemberRowsRow) *Team {
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
	var logo *string
	if org.Logo.Valid {
		logo = &org.Logo.String
	}
	return &Team{
		ID:                          org.ID,
		Name:                        org.Name,
		Slug:                        org.Slug,
		Logo:                        logo,
		Status:                      "APPROVED",
		Organizations:               []LinkedOrganization{},
		PrimaryOrganizationID:       org.ID,
		Stats:                       TeamStats{
			RankingAverage:        nullFloatToPtr(org.RankingAverage),
			PointsAverage:         nullFloatToPtr(org.PointsAverage),
			SeasonRank:            nullInt32ToPtr(org.SeasonRank),
			AveragePointsPerEvent: nullFloatToPtr(org.AveragePointsPerEvent),
		},
		AdministratorSlotsRemaining: slots,
		Members:                     summaries,
	}
}

func computeTeamStats(ctx context.Context, teamID string) (TeamStats, error) {
	stats, err := q().GetTeamMembersLeaderboardStats(ctx, teamID)
	if err != nil {
		return TeamStats{}, err
	}
	if len(stats) == 0 {
		return TeamStats{}, nil
	}

	var totalPointsSum float64
	var avgPosSum float64
	var avgPtsPerEventSum float64
	activeMembersWithPoints := 0
	activeMembersWithEvents := 0
	validPosMembers := 0

	for _, s := range stats {
		if s.TotalPoints > 0 {
			totalPointsSum += float64(s.TotalPoints)
			activeMembersWithPoints++
		}
		if s.AvgPosition > 0 {
			avgPosSum += s.AvgPosition
			validPosMembers++
		}
		if s.EventsParticipated > 0 {
			avgPtsPerEventSum += float64(s.TotalPoints) / float64(s.EventsParticipated)
			activeMembersWithEvents++
		}
	}

	memberCount := float64(len(stats))

	var ptsAvg *float64
	if activeMembersWithPoints > 0 {
		avg := totalPointsSum / memberCount
		ptsAvg = &avg
	}

	var rankAvg *float64
	if validPosMembers > 0 {
		avg := avgPosSum / float64(validPosMembers)
		rankAvg = &avg
	}

	var ptsPerEventAvg *float64
	if activeMembersWithEvents > 0 {
		avg := avgPtsPerEventSum / memberCount
		ptsPerEventAvg = &avg
	}

	return TeamStats{
		RankingAverage:        rankAvg,
		PointsAverage:         ptsAvg,
		SeasonRank:            nil,
		AveragePointsPerEvent: ptsPerEventAvg,
	}, nil
}

func loadTeam(ctx context.Context, id string) (*Team, error) {
	// Try loading from `team` table by ID first
	teamRow, err := q().GetTeamByID(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		// Try loading from `team` table by slug
		teamRow, err = q().GetTeamBySlug(ctx, id)
	}

	if err == nil {
		orgRows, err := q().ListOrgsForTeam(ctx, teamRow.ID)
		if err != nil {
			return nil, err
		}
		orgs := make([]LinkedOrganization, 0, len(orgRows))
		primOrgID := ""
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
				primOrgID = r.ID
			}
			orgs = append(orgs, LinkedOrganization{
				ID:        r.ID,
				Name:      r.Name,
				Slug:      r.Slug,
				Logo:      logo,
				OrgType:   orgType,
				Status:    status,
				IsPrimary: r.IsPrimary,
			})
		}

		roster, err := q().ListRosterForTeam(ctx, teamRow.ID)
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

		t := &Team{
			ID:                          teamRow.ID,
			Name:                        teamRow.Name,
			Slug:                        teamRow.Slug,
			Logo:                        logo,
			Status:                      teamRow.Status,
			Organizations:               orgs,
			PrimaryOrganizationID:       primOrgID,
			Stats:                       TeamStats{},
			AdministratorSlotsRemaining: 0,
			Members:                     summaries,
		}

		computedStats, err := computeTeamStats(ctx, teamRow.ID)
		if err == nil {
			if computedStats.RankingAverage != nil {
				t.Stats.RankingAverage = computedStats.RankingAverage
			}
			if computedStats.PointsAverage != nil {
				t.Stats.PointsAverage = computedStats.PointsAverage
			}
			if computedStats.AveragePointsPerEvent != nil {
				t.Stats.AveragePointsPerEvent = computedStats.AveragePointsPerEvent
			}
		}
		return t, nil
	}

	// Fallback to `organization` table
	row, err := q().GetOrgByID(ctx, id)
	var orgObj *sqlc.Organization
	if err == nil {
		orgObj = toOrg(row)
	} else if errors.Is(err, sql.ErrNoRows) {
		slugRow, errBySlug := q().GetOrgBySlug(ctx, id)
		if errBySlug == nil {
			orgObj = toOrgBySlug(slugRow)
			err = nil
		} else {
			err = errBySlug
		}
	}
	if errors.Is(err, sql.ErrNoRows) {
		return nil, &errs.Error{Code: errs.NotFound, Message: "team not found"}
	}
	if err != nil {
		return nil, err
	}

	members, err := loadMemberRows(ctx, orgObj.ID)
	if err != nil {
		return nil, err
	}
	t := toTeam(orgObj, members)

	var orgLogo *string
	if orgObj.Logo.Valid && orgObj.Logo.String != "" {
		l := orgObj.Logo.String
		orgLogo = &l
	}
	orgType := "ORGANIZATION"
	status := "APPROVED"

	t.Status = status
	t.PrimaryOrganizationID = orgObj.ID
	t.Organizations = []LinkedOrganization{
		{
			ID:        orgObj.ID,
			Name:      orgObj.Name,
			Slug:      orgObj.Slug,
			Logo:      orgLogo,
			OrgType:   orgType,
			Status:    status,
			IsPrimary: true,
		},
	}

	computedStats, err := computeTeamStats(ctx, orgObj.ID)
	if err == nil {
		if computedStats.RankingAverage != nil {
			t.Stats.RankingAverage = computedStats.RankingAverage
		}
		if computedStats.PointsAverage != nil {
			t.Stats.PointsAverage = computedStats.PointsAverage
		}
		if computedStats.AveragePointsPerEvent != nil {
			t.Stats.AveragePointsPerEvent = computedStats.AveragePointsPerEvent
		}
	}
	return t, nil
}

func touchOrg(ctx context.Context, id string) error {
	return q().TouchOrg(ctx, sqlc.TouchOrgParams{
		UpdatedAt: sql.NullTime{Time: time.Now().UTC(), Valid: true},
		ID:        id,
	})
}

// --- Guard (mirrors team-guards.ts) ---

// assertAdminCapNotReached rejects when the organization already has the
// maximum number of administrators.
func assertAdminCapNotReached(ctx context.Context, organizationID string) error {
	count, err := q().CountAdmins(ctx, sqlc.CountAdminsParams{
		OrganizationId: organizationID,
		Role:           auth.AdministratorRole,
	})
	if err != nil {
		return err
	}
	if count >= int64(auth.AdministratorRoleLimit) {
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
