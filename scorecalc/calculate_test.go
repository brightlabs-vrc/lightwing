package scorecalc

import (
	"reflect"
	"testing"
)

// Test_calculateEventProjection covers the behavioral contract of
// ts-legacy/scorecalc/core/calculate.ts calculateEventProjection.
func Test_calculateEventProjection(t *testing.T) {
	t.Run("sums points per member", func(t *testing.T) {
		got := CalculateEventProjection(EventScoreInput{
			EventID: "e1",
			Members: []string{"u1", "u2"},
			RaceResults: []RaceResultInput{
				{UserID: "u1", Points: 10},
				{UserID: "u2", Points: 5},
				{UserID: "u1", Points: 3},
			},
		})
		want := ScoreCalcProjection{EventID: "e1", Entries: []ProjectionEntry{
			{UserID: "u1", Points: 13},
			{UserID: "u2", Points: 5},
		}}
		if !reflect.DeepEqual(got, want) {
			t.Errorf("got %+v, want %+v", got, want)
		}
	})

	t.Run("members without results start at zero", func(t *testing.T) {
		got := CalculateEventProjection(EventScoreInput{
			EventID: "e1",
			Members: []string{"u1", "u2"},
		})
		want := ScoreCalcProjection{EventID: "e1", Entries: []ProjectionEntry{
			{UserID: "u1", Points: 0},
			{UserID: "u2", Points: 0},
		}}
		if !reflect.DeepEqual(got, want) {
			t.Errorf("got %+v, want %+v", got, want)
		}
	})

	t.Run("entries sort by userId", func(t *testing.T) {
		got := CalculateEventProjection(EventScoreInput{
			EventID: "e1",
			Members: []string{"u2", "u1", "u10"},
		})
		var ids []string
		for _, e := range got.Entries {
			ids = append(ids, e.UserID)
		}
		want := []string{"u1", "u10", "u2"}
		if !reflect.DeepEqual(ids, want) {
			t.Errorf("order = %v, want %v", ids, want)
		}
	})

	t.Run("empty input yields empty entries", func(t *testing.T) {
		got := CalculateEventProjection(EventScoreInput{EventID: "e1"})
		if len(got.Entries) != 0 {
			t.Errorf("entries = %+v, want empty", got.Entries)
		}
	})
}

// Test_computeChecksum locks the sha256-of-canonical-JSON contract so Go and
// TS workers produce identical checksums. Vectors verified with sha256sum.
func Test_computeChecksum(t *testing.T) {
	t.Run("golden vector", func(t *testing.T) {
		entries := []ProjectionEntry{
			{UserID: "u1", Points: 10},
			{UserID: "u2", Points: 5},
		}
		want := "41446a922f0a2d2a38bd0d6c7eab7e93d89ccf2098f519ebe695584113423a58"
		if got := ComputeChecksum(entries); got != want {
			t.Errorf("checksum = %s, want %s", got, want)
		}
	})

	t.Run("empty entries checksum", func(t *testing.T) {
		want := "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"
		if got := ComputeChecksum([]ProjectionEntry{}); got != want {
			t.Errorf("checksum = %s, want %s", got, want)
		}
	})

	t.Run("checksum changes with content", func(t *testing.T) {
		a := ComputeChecksum([]ProjectionEntry{{UserID: "u1", Points: 10}})
		b := ComputeChecksum([]ProjectionEntry{{UserID: "u1", Points: 11}})
		if a == b {
			t.Errorf("checksums should differ")
		}
		if len(a) != 64 {
			t.Errorf("checksum length = %d, want 64", len(a))
		}
	})
}
