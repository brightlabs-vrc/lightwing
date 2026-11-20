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
	"math"
	"sort"
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

// TeamStats holds a team's aggregate "container" statistics, separating official
// team-based competition stats from member-averaged individual performance.
type TeamStats struct {
	RankingAverage          *float64 `json:"rankingAverage"`
	PointsAverage           *float64 `json:"pointsAverage"`
	SeasonRank              *int32   `json:"seasonRank"`
	AveragePointsPerEvent   *float64 `json:"averagePointsPerEvent"`
	TeamEventsParticipated  int      `json:"teamEventsParticipated"`
	TeamTotalPoints         int      `json:"teamTotalPoints"`
	TeamAveragePoints       *float64 `json:"teamAveragePoints,omitempty"`
	TeamEventRankAverage    *float64 `json:"teamEventRankAverage,omitempty"`
	SeasonRankSource        string   `json:"seasonRankSource,omitempty"` // "TEAM_EVENTS" | "MEMBER_AVERAGE"
	Year                    int      `json:"year,omitempty"`             // 0 = All-Time
	AvailableYears          []int    `json:"availableYears,omitempty"`
}

// TeamMemberSummary is a single membership with display name.
type TeamMemberSummary struct {
	UserID string  `json:"userId"`
	Name   string  `json:"name"`
	Slug   *string `json:"slug"`
	Role   string  `json:"role"`
	Image  *string `json:"image,omitempty"`
}

// LinkedTeam represents an approved competitive team affiliated with an organization.
type LinkedTeam struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Slug        string  `json:"slug"`
	Logo        *string `json:"logo"`
	Description *string `json:"description,omitempty"`
	Status      string  `json:"status"`
	IsPrimary   bool    `json:"isPrimary"`
	MemberCount int     `json:"memberCount,omitempty"`
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
	Teams                       []LinkedTeam         `json:"teams,omitempty"`
	PrimaryOrganizationID       string               `json:"primaryOrganizationId"`
	IsOrganization              bool                 `json:"isOrganization"`
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
	if id == "" {
		return
	}
	_, _ = teamCache.Delete(ctx, teamCacheKey{ID: id})
}

// hasTeamAdminPermission checks whether the caller is authorized to manage a
// team (or organization fallback). Grants access to:
//  1. Global SITE_ADMIN or EVENT_ADMIN
//  2. Team administrators in `teamMember` (or team submitter if not demoted)
//  3. Primary organization administrators in `member`
//  4. Direct organization administrators in `member`
func hasTeamAdminPermission(ctx context.Context, actor *auth.Actor, idOrSlug string) (bool, error) {
	if actor == nil {
		return false, nil
	}
	if auth.IsSiteAdmin(actor.SiteRole) || auth.IsEventAdmin(actor.SiteRole) {
		return true, nil
	}

	// Check if target exists in `team` table by ID or slug
	teamRow, err := q().GetTeamByID(ctx, idOrSlug)
	if errors.Is(err, sql.ErrNoRows) {
		teamRow, err = q().GetTeamBySlug(ctx, idOrSlug)
	}
	if err == nil {
		// 1. Check `teamMember` table for administrator role
		tmRole, tmErr := q().TeamMemberRoleByTeamAndUser(ctx, sqlc.TeamMemberRoleByTeamAndUserParams{
			TeamId: teamRow.ID,
			UserId: actor.UserID,
		})
		if tmErr == nil && tmRole.Valid {
			r := strings.ToLower(strings.TrimSpace(tmRole.String))
			if r == strings.ToLower(auth.AdministratorRole) || r == "organizationadministrator" {
				return true, nil
			}
		} else if errors.Is(tmErr, sql.ErrNoRows) {
			// If submitter was not explicitly added to teamMember (legacy team application), allow submitter
			if teamRow.SubmittedByUserId.Valid && teamRow.SubmittedByUserId.String == actor.UserID {
				return true, nil
			}
		}

		// 2. Check primary organization administrator role in `member`
		if primOrg, pErr := q().GetPrimaryOrgForTeam(ctx, teamRow.ID); pErr == nil && primOrg.ID != "" {
			if orgRole, rErr := q().MemberRoleByOrgAndUser(ctx, sqlc.MemberRoleByOrgAndUserParams{
				OrganizationId: primOrg.ID,
				UserId:         actor.UserID,
			}); rErr == nil && strings.EqualFold(orgRole, auth.AdministratorRole) {
				return true, nil
			}
		}

		// 3. Check direct membership in `member` table under teamRow.ID
		if orgRole, rErr := q().MemberRoleByOrgAndUser(ctx, sqlc.MemberRoleByOrgAndUserParams{
			OrganizationId: teamRow.ID,
			UserId:         actor.UserID,
		}); rErr == nil && strings.EqualFold(orgRole, auth.AdministratorRole) {
			return true, nil
		}

		return false, nil
	}

	// Fallback: check if target is an organization in `organization` table
	targetOrgID := idOrSlug
	if orgRow, oErr := q().GetOrgByID(ctx, idOrSlug); oErr == nil {
		targetOrgID = orgRow.ID
	} else if slugRow, sErr := q().GetOrgBySlug(ctx, idOrSlug); sErr == nil {
		targetOrgID = slugRow.ID
	}
	if orgRole, rErr := q().MemberRoleByOrgAndUser(ctx, sqlc.MemberRoleByOrgAndUserParams{
		OrganizationId: targetOrgID,
		UserId:         actor.UserID,
	}); rErr == nil && strings.EqualFold(orgRole, auth.AdministratorRole) {
		return true, nil
	}
	if _, _, pErr := auth.RequirePermission(ctx, actor, targetOrgID, "organization", "update"); pErr == nil {
		return true, nil
	}

	return false, nil
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
		ID:                    org.ID,
		Name:                  org.Name,
		Slug:                  org.Slug,
		Logo:                  logo,
		Description:           desc,
		Status:                "APPROVED",
		Organizations:         []LinkedOrganization{},
		Teams:                 []LinkedTeam{},
		PrimaryOrganizationID: org.ID,
		IsOrganization:        true,
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

func aggregateRowsToTeamStats(rows []sqlc.GetTeamMembersLeaderboardStatsRow) TeamStats {
	if len(rows) == 0 {
		return TeamStats{}
	}

	var totalPointsSum float64
	var avgPosSum float64
	var avgPtsPerEventSum float64
	activeMembersWithPoints := 0
	activeMembersWithEvents := 0
	validPosMembers := 0

	for _, s := range rows {
		if s.TotalPoints > 0 {
			totalPointsSum += float64(s.TotalPoints)
			activeMembersWithPoints++
		}
		if s.AvgPosition > 0 {
			avgPosSum += s.AvgPosition
			validPosMembers++
		}
		if s.EventsParticipated > 0 && s.TotalPoints > 0 {
			avgPtsPerEventSum += float64(s.TotalPoints) / float64(s.EventsParticipated)
			activeMembersWithEvents++
		}
	}

	var ptsAvg *float64
	if activeMembersWithPoints > 0 {
		avg := totalPointsSum / float64(activeMembersWithPoints)
		ptsAvg = &avg
	}

	var rankAvg *float64
	if validPosMembers > 0 {
		avg := avgPosSum / float64(validPosMembers)
		rankAvg = &avg
	}

	var ptsPerEventAvg *float64
	if activeMembersWithEvents > 0 {
		avg := avgPtsPerEventSum / float64(activeMembersWithEvents)
		ptsPerEventAvg = &avg
	}

	return TeamStats{
		RankingAverage:        rankAvg,
		PointsAverage:         ptsAvg,
		SeasonRank:            nil,
		AveragePointsPerEvent: ptsPerEventAvg,
	}
}

func hasAnyMemberActivity(rows []sqlc.GetTeamMembersLeaderboardStatsRow) bool {
	for _, r := range rows {
		if r.TotalPoints > 0 || r.AvgPosition > 0 || r.EventsParticipated > 0 {
			return true
		}
	}
	return false
}

func getAvailableTeamStatYears(ctx context.Context, currentYear int) []int {
	years32, err := q().ListTeamStatYears(ctx)
	if err != nil {
		return []int{currentYear}
	}
	seen := make(map[int]bool, len(years32)+1)
	years := make([]int, 0, len(years32)+1)
	for _, y := range years32 {
		yi := int(y)
		if !seen[yi] {
			seen[yi] = true
			years = append(years, yi)
		}
	}
	if !seen[currentYear] {
		years = append(years, currentYear)
	}
	sort.Slice(years, func(i, j int) bool { return years[i] > years[j] })
	return years
}

func computeTeamStats(ctx context.Context, teamID string) (TeamStats, error) {
	currentYear := int32(time.Now().UTC().Year())
	return computeTeamStatsForYear(ctx, teamID, currentYear, true)
}

func computeTeamStatsForYear(ctx context.Context, teamID string, year int32, allowAllTimeFallback bool) (TeamStats, error) {
	currentYear := time.Now().UTC().Year()
	targetYear := year
	availYears := getAvailableTeamStatYears(ctx, currentYear)

	// 1. Fetch Member Roster Averages for targetYear
	stats, err := q().GetTeamMembersLeaderboardStats(ctx, sqlc.GetTeamMembersLeaderboardStatsParams{
		TeamID: teamID,
		Year:   targetYear,
	})
	if err != nil {
		return TeamStats{}, err
	}

	// 2. Fetch Team Competition Stats across all approved teams for targetYear
	compRows, compErr := q().GetAllApprovedTeamsCompetitionStats(ctx, targetYear)
	hasTeamCompForYear := compErr == nil && len(compRows) > 0

	// Fall back to all-time only when requested (initial team load) and no activity exists for currentYear
	if allowAllTimeFallback && targetYear != 0 && !hasAnyMemberActivity(stats) && !hasTeamCompForYear {
		allTimeStats, allErr := q().GetTeamMembersLeaderboardStats(ctx, sqlc.GetTeamMembersLeaderboardStatsParams{
			TeamID: teamID,
			Year:   0,
		})
		allTimeComp, allCompErr := q().GetAllApprovedTeamsCompetitionStats(ctx, 0)
		if (allErr == nil && hasAnyMemberActivity(allTimeStats)) || (allCompErr == nil && len(allTimeComp) > 0) {
			if allErr == nil {
				stats = allTimeStats
			}
			if allCompErr == nil {
				compRows = allTimeComp
				hasTeamCompForYear = len(compRows) > 0
			}
			targetYear = 0
		}
	}

	result := aggregateRowsToTeamStats(stats)
	result.Year = int(targetYear)
	result.AvailableYears = availYears

	// Populate this team's Team Competition Stats
	if compErr == nil {
		for _, cr := range compRows {
			if cr.TeamID == teamID {
				result.TeamEventsParticipated = int(cr.TeamEventsParticipated)
				result.TeamTotalPoints = int(cr.TeamTotalPoints)
				if cr.TeamEventsParticipated > 0 {
					avgPts := cr.TeamAvgPoints
					result.TeamAveragePoints = &avgPts
					if cr.TeamEventRankAvg > 0 {
						avgRank := cr.TeamEventRankAvg
						result.TeamEventRankAverage = &avgRank
					}
				}
				break
			}
		}
	}

	// 3. Compute SeasonRank: prioritize TEAM_EVENTS when any approved teams have team-event results in targetYear
	if hasTeamCompForYear {
		sortedComp := make([]sqlc.GetAllApprovedTeamsCompetitionStatsRow, len(compRows))
		copy(sortedComp, compRows)
		sort.Slice(sortedComp, func(i, j int) bool {
			if sortedComp[i].TeamTotalPoints != sortedComp[j].TeamTotalPoints {
				return sortedComp[i].TeamTotalPoints > sortedComp[j].TeamTotalPoints
			}
			ri, rj := math.MaxFloat64, math.MaxFloat64
			if sortedComp[i].TeamEventRankAvg > 0 {
				ri = sortedComp[i].TeamEventRankAvg
			}
			if sortedComp[j].TeamEventRankAvg > 0 {
				rj = sortedComp[j].TeamEventRankAvg
			}
			if ri != rj {
				return ri < rj
			}
			if sortedComp[i].TeamAvgPoints != sortedComp[j].TeamAvgPoints {
				return sortedComp[i].TeamAvgPoints > sortedComp[j].TeamAvgPoints
			}
			return sortedComp[i].TeamID < sortedComp[j].TeamID
		})
		for idx, cr := range sortedComp {
			if cr.TeamID == teamID {
				rank := int32(idx + 1)
				result.SeasonRank = &rank
				result.SeasonRankSource = "TEAM_EVENTS"
				break
			}
		}
		if result.SeasonRank != nil {
			return result, nil
		}
	}

	// Fallback: SeasonRank from Member Roster Averages when no team-based events exist for this team/season
	if result.PointsAverage == nil && result.RankingAverage == nil && result.AveragePointsPerEvent == nil {
		return result, nil
	}

	allRows, allErr := q().GetAllApprovedTeamsMembersLeaderboardStats(ctx, targetYear)
	if allErr == nil {
		rowsByTeam := make(map[string][]sqlc.GetTeamMembersLeaderboardStatsRow)
		for _, r := range allRows {
			rowsByTeam[r.TeamID] = append(rowsByTeam[r.TeamID], sqlc.GetTeamMembersLeaderboardStatsRow{
				UserId:             r.UserId,
				TotalPoints:        r.TotalPoints,
				AvgPosition:        r.AvgPosition,
				EventsParticipated: r.EventsParticipated,
			})
		}
		if _, exists := rowsByTeam[teamID]; !exists {
			rowsByTeam[teamID] = stats
		}

		type teamStanding struct {
			teamID string
			stats  TeamStats
		}
		standings := make([]teamStanding, 0, len(rowsByTeam))
		for tid, tRows := range rowsByTeam {
			ts := aggregateRowsToTeamStats(tRows)
			if ts.PointsAverage != nil || ts.RankingAverage != nil || ts.AveragePointsPerEvent != nil {
				standings = append(standings, teamStanding{teamID: tid, stats: ts})
			}
		}

		sort.Slice(standings, func(i, j int) bool {
			pi, pj := 0.0, 0.0
			if standings[i].stats.PointsAverage != nil {
				pi = *standings[i].stats.PointsAverage
			}
			if standings[j].stats.PointsAverage != nil {
				pj = *standings[j].stats.PointsAverage
			}
			if pi != pj {
				return pi > pj
			}

			ri, rj := math.MaxFloat64, math.MaxFloat64
			if standings[i].stats.RankingAverage != nil && *standings[i].stats.RankingAverage > 0 {
				ri = *standings[i].stats.RankingAverage
			}
			if standings[j].stats.RankingAverage != nil && *standings[j].stats.RankingAverage > 0 {
				rj = *standings[j].stats.RankingAverage
			}
			if ri != rj {
				return ri < rj
			}

			ei, ej := 0.0, 0.0
			if standings[i].stats.AveragePointsPerEvent != nil {
				ei = *standings[i].stats.AveragePointsPerEvent
			}
			if standings[j].stats.AveragePointsPerEvent != nil {
				ej = *standings[j].stats.AveragePointsPerEvent
			}
			if ei != ej {
				return ei > ej
			}

			return standings[i].teamID < standings[j].teamID
		})

		for idx, st := range standings {
			if st.teamID == teamID {
				rank := int32(idx + 1)
				result.SeasonRank = &rank
				result.SeasonRankSource = "MEMBER_AVERAGE"
				break
			}
		}
	}

	return result, nil
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
			var orgDesc *string
			if r.Description.Valid && r.Description.String != "" {
				d := r.Description.String
				orgDesc = &d
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
				ID:          r.ID,
				Name:        r.Name,
				Slug:        r.Slug,
				Logo:        logo,
				Description: orgDesc,
				OrgType:     orgType,
				Status:      status,
				IsPrimary:   r.IsPrimary,
			})
		}

		roster, err := q().ListRosterForTeam(ctx, teamRow.ID)
		if err != nil {
			return nil, err
		}
		adminCount := 0
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
			if strings.EqualFold(role, auth.AdministratorRole) {
				adminCount++
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

		// Only fall back to associated organization staff when the team's own roster is empty
		if len(summaries) == 0 {
			existingUserIDs := make(map[string]bool)
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
							if strings.EqualFold(m.Role, auth.AdministratorRole) {
								adminCount++
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
		}

		slots := auth.AdministratorRoleLimit - adminCount
		if slots < 0 {
			slots = 0
		}

		t := &Team{
			ID:                          teamRow.ID,
			Name:                        teamRow.Name,
			Slug:                        teamRow.Slug,
			Logo:                        logo,
			Description:                 desc,
			Status:                      teamRow.Status,
			Organizations:               orgs,
			Teams:                       []LinkedTeam{},
			PrimaryOrganizationID:       primOrgID,
			IsOrganization:              false,
			Stats:                       TeamStats{},
			AdministratorSlotsRemaining: slots,
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
			if computedStats.SeasonRank != nil {
				t.Stats.SeasonRank = computedStats.SeasonRank
			}
			if computedStats.AveragePointsPerEvent != nil {
				t.Stats.AveragePointsPerEvent = computedStats.AveragePointsPerEvent
			}
		}

		if primOrgID != "" {
			if t.Stats.RankingAverage == nil && t.Stats.PointsAverage == nil && len(roster) == 0 {
				if fallbackStats, fErr := computeTeamStats(ctx, primOrgID); fErr == nil {
					if t.Stats.RankingAverage == nil {
						t.Stats.RankingAverage = fallbackStats.RankingAverage
					}
					if t.Stats.PointsAverage == nil {
						t.Stats.PointsAverage = fallbackStats.PointsAverage
					}
					if t.Stats.SeasonRank == nil {
						t.Stats.SeasonRank = fallbackStats.SeasonRank
					}
					if t.Stats.AveragePointsPerEvent == nil {
						t.Stats.AveragePointsPerEvent = fallbackStats.AveragePointsPerEvent
					}
				}
			}
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

			// Aggregate affiliated teams and members under this organization
			teamsForOrg, tErr := q().ListTeamsForOrg(ctx, orgRow.ID)
			if tErr == nil && len(teamsForOrg) > 0 {
				teamIDs := make([]string, len(teamsForOrg))
				for i, team := range teamsForOrg {
					teamIDs[i] = team.ID
				}
				rosterCounts := make(map[string]int)
				rosterRows, rErr := q().ListRosterForTeamsBatch(ctx, teamIDs)
				if rErr == nil {
					existingUserIDs := make(map[string]bool)
					for _, m := range t.Members {
						existingUserIDs[m.UserID] = true
					}
					for _, r := range rosterRows {
						rosterCounts[r.TeamId]++
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

				linkedTeams := make([]LinkedTeam, 0, len(teamsForOrg))
				for _, tm := range teamsForOrg {
					if tm.Status != "APPROVED" {
						continue
					}
					var tmLogo *string
					if tm.Logo.Valid && tm.Logo.String != "" {
						l := tm.Logo.String
						tmLogo = &l
					}
					var tmDesc *string
					if tm.Description.Valid && tm.Description.String != "" {
						d := tm.Description.String
						tmDesc = &d
					}
					linkedTeams = append(linkedTeams, LinkedTeam{
						ID:          tm.ID,
						Name:        tm.Name,
						Slug:        tm.Slug,
						Logo:        tmLogo,
						Description: tmDesc,
						Status:      tm.Status,
						IsPrimary:   tm.IsPrimary,
						MemberCount: rosterCounts[tm.ID],
					})
				}
				t.Teams = linkedTeams
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
