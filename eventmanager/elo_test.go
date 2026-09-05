package eventmanager

import "testing"

// Test_computeElo mirrors ts-legacy/eventmanager/elo.test.ts.
func Test_computeElo(t *testing.T) {
	cases := []struct {
		name       string
		winnerElo  int
		loserElo   int
		wantWinner int
		wantLoser  int
	}{
		{"equal ratings symmetric", 1200, 1200, 1216, 1184},
		{"higher rated winner gains less", 1600, 1200, 1603, 1197},
		{"underdog gains more", 1200, 1600, 1229, 1571},
		{"extreme gap max shift", 800, 2800, 832, 2768},
		{"extreme favorite no change", 2800, 800, 2800, 800},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := ComputeElo(tc.winnerElo, tc.loserElo)
			if got.WinnerElo != tc.wantWinner || got.LoserElo != tc.wantLoser {
				t.Errorf("ComputeElo(%d, %d) = %+v, want {%d %d}",
					tc.winnerElo, tc.loserElo, got, tc.wantWinner, tc.wantLoser)
			}
		})
	}

	t.Run("higher rated winner gain below K/2", func(t *testing.T) {
		got := ComputeElo(1600, 1200)
		if got.WinnerElo-1600 >= 16 {
			t.Errorf("gain = %d, want < 16", got.WinnerElo-1600)
		}
	})

	t.Run("underdog gain above K/2", func(t *testing.T) {
		got := ComputeElo(1200, 1600)
		if got.WinnerElo-1200 <= 16 {
			t.Errorf("gain = %d, want > 16", got.WinnerElo-1200)
		}
	})
}
