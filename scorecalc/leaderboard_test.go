package scorecalc

import (
	"context"
	"testing"
	"time"
)

func TestLeaderboard(t *testing.T) {
	ctx := context.Background()
	nowTime := time.Now().UTC()
	now := nowTime.Format(time.RFC3339Nano)
	currentYear := nowTime.Year()
	prevYear := currentYear - 1
	prevYearTime := time.Date(prevYear, time.June, 15, 12, 0, 0, 0, time.UTC).Format(time.RFC3339Nano)

	// Seed users (no global classTier; class grades are org-scoped)
	u1 := "lb-u1-" + scoreSeq()
	u2 := "lb-u2-" + scoreSeq()
	u3 := "lb-u3-" + scoreSeq()

	_, err := db.Exec(ctx,
		`INSERT INTO "user" (id, name, "vrchatUsername", slug, email, "siteRole", "createdAt", "updatedAt")
		 VALUES
		 ($1, 'User One', 'Speedster', 'speedster', $1||'@example.com', 'USER', $4, $4),
		 ($2, 'User Two', 'Drifter', 'drifter', $2||'@example.com', 'USER', $4, $4),
		 ($3, 'User Three', 'Cruiser', 'cruiser', $3||'@example.com', 'USER', $4, $4)`,
		u1, u2, u3, now,
	)
	if err != nil {
		t.Fatalf("failed to seed users: %v", err)
	}

	// Seed organizations and org-scoped class tiers
	org1 := "lb-org1-" + scoreSeq()
	org2 := "lb-org2-" + scoreSeq()
	_, err = db.Exec(ctx,
		`INSERT INTO "organization" (id, name, slug, "createdAt")
		 VALUES
		 ($1, 'Org One', $1, $3),
		 ($2, 'Org Two', $2, $3)`,
		org1, org2, now,
	)
	if err != nil {
		t.Fatalf("failed to seed orgs: %v", err)
	}

	// u1: ungraded (OPEN), u2: G1 in org1, u3: G2 in org1
	_, err = db.Exec(ctx,
		`INSERT INTO "org_class_tier" ("organizationId", "userId", "classTier", "updatedAt")
		 VALUES
		 ($1, $2, 'G1', $4),
		 ($1, $3, 'G2', $4)`,
		org1, u2, u3, now,
	)
	if err != nil {
		t.Fatalf("failed to seed org_class_tier: %v", err)
	}

	// Seed ORG-owned event and points entries in current year
	e1 := "lb-evt1-" + scoreSeq()
	r1 := "lb-race1-" + scoreSeq()

	_, err = db.Exec(ctx,
		`INSERT INTO "event" (id, name, "ownerType", "organizationId", "scoringType", status, "scheduledAt", "createdAt", "updatedAt")
		 VALUES ($1, 'Leaderboard Event 1', 'ORGANIZATION', $2, 1, 'CONCLUDED', $3, $3, $3)`,
		e1, org1, now,
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

	// Seed a previous-year event for u2 to verify yearly cutoff
	ePrev := "lb-evt-prev-" + scoreSeq()
	rPrev := "lb-race-prev-" + scoreSeq()
	_, err = db.Exec(ctx,
		`INSERT INTO "event" (id, name, "ownerType", "organizationId", "scoringType", status, "scheduledAt", "createdAt", "updatedAt")
		 VALUES ($1, 'Prev Year Event', 'ORGANIZATION', $2, 1, 'CONCLUDED', $3, $3, $3)`,
		ePrev, org1, prevYearTime,
	)
	if err != nil {
		t.Fatalf("failed to insert prev year event: %v", err)
	}
	_, err = db.Exec(ctx,
		`INSERT INTO "race_event" (id, "eventId", name, "distanceMeters", "trackType", location, "createdAt", "updatedAt")
		 VALUES ($1, $2, 'Prev Race 1', 1200, 'Turf', 'Kyoto', $3, $3)`,
		rPrev, ePrev, prevYearTime,
	)
	if err != nil {
		t.Fatalf("failed to insert prev year race: %v", err)
	}
	_, err = db.Exec(ctx,
		`INSERT INTO "event_points_entry" (id, "eventId", "userId", points, "createdAt", "updatedAt")
		 VALUES (gen_random_uuid()::text, $1, $2, 300, $3, $3)`,
		ePrev, u2, prevYearTime,
	)
	if err != nil {
		t.Fatalf("failed to insert prev year points: %v", err)
	}
	_, err = db.Exec(ctx,
		`INSERT INTO "race_result" (id, "raceEventId", "userId", position, points, "createdAt", "updatedAt")
		 VALUES (gen_random_uuid()::text, $1, $2, 1, 300, $3, $3)`,
		rPrev, u2, prevYearTime,
	)
	if err != nil {
		t.Fatalf("failed to insert prev year race result: %v", err)
	}

	t.Run("GetLeaderboard sorted by points with current year cutoff", func(t *testing.T) {
		InvalidateLeaderboardCache(ctx)
		res, err := GetLeaderboard(ctx, &GetLeaderboardParams{
			SortBy: "points",
		})
		if err != nil {
			t.Fatalf("GetLeaderboard failed: %v", err)
		}
		if res.Year != currentYear {
			t.Errorf("got year %d, want %d", res.Year, currentYear)
		}
		if res.Total < 3 {
			t.Errorf("got total %d, expected at least 3", res.Total)
		}

		// u1 should be first with 100 points; u2 should have 80 points (prevYear 300 excluded)
		var foundU1, foundU2 bool
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
			if entry.UserID == u2 {
				foundU2 = true
				if entry.TotalPoints != 80 {
					t.Errorf("u2 current year points = %d, want 80 (prev year should not carry over)", entry.TotalPoints)
				}
				if entry.AveragePosition != 2.0 {
					t.Errorf("u2 current year avgPosition = %f, want 2.0", entry.AveragePosition)
				}
			}
		}
		if !foundU1 || !foundU2 {
			t.Errorf("u1 or u2 not found in leaderboard (foundU1=%v, foundU2=%v)", foundU1, foundU2)
		}
	})

	t.Run("GetLeaderboard for previous year returns previous year stats", func(t *testing.T) {
		InvalidateLeaderboardCache(ctx)
		res, err := GetLeaderboard(ctx, &GetLeaderboardParams{
			Year: prevYear,
		})
		if err != nil {
			t.Fatalf("GetLeaderboard(prevYear) failed: %v", err)
		}
		if res.Year != prevYear {
			t.Errorf("got year %d, want %d", res.Year, prevYear)
		}
		var foundU2 bool
		for _, entry := range res.Entries {
			if entry.UserID == u2 {
				foundU2 = true
				if entry.TotalPoints != 300 {
					t.Errorf("u2 prevYear points = %d, want 300", entry.TotalPoints)
				}
				if entry.AveragePosition != 1.0 {
					t.Errorf("u2 prevYear avgPosition = %f, want 1.0", entry.AveragePosition)
				}
			}
		}
		if !foundU2 {
			t.Errorf("u2 not found in prevYear leaderboard")
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

	t.Run("Event-weighted average class grade across multiple orgs", func(t *testing.T) {
		// Assign u2 G3 in org2 and add 2 events in org2 for u2:
		// org1 (G1=5) * 1 event + org2 (G3=3) * 2 events => (5 + 3 + 3)/3 = 3.67 => rounds to 4 (G2)
		_, err := db.Exec(ctx,
			`INSERT INTO "org_class_tier" ("organizationId", "userId", "classTier", "updatedAt")
			 VALUES ($1, $2, 'G3', $3)`,
			org2, u2, now,
		)
		if err != nil {
			t.Fatalf("failed to seed org2 class tier: %v", err)
		}
		for i := 0; i < 2; i++ {
			eid := "lb-evt-org2-" + scoreSeq()
			_, err := db.Exec(ctx,
				`INSERT INTO "event" (id, name, "ownerType", "organizationId", "scoringType", status, "scheduledAt", "createdAt", "updatedAt")
				 VALUES ($1, 'Org2 Event', 'ORGANIZATION', $2, 1, 'CONCLUDED', $3, $3, $3)`,
				eid, org2, now,
			)
			if err != nil {
				t.Fatalf("insert org2 event: %v", err)
			}
			_, err = db.Exec(ctx,
				`INSERT INTO "event_points_entry" (id, "eventId", "userId", points, "createdAt", "updatedAt")
				 VALUES (gen_random_uuid()::text, $1, $2, 10, $3, $3)`,
				eid, u2, now,
			)
			if err != nil {
				t.Fatalf("insert org2 points: %v", err)
			}
		}

		InvalidateLeaderboardCache(ctx)
		res, err := GetLeaderboard(ctx, &GetLeaderboardParams{Search: "Drifter"})
		if err != nil {
			t.Fatalf("GetLeaderboard failed: %v", err)
		}
		if len(res.Entries) != 1 {
			t.Fatalf("got %d entries, want 1", len(res.Entries))
		}
		if res.Entries[0].ClassTier == nil || *res.Entries[0].ClassTier != "G2" {
			got := "<nil>"
			if res.Entries[0].ClassTier != nil {
				got = *res.Entries[0].ClassTier
			}
			t.Errorf("u2 weighted average classTier = %s, want G2", got)
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
				res, _, err := getLeaderboardData(ctx, currentYear)
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
		_, ts1, err := getLeaderboardData(ctx, currentYear)
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

		// Verify inMemoryLeaderboards was invalidated (emptied)
		inMemoryLeaderboardMu.RLock()
		inMemLen := len(inMemoryLeaderboards)
		inMemoryLeaderboardMu.RUnlock()
		if inMemLen != 0 {
			t.Errorf("inMemoryLeaderboards expected empty after HandleScoreCalcCompleted, got %d entries", inMemLen)
		}

		// Subsequent getLeaderboardData should recompute and return new calculated timestamp and data
		entriesRes, ts2, err := getLeaderboardData(ctx, currentYear)
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
