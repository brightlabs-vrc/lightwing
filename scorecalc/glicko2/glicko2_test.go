package glicko2

import (
	"math"
	"testing"
	"time"
)

func intPtr(v int) *int       { return &v }
func strPtr(v string) *string { return &v }

func TestComputeHistory_TwoPlayerStandardMatch(t *testing.T) {
	t0 := time.Date(2026, time.January, 10, 12, 0, 0, 0, time.UTC)
	results := []ChronologicalRaceResult{
		{ResultID: "r1-u1", RaceEventID: "race-1", EventID: "evt-1", RaceSequence: 1, OccurredAt: t0, EventYear: 2026, UserID: "u1", Position: intPtr(1)},
		{ResultID: "r1-u2", RaceEventID: "race-1", EventID: "evt-1", RaceSequence: 1, OccurredAt: t0, EventYear: 2026, UserID: "u2", Position: intPtr(2)},
	}

	hist := ComputeHistory(results)
	if hist.RacesProcessed != 1 {
		t.Fatalf("RacesProcessed = %d, want 1", hist.RacesProcessed)
	}
	if hist.UsersRated != 2 {
		t.Fatalf("UsersRated = %d, want 2", hist.UsersRated)
	}
	if len(hist.ResultDeltas) != 2 {
		t.Fatalf("len(ResultDeltas) = %d, want 2", len(hist.ResultDeltas))
	}

	snapByUser := map[string]UserSeasonRatingSnapshot{}
	for _, s := range hist.Snapshots {
		snapByUser[s.UserID] = s
	}

	u1 := snapByUser["u1"]
	u2 := snapByUser["u2"]

	if u1.Rating <= int(DefaultRating) {
		t.Errorf("winner u1 rating = %d, want > %d", u1.Rating, int(DefaultRating))
	}
	if u2.Rating >= int(DefaultRating) {
		t.Errorf("loser u2 rating = %d, want < %d", u2.Rating, int(DefaultRating))
	}
	if (u1.Rating - 1500) != (1500 - u2.Rating) {
		t.Errorf("asymmetric shift for equal ratings: u1=%d, u2=%d", u1.Rating, u2.Rating)
	}
	if u1.RatingDeviation >= int(DefaultRD) {
		t.Errorf("u1 RD = %d, expected decrease below %d", u1.RatingDeviation, int(DefaultRD))
	}
	if !u1.IsProvisional {
		t.Errorf("u1 after 1 race should be provisional")
	}
	if u1.PeakRating != u1.Rating {
		t.Errorf("u1 PeakRating = %d, want %d", u1.PeakRating, u1.Rating)
	}
	if u1.SeasonRatingDelta != u1.Rating-1500 {
		t.Errorf("u1 SeasonRatingDelta = %d, want %d", u1.SeasonRatingDelta, u1.Rating-1500)
	}
}

func TestComputeHistory_FieldSizeNormalization(t *testing.T) {
	t0 := time.Date(2026, time.February, 1, 12, 0, 0, 0, time.UTC)

	twoRunner := []ChronologicalRaceResult{
		{ResultID: "2p-1", RaceEventID: "race-2p", EventID: "e1", RaceSequence: 1, OccurredAt: t0, EventYear: 2026, UserID: "w2", Position: intPtr(1)},
		{ResultID: "2p-2", RaceEventID: "race-2p", EventID: "e1", RaceSequence: 1, OccurredAt: t0, EventYear: 2026, UserID: "l2", Position: intPtr(2)},
	}
	h2 := ComputeHistory(twoRunner)

	twelveRunner := make([]ChronologicalRaceResult, 12)
	for i := 0; i < 12; i++ {
		twelveRunner[i] = ChronologicalRaceResult{
			ResultID:     "12p-" + string(rune('a'+i)),
			RaceEventID:  "race-12p",
			EventID:      "e2",
			RaceSequence: 1,
			OccurredAt:   t0,
			EventYear:    2026,
			UserID:       "p" + string(rune('a'+i)),
			Position:     intPtr(i + 1),
		}
	}
	h12 := ComputeHistory(twelveRunner)

	var w2Rating, w12Rating, w12RD int
	for _, s := range h2.Snapshots {
		if s.UserID == "w2" {
			w2Rating = s.Rating
		}
	}
	for _, s := range h12.Snapshots {
		if s.UserID == "pa" {
			w12Rating = s.Rating
			w12RD = s.RatingDeviation
		}
	}

	if w12Rating <= w2Rating {
		t.Errorf("12-runner winner rating (%d) should exceed 2-runner winner rating (%d)", w12Rating, w2Rating)
	}
	if w12RD < 200 {
		t.Errorf("12-runner winner RD (%d) collapsed too aggressively in a single race", w12RD)
	}
}

func TestComputeHistory_SpecialStatuses(t *testing.T) {
	t0 := time.Date(2026, time.March, 1, 12, 0, 0, 0, time.UTC)
	results := []ChronologicalRaceResult{
		{ResultID: "r-p1", RaceEventID: "race-st", EventID: "e1", RaceSequence: 1, OccurredAt: t0, EventYear: 2026, UserID: "p1", Position: intPtr(1)},
		{ResultID: "r-p2", RaceEventID: "race-st", EventID: "e1", RaceSequence: 1, OccurredAt: t0, EventYear: 2026, UserID: "p2", Position: intPtr(2)},
		{ResultID: "r-dnf", RaceEventID: "race-st", EventID: "e1", RaceSequence: 1, OccurredAt: t0, EventYear: 2026, UserID: "dnf_u", Position: nil, ResultStatus: strPtr("DNF")},
		{ResultID: "r-dsq", RaceEventID: "race-st", EventID: "e1", RaceSequence: 1, OccurredAt: t0, EventYear: 2026, UserID: "dsq_u", Position: nil, ResultStatus: strPtr("DSQ")},
		{ResultID: "r-dns", RaceEventID: "race-st", EventID: "e1", RaceSequence: 1, OccurredAt: t0, EventYear: 2026, UserID: "dns_u", Position: nil, ResultStatus: strPtr("DNS")},
		{ResultID: "r-def", RaceEventID: "race-st", EventID: "e1", RaceSequence: 1, OccurredAt: t0, EventYear: 2026, UserID: "def_u", Position: nil, ResultStatus: strPtr("DEFERRED")},
	}

	hist := ComputeHistory(results)
	if hist.UsersRated != 4 {
		t.Fatalf("UsersRated = %d, want 4 (p1, p2, dnf_u, dsq_u)", hist.UsersRated)
	}

	snap := map[string]UserSeasonRatingSnapshot{}
	for _, s := range hist.Snapshots {
		snap[s.UserID] = s
	}

	if _, ok := snap["dns_u"]; ok {
		t.Errorf("DNS user should be excluded from rating calculation")
	}
	if _, ok := snap["def_u"]; ok {
		t.Errorf("DEFERRED user should be excluded from rating calculation")
	}
	if snap["dnf_u"].Rating != snap["dsq_u"].Rating {
		t.Errorf("DNF (%d) and DSQ (%d) should receive identical ratings when tied for last", snap["dnf_u"].Rating, snap["dsq_u"].Rating)
	}
	if snap["dnf_u"].Rating >= snap["p2"].Rating {
		t.Errorf("DNF (%d) should be rated below 2nd-place finisher p2 (%d)", snap["dnf_u"].Rating, snap["p2"].Rating)
	}
	if snap["p1"].Rating <= snap["p2"].Rating {
		t.Errorf("1st-place p1 (%d) should be rated above 2nd-place p2 (%d)", snap["p1"].Rating, snap["p2"].Rating)
	}
}

func TestComputeHistory_CrossSeasonCarryOverAndInactivityDecay(t *testing.T) {
	t2025 := time.Date(2025, time.June, 1, 12, 0, 0, 0, time.UTC)
	t2026 := time.Date(2026, time.June, 1, 12, 0, 0, 0, time.UTC)

	results := []ChronologicalRaceResult{
		{ResultID: "25-1-u1", RaceEventID: "r25-1", EventID: "e25", RaceSequence: 1, OccurredAt: t2025, EventYear: 2025, UserID: "u1", Position: intPtr(1)},
		{ResultID: "25-1-u2", RaceEventID: "r25-1", EventID: "e25", RaceSequence: 1, OccurredAt: t2025, EventYear: 2025, UserID: "u2", Position: intPtr(2)},
		{ResultID: "26-1-u2", RaceEventID: "r26-1", EventID: "e26", RaceSequence: 1, OccurredAt: t2026, EventYear: 2026, UserID: "u2", Position: intPtr(1)},
		{ResultID: "26-1-u1", RaceEventID: "r26-1", EventID: "e26", RaceSequence: 1, OccurredAt: t2026, EventYear: 2026, UserID: "u1", Position: intPtr(2)},
	}

	hist := ComputeHistory(results)

	var u1_2025, u1_2026, u2_2025, u2_2026 UserSeasonRatingSnapshot
	for _, s := range hist.Snapshots {
		switch {
		case s.UserID == "u1" && s.Year == 2025:
			u1_2025 = s
		case s.UserID == "u1" && s.Year == 2026:
			u1_2026 = s
		case s.UserID == "u2" && s.Year == 2025:
			u2_2025 = s
		case s.UserID == "u2" && s.Year == 2026:
			u2_2026 = s
		}
	}

	if u1_2026.SeasonRatingDelta != u1_2026.Rating-u1_2025.Rating {
		t.Errorf("u1 2026 SeasonRatingDelta = %d, want %d (carry-over from %d)", u1_2026.SeasonRatingDelta, u1_2026.Rating-u1_2025.Rating, u1_2025.Rating)
	}
	if u2_2026.SeasonRatingDelta != u2_2026.Rating-u2_2025.Rating {
		t.Errorf("u2 2026 SeasonRatingDelta = %d, want %d (carry-over from %d)", u2_2026.SeasonRatingDelta, u2_2026.Rating-u2_2025.Rating, u2_2025.Rating)
	}
	if u1_2026.PeakRating < u1_2025.Rating {
		t.Errorf("u1 2026 PeakRating = %d, should preserve 2025 peak %d", u1_2026.PeakRating, u1_2025.Rating)
	}

	decayed := ApplyInactivityDecay(0.5, 0.06, t2025, t2026, true)
	if decayed <= 0.5 || math.IsNaN(decayed) {
		t.Errorf("expected inactivity decay to increase phi above 0.5, got %f", decayed)
	}
}
