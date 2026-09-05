package eventmanager

import (
	"math"
)

// Ladder Elo constants.
//
// Mirrors ts-legacy/eventmanager/events.ts.
const (
	LadderStartingElo = 1200
	LadderKFactor     = 32
)

// EloResult holds post-match ratings.
type EloResult struct {
	WinnerElo int
	LoserElo  int
}

// jsRound mirrors JS Math.round (round half up): Go's math.Round rounds
// half away from zero, which differs for negative halves (e.g. -2.5 ->
// -2 in JS, -3 in Go). Elo loser deltas are negative, so this matters.
func jsRound(x float64) int {
	return int(math.Floor(x + 0.5))
}

// ComputeElo applies a K=32 Elo update to a winner/loser pair.
//
// Mirrors ts-legacy/eventmanager/events.ts computeElo.
func ComputeElo(winnerElo, loserElo int) EloResult {
	expectedWinner := 1 / (1 + math.Pow(10, float64(loserElo-winnerElo)/400))
	expectedLoser := 1 - expectedWinner
	return EloResult{
		WinnerElo: jsRound(float64(winnerElo) + LadderKFactor*(1-expectedWinner)),
		LoserElo:  jsRound(float64(loserElo) + LadderKFactor*(0-expectedLoser)),
	}
}
