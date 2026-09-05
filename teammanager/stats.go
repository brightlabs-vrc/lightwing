package teammanager

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"encore.dev/beta/errs"
	"encore.app/auth"
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

func updateTeamStats(ctx context.Context, authorization, id string, p *TeamStatsUpdate) (*Team, error) {
	if _, _, err := auth.RequirePermission(ctx, authorization, id, "organization", "update"); err != nil {
		return nil, err
	}
	var exists string
	if err := db.QueryRow(ctx,
		`SELECT id FROM "organization" WHERE id = $1`, id,
	).Scan(&exists); errors.Is(err, sql.ErrNoRows) {
		return nil, &errs.Error{Code: errs.NotFound, Message: "team not found"}
	} else if err != nil {
		return nil, err
	}
	set := []string{}
	args := []any{}
	if p.RankingAverage != nil {
		args = append(args, *p.RankingAverage)
		set = append(set, fmt.Sprintf(`"rankingAverage" = $%d`, len(args)))
	}
	if p.PointsAverage != nil {
		args = append(args, *p.PointsAverage)
		set = append(set, fmt.Sprintf(`"pointsAverage" = $%d`, len(args)))
	}
	if p.SeasonRank != nil {
		args = append(args, *p.SeasonRank)
		set = append(set, fmt.Sprintf(`"seasonRank" = $%d`, len(args)))
	}
	if p.AveragePointsPerEvent != nil {
		args = append(args, *p.AveragePointsPerEvent)
		set = append(set, fmt.Sprintf(`"averagePointsPerEvent" = $%d`, len(args)))
	}
	if len(set) > 0 {
		args = append(args, id)
		_, err := db.Exec(ctx,
			`UPDATE "organization" SET `+strings.Join(set, ", ")+fmt.Sprintf(` WHERE id = $%d`, len(args)),
			args...,
		)
		if err != nil {
			return nil, err
		}
		invalidateTeamCache(ctx, id)
	}
	return loadTeam(ctx, id)
}

// --- HTTP endpoint (thin wrapper over the core above) ---

// UpdateTeamStatsRequest carries the team id, auth header, and stat values.
type UpdateTeamStatsRequest struct {
	ID                    string   `json:"id"`
	Authorization         string   `header:"Authorization"`
	RankingAverage        *float64 `json:"rankingAverage,omitempty"`
	PointsAverage         *float64 `json:"pointsAverage,omitempty"`
	SeasonRank            *int32   `json:"seasonRank,omitempty"`
	AveragePointsPerEvent *float64 `json:"averagePointsPerEvent,omitempty"`
}

//encore:api public method=PATCH path=/api/team-stats
func (s *Service) UpdateTeamStats(ctx context.Context, p *UpdateTeamStatsRequest) (*Team, error) {
	return updateTeamStats(ctx, p.Authorization, p.ID, &TeamStatsUpdate{
		RankingAverage:        p.RankingAverage,
		PointsAverage:         p.PointsAverage,
		SeasonRank:            p.SeasonRank,
		AveragePointsPerEvent: p.AveragePointsPerEvent,
	})
}
