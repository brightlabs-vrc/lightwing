package scorecalc

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"sort"
)

// Race result input for projection calculation.
//
// Mirrors ts-legacy/scorecalc/core/calculate.ts.
type RaceResultInput struct {
	UserID string
	Points int
}

// EventScoreInput aggregates everything needed for one projection.
type EventScoreInput struct {
	EventID     string
	Members     []string // userIds of event members
	RaceResults []RaceResultInput
}

// ProjectionEntry is one leaderboard row. Field order and JSON names match
// the TS ScoreCalcProjection entries exactly, so checksums interoperate.
type ProjectionEntry struct {
	UserID string `json:"userId"`
	Points int    `json:"points"`
}

// ScoreCalcProjection is the computed leaderboard for an event.
type ScoreCalcProjection struct {
	EventID string            `json:"eventId"`
	Entries []ProjectionEntry `json:"entries"`
}

// CalculateEventProjection sums per-user points across race results.
// Members start at 0; results from non-members are included (mirroring the
// TS `?? 0` behavior). Entries sort by userId for determinism.
func CalculateEventProjection(input EventScoreInput) ScoreCalcProjection {
	points := map[string]int{}
	for _, userID := range input.Members {
		points[userID] = 0
	}
	for _, res := range input.RaceResults {
		points[res.UserID] += res.Points
	}
	userIDs := make([]string, 0, len(points))
	for userID := range points {
		userIDs = append(userIDs, userID)
	}
	sort.Strings(userIDs)
	entries := make([]ProjectionEntry, 0, len(userIDs))
	for _, userID := range userIDs {
		entries = append(entries, ProjectionEntry{UserID: userID, Points: points[userID]})
	}
	return ScoreCalcProjection{EventID: input.EventID, Entries: entries}
}

// ComputeChecksum hashes the canonical entries JSON (sha256 hex), mirroring
// TS computeChecksum byte-for-byte for ASCII payloads.
func ComputeChecksum(entries []ProjectionEntry) string {
	data, err := json.Marshal(entries)
	if err != nil {
		return ""
	}
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}
