package teammanager

import (
	"context"
	"database/sql"
	"errors"

	encoreauth "encore.dev/beta/auth"
	"encore.dev/beta/errs"
	"encore.app/auth"
	"encore.app/teammanager/sqlc"
)

// --- updateTeamStats (mirrors ts-legacy/teammanager/team-stats.ts) ---
//
// Updates a team's aggregate statistics. Requires a role with organization
// update permission (administrator) in the target team; site admins
// short-circuit via RequirePermission. A nil pointer leaves the column
// unchanged.

// TeamStatsUpdate carries optional stat values.
type TeamStatsUpdate struct {
	RankingAverage        *float64
	PointsAverage         *float64
	SeasonRank            *int32
	AveragePointsPerEvent *float64
}

func updateTeamStats(ctx context.Context, actor *auth.Actor, id string, p *TeamStatsUpdate) (*Team, error) {
	if actor == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "missing session token"}
	}
	if !auth.IsSiteAdmin(actor.SiteRole) && !auth.IsEventAdmin(actor.SiteRole) {
		if _, _, err := auth.RequirePermission(ctx, actor, id, "organization", "update"); err != nil {
			return nil, err
		}
	}
	targetOrgID := id
	if _, err := q().OrgIDByID(ctx, id); errors.Is(err, sql.ErrNoRows) {
		if primOrg, errPrim := q().GetPrimaryOrgForTeam(ctx, id); errPrim == nil && primOrg.ID != "" {
			targetOrgID = primOrg.ID
		} else {
			return nil, &errs.Error{Code: errs.NotFound, Message: "team not found"}
		}
	} else if err != nil {
		return nil, err
	}
	if p.RankingAverage == nil && p.PointsAverage == nil && p.SeasonRank == nil && p.AveragePointsPerEvent == nil {
		return loadTeam(ctx, id)
	}
	var rankingAverage, pointsAverage, averagePointsPerEvent sql.NullFloat64
	if p.RankingAverage != nil {
		rankingAverage = sql.NullFloat64{Float64: *p.RankingAverage, Valid: true}
	}
	if p.PointsAverage != nil {
		pointsAverage = sql.NullFloat64{Float64: *p.PointsAverage, Valid: true}
	}
	if p.AveragePointsPerEvent != nil {
		averagePointsPerEvent = sql.NullFloat64{Float64: *p.AveragePointsPerEvent, Valid: true}
	}
	var seasonRank sql.NullInt32
	if p.SeasonRank != nil {
		seasonRank = sql.NullInt32{Int32: *p.SeasonRank, Valid: true}
	}
	if err := q().UpdateTeamStats(ctx, sqlc.UpdateTeamStatsParams{
		RankingAverage:        rankingAverage,
		PointsAverage:         pointsAverage,
		SeasonRank:            seasonRank,
		AveragePointsPerEvent: averagePointsPerEvent,
		ID:                    targetOrgID,
	}); err != nil {
		return nil, err
	}
	invalidateTeamCache(ctx, id)
	invalidateTeamCache(ctx, targetOrgID)
	if loaded, err := loadTeam(ctx, id); err == nil {
		return loaded, nil
	}
	orgDetail, orgErr := getAdminOrganization(ctx, id)
	if orgErr == nil {
		var stats TeamStats
		if row, err := q().GetOrgByID(ctx, id); err == nil {
			stats = TeamStats{
				RankingAverage:        nullFloatToPtr(row.RankingAverage),
				PointsAverage:         nullFloatToPtr(row.PointsAverage),
				SeasonRank:            nullInt32ToPtr(row.SeasonRank),
				AveragePointsPerEvent: nullFloatToPtr(row.AveragePointsPerEvent),
			}
		}
		return &Team{
			ID:                          orgDetail.ID,
			Name:                        orgDetail.Name,
			Slug:                        orgDetail.Slug,
			Logo:                        orgDetail.Logo,
			Status:                      orgDetail.Status,
			PrimaryOrganizationID:       orgDetail.ID,
			IsOrganization:              true,
			Organizations:               []LinkedOrganization{},
			Stats:                       stats,
			AdministratorSlotsRemaining: orgDetail.AdministratorSlotsRemaining,
			Members:                     orgDetail.Members,
		}, nil
	}
	return nil, orgErr
}

// --- HTTP endpoint (thin wrapper over the core above) ---

// UpdateTeamStatsRequest carries the team id, auth header, and stat values.
type UpdateTeamStatsRequest struct {
	ID                    string   `json:"id"`
	RankingAverage        *float64 `json:"rankingAverage,omitempty"`
	PointsAverage         *float64 `json:"pointsAverage,omitempty"`
	SeasonRank            *int32   `json:"seasonRank,omitempty"`
	AveragePointsPerEvent *float64 `json:"averagePointsPerEvent,omitempty"`
}

//encore:api auth method=PATCH path=/api/team-stats
func (s *Service) UpdateTeamStats(ctx context.Context, p *UpdateTeamStatsRequest) (*Team, error) {
	actor := encoreauth.Data().(*auth.Actor)
	return updateTeamStats(ctx, actor, p.ID, &TeamStatsUpdate{
		RankingAverage:        p.RankingAverage,
		PointsAverage:         p.PointsAverage,
		SeasonRank:            p.SeasonRank,
		AveragePointsPerEvent: p.AveragePointsPerEvent,
	})
}
