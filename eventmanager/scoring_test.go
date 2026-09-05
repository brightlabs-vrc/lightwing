package eventmanager

import (
	"strconv"
	"testing"
)

func intptr(n int) *int { return &n }

func validCustomTables() map[string]any {
	grid := func(vals ...int) map[string]any {
		m := map[string]any{}
		for i, p := range vals {
			m[strconv.Itoa(i+1)] = p
		}
		return m
	}
	return map[string]any{
		"OP":   grid(10, 9, 8, 7, 6, 5, 4, 3, 2, 1),
		"GIII": grid(15, 12, 10, 8, 5, 6, 5, 4, 3, 2),
		"GII":  grid(20, 15, 12, 9, 5, 6, 5, 3, 2, 1),
		"GI":   grid(30, 25, 20, 15, 10, 8, 7, 6, 4, 2),
	}
}

// Test_scoringResolvers mirrors the "Resolver logic (scoring.ts)" block of
// ts-legacy/eventmanager/scoring.test.ts.
func Test_scoringResolvers(t *testing.T) {
	t.Run("getDefaultScoringTables returns correct standard tables", func(t *testing.T) {
		tables := DefaultScoringTables()
		if tables[RaceGradeGI].Points[1] != 25 {
			t.Errorf("GI[1] = %d, want 25", tables[RaceGradeGI].Points[1])
		}
		if tables[RaceGradeGII].Points[1] != 19 {
			t.Errorf("GII[1] = %d, want 19", tables[RaceGradeGII].Points[1])
		}
		if tables[RaceGradeGIII].Points[1] != 15 {
			t.Errorf("GIII[1] = %d, want 15", tables[RaceGradeGIII].Points[1])
		}
		if tables[RaceGradeOP].Points[1] != 12 {
			t.Errorf("OP[1] = %d, want 12", tables[RaceGradeOP].Points[1])
		}
		if tables[RaceGradeGI].Points[10] != 1 {
			t.Errorf("GI[10] = %d, want 1", tables[RaceGradeGI].Points[10])
		}
	})

	t.Run("default tables are fresh copies", func(t *testing.T) {
		a := DefaultScoringTables()
		a[RaceGradeGI].Points[1] = 999
		if b := DefaultScoringTables(); b[RaceGradeGI].Points[1] != 25 {
			t.Errorf("tables share state: GI[1] = %d", b[RaceGradeGI].Points[1])
		}
	})

	t.Run("validateCustomScoringTables accepts 4x10 integer grids", func(t *testing.T) {
		result, err := ValidateCustomScoringTables(validCustomTables())
		if err != nil {
			t.Fatalf("validate failed: %v", err)
		}
		if result[RaceGradeGI].Points[1] != 30 {
			t.Errorf("GI[1] = %d, want 30", result[RaceGradeGI].Points[1])
		}
		if result[RaceGradeOP].Points[1] != 10 {
			t.Errorf("OP[1] = %d, want 10", result[RaceGradeOP].Points[1])
		}
	})

	t.Run("validateCustomScoringTables rejects missing positions", func(t *testing.T) {
		bad := validCustomTables()
		delete(bad["OP"].(map[string]any), "10")
		if _, err := ValidateCustomScoringTables(bad); err == nil {
			t.Fatal("expected error for missing position")
		}
	})

	t.Run("validateCustomScoringTables rejects non-integers", func(t *testing.T) {
		bad := validCustomTables()
		bad["OP"].(map[string]any)["10"] = "not-int"
		if _, err := ValidateCustomScoringTables(bad); err == nil {
			t.Fatal("expected error for non-integer")
		}
	})

	t.Run("resolvePoints fallback constraints", func(t *testing.T) {
		cases := []struct {
			name   string
			grade  string
			pos    *int
			status string
			want   int
		}{
			{"position out of bounds high", "GI", intptr(11), "", 0},
			{"position zero", "GI", intptr(0), "", 0},
			{"position nil", "GI", nil, "", 0},
			{"missing grade", "", intptr(1), "", 0},
			{"unknown grade", "NOT_A_GRADE", intptr(1), "", 0},
			{"DSQ", "GI", intptr(1), "DSQ", 0},
			{"DNF", "GI", intptr(1), "DNF", 0},
			{"DNS", "GI", intptr(1), "DNS", 0},
			{"DSQ nil position", "GI", nil, "DSQ", 0},
			{"DNF nil position", "GI", nil, "DNF", 0},
			{"DNS nil position", "GI", nil, "DNS", 0},
			{"standard GI first", "GI", intptr(1), "", 25},
			{"standard GII first", "GII", intptr(1), "", 19},
		}
		for _, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				if got := ResolvePoints("STANDARD", nil, tc.grade, tc.pos, tc.status); got != tc.want {
					t.Errorf("ResolvePoints = %d, want %d", got, tc.want)
				}
			})
		}
	})

	t.Run("resolvePoints uses custom tables", func(t *testing.T) {
		custom := validCustomTables()
		if got := ResolvePoints("CUSTOM", custom, "GI", intptr(1), ""); got != 30 {
			t.Errorf("ResolvePoints custom GI first = %d, want 30", got)
		}
	})
}
