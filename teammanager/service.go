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
	Image  *string `json:"image,omitempty"`
}

// Team is a team with its members and aggregate statistics.
type Team struct {
	ID                          string               `json:"id"`
	Name                        string               `json:"name"`
	Slug                        string               `json:"slug"`
	Logo                        *string              `json:"logo"`
	Description                 *string              `json:"description,omitempty"`
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
	Description                 *string              `json:"description,omitempty"`
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
	Image  *string `json:"image,omitempty"`
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
		ID: r.ID, Name: r.Name, Slug: r.Slug, Logo: r.Logo, Description: r.Description,
		RankingAverage: r.RankingAverage, PointsAverage: r.PointsAverage,
		SeasonRank: r.SeasonRank, AveragePointsPerEvent: r.AveragePointsPerEvent,
	}
}

// toOrgBySlug converts a GetOrgBySlug row to the shared Organization shape.
func toOrgBySlug(r sqlc.GetOrgBySlugRow) *sqlc.Organization {
	return &sqlc.Organization{
		ID: r.ID, Name: r.Name, Slug: r.Slug, Logo: r.Logo, Description: r.Description,
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
		var img *string
		if m.Image.Valid && m.Image.String != "" {
			i := m.Image.String
			img = &i
		}
		summaries = append(summaries, TeamMemberSummary{
			UserID: m.UserId,
			Name:   displayName(m.Name, m.VrchatUsername),
			Slug:   slug,
			Role:   m.Role,
			Image:  img,
		})
	}
	slots := auth.AdministratorRoleLimit - adminCount
	if slots < 0 {
		slots = 0
	}
	var logo *string
	if org.Logo.Valid && org.Logo.String != "" {
		logo = &org.Logo.String
	}
	var desc *string
	if org.Description.Valid && org.Description.String != "" {
		desc = &org.Description.String
	}
	return &Team{
		ID:                          org.ID,
		Name:                        org.Name,
		Slug:                        org.Slug,
		Logo:                        logo,
		Description:                 desc,
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
			var img *string
			if m.Image.Valid && m.Image.String != "" {
				i := m.Image.String
				img = &i
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
				Image:  img,
			})
		}

		var logo *string
		if teamRow.Logo.Valid && teamRow.Logo.String != "" {
			l := teamRow.Logo.String
			logo = &l
		}
		var desc *string
		if teamRow.Description.Valid && teamRow.Description.String != "" {
			d := teamRow.Description.String
			desc = &d
		}

		// Add staff from associated organizations to team members if not already present
		existingUserIDs := make(map[string]bool)
		for _, m := range summaries {
			existingUserIDs[m.UserID] = true
		}
		for _, org := range orgs {
			orgStaff, sErr := loadMemberRows(ctx, org.ID)
			if sErr == nil {
				for _, m := range orgStaff {
					if !existingUserIDs[m.UserId] {
						existingUserIDs[m.UserId] = true
						var slug *string
						if m.Slug.Valid && m.Slug.String != "" {
							s := m.Slug.String
							slug = &s
						}
						var img *string
						if m.Image.Valid && m.Image.String != "" {
							i := m.Image.String
							img = &i
						}
						summaries = append(summaries, TeamMemberSummary{
							UserID: m.UserId,
							Name:   displayName(m.Name, m.VrchatUsername),
							Slug:   slug,
							Role:   m.Role,
							Image:  img,
						})
					}
				}
			}
		}

		t := &Team{
			ID:                          teamRow.ID,
			Name:                        teamRow.Name,
			Slug:                        teamRow.Slug,
			Logo:                        logo,
			Description:                 desc,
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

		if primOrgID != "" {
			if orgRow, err := q().GetOrgByID(ctx, primOrgID); err == nil {
				if t.Stats.RankingAverage == nil {
					t.Stats.RankingAverage = nullFloatToPtr(orgRow.RankingAverage)
				}
				if t.Stats.PointsAverage == nil {
					t.Stats.PointsAverage = nullFloatToPtr(orgRow.PointsAverage)
				}
				if t.Stats.SeasonRank == nil {
					t.Stats.SeasonRank = nullInt32ToPtr(orgRow.SeasonRank)
				}
				if t.Stats.AveragePointsPerEvent == nil {
					t.Stats.AveragePointsPerEvent = nullFloatToPtr(orgRow.AveragePointsPerEvent)
				}
			}
		}
		return t, nil
	}

	// If not found in `team` table, fall back to `organization` table (standalone / legacy governing organization)
	if errors.Is(err, sql.ErrNoRows) {
		var orgRow sqlc.GetOrgByIDRow
		orgRow, err = q().GetOrgByID(ctx, id)
		if errors.Is(err, sql.ErrNoRows) {
			var slugRow sqlc.GetOrgBySlugRow
			slugRow, err = q().GetOrgBySlug(ctx, id)
			if err == nil {
				orgRow = sqlc.GetOrgByIDRow{
					ID: slugRow.ID, Name: slugRow.Name, Slug: slugRow.Slug, Logo: slugRow.Logo, Description: slugRow.Description,
					OrgType: slugRow.OrgType, Status: slugRow.Status,
					DiscordInvite: slugRow.DiscordInvite, VrchatGroupId: slugRow.VrchatGroupId,
					SubmittedByUserId: slugRow.SubmittedByUserId, CreatedAt: slugRow.CreatedAt, UpdatedAt: slugRow.UpdatedAt,
					RankingAverage: slugRow.RankingAverage, PointsAverage: slugRow.PointsAverage,
					SeasonRank: slugRow.SeasonRank, AveragePointsPerEvent: slugRow.AveragePointsPerEvent,
				}
			}
		}

		if err == nil {
			members, mErr := loadMemberRows(ctx, orgRow.ID)
			if mErr != nil {
				return nil, mErr
			}
			orgShape := &sqlc.Organization{
				ID: orgRow.ID, Name: orgRow.Name, Slug: orgRow.Slug, Logo: orgRow.Logo, Description: orgRow.Description,
			}
			t := toTeam(orgShape, members)
			// Organizations do not have ranking layer / team stats attached
			t.Stats = TeamStats{}

			// Aggregate members from all associated teams under this organization
			teamsForOrg, tErr := q().ListTeamsForOrg(ctx, orgRow.ID)
			if tErr == nil && len(teamsForOrg) > 0 {
				teamIDs := make([]string, len(teamsForOrg))
				for i, team := range teamsForOrg {
					teamIDs[i] = team.ID
				}
				rosterRows, rErr := q().ListRosterForTeamsBatch(ctx, teamIDs)
				if rErr == nil {
					existingUserIDs := make(map[string]bool)
					for _, m := range t.Members {
						existingUserIDs[m.UserID] = true
					}
					for _, r := range rosterRows {
						if !existingUserIDs[r.UserId] {
							existingUserIDs[r.UserId] = true
							var slug *string
							if r.Slug.Valid && r.Slug.String != "" {
								s := r.Slug.String
								slug = &s
							}
							var img *string
							if r.Image.Valid && r.Image.String != "" {
								i := r.Image.String
								img = &i
							}
							role := "member"
							if r.Role.Valid && r.Role.String != "" {
								role = r.Role.String
							}
							t.Members = append(t.Members, TeamMemberSummary{
								UserID: r.UserId,
								Name:   displayName(r.Name, r.VrchatUsername),
								Slug:   slug,
								Role:   role,
								Image:  img,
							})
						}
					}
				}
			}

			return t, nil
		}
	}

	if errors.Is(err, sql.ErrNoRows) {
		return nil, &errs.Error{Code: errs.NotFound, Message: "team not found"}
	}
	return nil, err
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
