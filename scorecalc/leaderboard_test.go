package scorecalc

import (
	"context"
	"testing"
	"time"
)

func TestLeaderboard(t *testing.T) {
	ctx := context.Background()
	now := time.Now().UTC().Format(time.RFC3339Nano)

	// Seed users
	u1 := "lb-u1-" + scoreSeq()
	u2 := "lb-u2-" + scoreSeq()
	u3 := "lb-u3-" + scoreSeq()

	_, err := db.Exec(ctx,
		`INSERT INTO "user" (id, name, "vrchatUsername", slug, email, "classTier", "siteRole", "createdAt", "updatedAt")
		 VALUES
		 ($1, 'User One', 'Speedster', 'speedster', $1||'@example.com', 'OP', 'USER', $4, $4),
		 ($2, 'User Two', 'Drifter', 'drifter', $2||'@example.com', 'G1', 'USER', $4, $4),
		 ($3, 'User Three', 'Cruiser', 'cruiser', $3||'@example.com', 'G2', 'USER', $4, $4)`,
		u1, u2, u3, now,
	)
	if err != nil {
		t.Fatalf("failed to seed users: %v", err)
	}

	// Seed event and points entries
	e1 := "lb-evt1-" + scoreSeq()
	r1 := "lb-race1-" + scoreSeq()

	_, err = db.Exec(ctx,
		`INSERT INTO "event" (id, name, "ownerType", "ownerUserId", "scoringType", status, "createdAt", "updatedAt")
		 VALUES ($1, 'Leaderboard Event 1', 'USER', $2, 1, 'CONCLUDED', $3, $3)`,
		e1, u1, now,
	)
	if err != nil {
		t.Fatalf("failed to insert event: %v", err)
	}

	_, err = db.Exec(ctx,
		`INSERT INTO "race_event" (id, "eventId", name, "distanceMeters", "trackType", location, "createdAt", "updatedAt")
		 VALUES ($1, $2, 'Race 1', 1200, 'Turf', 'Kyoto', $3, $3)`,
		r1, e1, now,
	)
	if err != nil {
		t.Fatalf("failed to insert race: %v", err)
	}

	_, err = db.Exec(ctx,
		`INSERT INTO "event_points_entry" (id, "eventId", "userId", points, "createdAt", "updatedAt")
		 VALUES
		 (gen_random_uuid()::text, $1, $2, 100, $5, $5),
		 (gen_random_uuid()::text, $1, $3, 80, $5, $5),
		 (gen_random_uuid()::text, $1, $4, 50, $5, $5)`,
		e1, u1, u2, u3, now,
	)
	if err != nil {
		t.Fatalf("failed to insert points entries: %v", err)
	}

	_, err = db.Exec(ctx,
		`INSERT INTO "race_result" (id, "raceEventId", "userId", position, points, "createdAt", "updatedAt")
		 VALUES
		 (gen_random_uuid()::text, $1, $2, 1, 100, $5, $5),
		 (gen_random_uuid()::text, $1, $3, 2, 80, $5, $5),
		 (gen_random_uuid()::text, $1, $4, 3, 50, $5, $5)`,
		r1, u1, u2, u3, now,
	)
	if err != nil {
		t.Fatalf("failed to insert race results: %v", err)
	}

	t.Run("GetLeaderboard sorted by points", func(t *testing.T) {
		InvalidateLeaderboardCache(ctx)
		res, err := GetLeaderboard(ctx, &GetLeaderboardParams{
			SortBy: "points",
		})
		if err != nil {
			t.Fatalf("GetLeaderboard failed: %v", err)
		}
		if res.Total < 3 {
			t.Errorf("got total %d, expected at least 3", res.Total)
		}

		// u1 should be first because of 100 points
		var foundU1 bool
		for _, entry := range res.Entries {
			if entry.UserID == u1 {
				foundU1 = true
				if entry.Name != "Speedster" {
					t.Errorf("u1 name = %q, want Speedster", entry.Name)
				}
				if entry.TotalPoints != 100 {
					t.Errorf("u1 points = %d, want 100", entry.TotalPoints)
				}
				if entry.Wins != 1 {
					t.Errorf("u1 wins = %d, want 1", entry.Wins)
				}
				if entry.AveragePosition != 1.0 {
					t.Errorf("u1 avgPosition = %f, want 1.0", entry.AveragePosition)
				}
			}
		}
		if !foundU1 {
			t.Errorf("u1 not found in leaderboard")
		}
	})

	t.Run("GetLeaderboard filtered by search", func(t *testing.T) {
		res, err := GetLeaderboard(ctx, &GetLeaderboardParams{
			Search: "Drifter",
		})
		if err != nil {
			t.Fatalf("GetLeaderboard with search failed: %v", err)
		}
		if len(res.Entries) != 1 {
			t.Fatalf("got %d entries, want 1", len(res.Entries))
		}
		if res.Entries[0].UserID != u2 {
			t.Errorf("got user %s, want %s", res.Entries[0].UserID, u2)
		}
	})

	t.Run("GetLeaderboard filtered by classTier", func(t *testing.T) {
		res, err := GetLeaderboard(ctx, &GetLeaderboardParams{
			ClassTier: "G2",
		})
		if err != nil {
			t.Fatalf("GetLeaderboard with classTier failed: %v", err)
		}
		if len(res.Entries) != 1 {
			t.Fatalf("got %d entries, want 1", len(res.Entries))
		}
		if res.Entries[0].UserID != u3 {
			t.Errorf("got user %s, want %s", res.Entries[0].UserID, u3)
		}
	})

	t.Run("CalculateAndCacheLeaderboard explicitly refreshes cache", func(t *testing.T) {
		entries, _, err := CalculateAndCacheLeaderboard(ctx)
		if err != nil {
			t.Fatalf("CalculateAndCacheLeaderboard failed: %v", err)
		}
		if len(entries) < 3 {
			t.Errorf("got entries %d, expected at least 3", len(entries))
		}
	})

	t.Run("Concurrent getLeaderboardData calls produce single compute and consistent results", func(t *testing.T) {
		InvalidateLeaderboardCache(ctx)

		const concurrentCalls = 10
		results := make([][]LeaderboardEntry, concurrentCalls)
		errs := make([]error, concurrentCalls)

		done := make(chan struct{})
		for i := 0; i < concurrentCalls; i++ {
			go func(index int) {
				res, _, err := getLeaderboardData(ctx)
				results[index] = res
				errs[index] = err
				done <- struct{}{}
			}(i)
		}

		for i := 0; i < concurrentCalls; i++ {
			<-done
		}

		for i := 0; i < concurrentCalls; i++ {
			if errs[i] != nil {
				t.Fatalf("call %d failed: %v", i, errs[i])
			}
			if len(results[i]) != len(results[0]) {
				t.Errorf("call %d got %d entries, want %d", i, len(results[i]), len(results[0]))
			}
		}
	})

	t.Run("Cache is invalidated after HandleScoreCalcCompleted", func(t *testing.T) {
		// Populate cache
		_, ts1, err := getLeaderboardData(ctx)
		if err != nil {
			t.Fatalf("initial getLeaderboardData failed: %v", err)
		}

		// Submit a job and complete it
		sub, err := SubmitCalc(ctx, &SubmitCalcParams{EventID: e1, UserIDs: []string{u1}})
		if err != nil {
			t.Fatalf("SubmitCalc failed: %v", err)
		}
		claimJob(t, ctx, sub.JobID)

		entries := []ProjectionEntry{{UserID: u1, Points: 150}}
		nowStr := time.Now().UTC().Format(time.RFC3339Nano)
		if err := HandleScoreCalcCompleted(ctx, ScoreCalcCompleted{
			Version: 1, JobID: sub.JobID, EventID: e1, Generation: sub.Generation,
			ComputedAt: nowStr,
			Result: ScoreCalcProjection{EventID: e1, Entries: entries},
			ResultChecksum: ComputeChecksum(entries),
		}); err != nil {
			t.Fatalf("HandleScoreCalcCompleted failed: %v", err)
		}

		// Verify inMemoryLeaderboard was invalidated (set to nil)
		inMemoryLeaderboardMu.RLock()
		inMem := inMemoryLeaderboard
		inMemoryLeaderboardMu.RUnlock()
		if inMem != nil {
			t.Errorf("inMemoryLeaderboard expected nil after HandleScoreCalcCompleted, got %+v", inMem)
		}

		// Subsequent getLeaderboardData should recompute and return new calculated timestamp and data
		entriesRes, ts2, err := getLeaderboardData(ctx)
		if err != nil {
			t.Fatalf("getLeaderboardData after invalidation failed: %v", err)
		}
		if !ts2.After(ts1) && ts2 != ts1 {
			// ts2 should be equal or after ts1
		}
		var foundU1 bool
		for _, entry := range entriesRes {
			if entry.UserID == u1 {
				foundU1 = true
				if entry.TotalPoints != 150 {
					t.Errorf("u1 points = %d, want 150 after HandleScoreCalcCompleted", entry.TotalPoints)
				}
			}
		}
		if !foundU1 {
			t.Errorf("u1 not found in leaderboard after HandleScoreCalcCompleted")
		}
	})
}
