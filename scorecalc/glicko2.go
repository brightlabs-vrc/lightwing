package scorecalc

import (
	"context"
	"fmt"
	"sync"
	"time"

	"encore.app/auth"
	"encore.app/scorecalc/glicko2"
	"encore.app/scorecalc/sqlc"
	encoreauth "encore.dev/beta/auth"
	"encore.dev/beta/errs"
	"encore.dev/rlog"
)

// Re-export Glicko-2 types for callers within scorecalc.
type (
	ChronologicalRaceResult  = glicko2.ChronologicalRaceResult
	UserSeasonRatingSnapshot = glicko2.UserSeasonRatingSnapshot
	RaceResultRatingDelta    = glicko2.RaceResultRatingDelta
	Glicko2HistoryResult     = glicko2.HistoryResult
)

// ComputeGlicko2History replays all race results chronologically using the Glicko-2 engine.
func ComputeGlicko2History(results []ChronologicalRaceResult) Glicko2HistoryResult {
	return glicko2.ComputeHistory(results)
}

// --- Persistence, Automatic Backfill, and Admin Trigger ---

// RecalculateRatingsResponse reports the outcome of a full Glicko-2 historical recalculation.
type RecalculateRatingsResponse struct {
	RacesProcessed int    `json:"racesProcessed"`
	ResultsUpdated int    `json:"resultsUpdated"`
	UsersRated     int    `json:"usersRated"`
	YearsProcessed []int  `json:"yearsProcessed"`
	CalculatedAt   string `json:"calculatedAt"`
}

var ratingsRecalcMu sync.Mutex

// EnsureRatingsBackfilled performs an automatic one-time historical backfill if
// user_rating_snapshot is empty while race_result has rows (e.g. first run on an
// existing production database).
func EnsureRatingsBackfilled(ctx context.Context) error {
	snapCount, err := q().CountUserRatingSnapshots(ctx)
	if err != nil {
		return err
	}
	if snapCount > 0 {
		return nil
	}
	resultCount, err := q().CountRaceResults(ctx)
	if err != nil {
		return err
	}
	if resultCount == 0 {
		return nil
	}

	rlog.Info("Detected unpopulated user_rating_snapshot table with existing race results; running automatic Glicko-2 backfill", "raceResults", resultCount)
	_, err = RecalculateAllRatings(ctx)
	return err
}

// RecalculateAllRatings replays all chronological race results across all years,
// persists user_rating_snapshot and race_result rating deltas in a single transaction,
// and invalidates the leaderboard cache.
func RecalculateAllRatings(ctx context.Context) (*RecalculateRatingsResponse, error) {
	ratingsRecalcMu.Lock()
	defer ratingsRecalcMu.Unlock()

	rows, err := q().ListAllChronologicalRaceResults(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list chronological race results: %w", err)
	}

	inputs := make([]ChronologicalRaceResult, 0, len(rows))
	for _, r := range rows {
		var pos *int
		if r.Position.Valid {
			p := int(r.Position.Int32)
			pos = &p
		}
		var status *string
		if r.ResultStatus.Valid && r.ResultStatus.String != "" {
			s := r.ResultStatus.String
			status = &s
		}
		inputs = append(inputs, ChronologicalRaceResult{
			ResultID:     r.ResultID,
			RaceEventID:  r.RaceEventID,
			EventID:      r.EventID,
			RaceSequence: int(r.RaceSequence),
			OccurredAt:   r.OccurredAt,
			EventYear:    int(r.EventYear),
			UserID:       r.UserID,
			Position:     pos,
			ResultStatus: status,
		})
	}

	history := ComputeGlicko2History(inputs)
	now := time.Now().UTC()

	stx, err := std().BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin ratings transaction: %w", err)
	}
	defer stx.Rollback()
	qq := q().WithTx(stx)

	if err := qq.ClearUserRatingSnapshots(ctx); err != nil {
		return nil, fmt.Errorf("failed to clear user rating snapshots: %w", err)
	}

	if len(history.Snapshots) > 0 {
		n := len(history.Snapshots)
		params := sqlc.BatchUpsertUserRatingSnapshotsParams{
			UserIds:            make([]string, n),
			Years:              make([]int32, n),
			Ratings:            make([]int32, n),
			RatingDeviations:   make([]int32, n),
			RatingVolatilities: make([]float64, n),
			PeakRatings:        make([]int32, n),
			SeasonRatingDeltas: make([]int32, n),
			RatedRaces:         make([]int32, n),
			IsProvisionals:     make([]bool, n),
			UpdatedAt:          now,
		}
		for i, snap := range history.Snapshots {
			params.UserIds[i] = snap.UserID
			params.Years[i] = int32(snap.Year)
			params.Ratings[i] = int32(snap.Rating)
			params.RatingDeviations[i] = int32(snap.RatingDeviation)
			params.RatingVolatilities[i] = snap.RatingVolatility
			params.PeakRatings[i] = int32(snap.PeakRating)
			params.SeasonRatingDeltas[i] = int32(snap.SeasonRatingDelta)
			params.RatedRaces[i] = int32(snap.RatedRaces)
			params.IsProvisionals[i] = snap.IsProvisional
		}
		if err := qq.BatchUpsertUserRatingSnapshots(ctx, params); err != nil {
			return nil, fmt.Errorf("failed to batch upsert user rating snapshots: %w", err)
		}
	}

	if err := qq.ClearRaceResultRatings(ctx); err != nil {
		return nil, fmt.Errorf("failed to clear race result ratings: %w", err)
	}

	if len(history.ResultDeltas) > 0 {
		m := len(history.ResultDeltas)
		dParams := sqlc.BatchUpdateRaceResultRatingsParams{
			ResultIds:     make([]string, m),
			RatingBefores: make([]int32, m),
			RatingAfters:  make([]int32, m),
			RatingDeltas:  make([]int32, m),
			RdAfters:      make([]int32, m),
		}
		for i, d := range history.ResultDeltas {
			dParams.ResultIds[i] = d.ResultID
			dParams.RatingBefores[i] = int32(d.RatingBefore)
			dParams.RatingAfters[i] = int32(d.RatingAfter)
			dParams.RatingDeltas[i] = int32(d.RatingDelta)
			dParams.RdAfters[i] = int32(d.RDAfter)
		}
		if err := qq.BatchUpdateRaceResultRatings(ctx, dParams); err != nil {
			return nil, fmt.Errorf("failed to batch update race result ratings: %w", err)
		}
	}

	if err := stx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit ratings recalculation: %w", err)
	}

	InvalidateLeaderboardCache(ctx)
	rlog.Info("Completed Glicko-2 ratings recalculation",
		"racesProcessed", history.RacesProcessed,
		"resultsUpdated", len(history.ResultDeltas),
		"usersRated", history.UsersRated,
	)

	years := history.YearsProcessed
	if years == nil {
		years = []int{}
	}
	return &RecalculateRatingsResponse{
		RacesProcessed: history.RacesProcessed,
		ResultsUpdated: len(history.ResultDeltas),
		UsersRated:     history.UsersRated,
		YearsProcessed: years,
		CalculatedAt:   now.Format(time.RFC3339),
	}, nil
}

// RecalculateRatings allows a SITE_ADMIN to manually trigger a full historical
// Glicko-2 backfill and recalculation across all races.
//
//encore:api auth method=POST path=/api/admin/ratings/recalculate
func RecalculateRatings(ctx context.Context) (*RecalculateRatingsResponse, error) {
	actor, ok := encoreauth.Data().(*auth.Actor)
	if !ok || actor == nil {
		return nil, &errs.Error{Code: errs.Unauthenticated, Message: "authentication required"}
	}
	if _, err := auth.RequireSiteAdmin(actor); err != nil {
		return nil, err
	}
	return RecalculateAllRatings(ctx)
}
