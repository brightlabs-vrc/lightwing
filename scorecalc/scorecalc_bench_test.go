package scorecalc

import (
	"context"
	"fmt"
	"testing"
	"time"

	"encore.app/scorecalc/sqlc"
)

func BenchmarkUpsertPointsEntries(b *testing.B) {
	ctx := context.Background()

	sizes := []int{10, 50, 100, 500}

	for _, size := range sizes {
		b.Run(fmt.Sprintf("Individual_N%d", size), func(b *testing.B) {
			userID, eventID, _, _ := setupTestEventForBench(b, ctx, 1)
			_ = userID
			entries := make([]ProjectionEntry, size)
			for i := 0; i < size; i++ {
				uID := fmt.Sprintf("bench-u-%d-%s", i, newID()[:8])
				_, err := db.Exec(ctx,
					`INSERT INTO "user" (id, name, email, "siteRole", "createdAt", "updatedAt")
					 VALUES ($1, $2, $3, 'USER', NOW(), NOW()) ON CONFLICT DO NOTHING`,
					uID, "Bench User", uID+"@example.com",
				)
				if err != nil {
					b.Fatalf("failed to insert user: %v", err)
				}
				entries[i] = ProjectionEntry{UserID: uID, Points: i * 5}
			}

			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				stx, err := std().BeginTx(ctx, nil)
				if err != nil {
					b.Fatalf("failed to begin tx: %v", err)
				}
				qq := q().WithTx(stx)
				now := time.Now().UTC()

				for _, entry := range entries {
					if err := qq.UpsertPointsEntry(ctx, sqlc.UpsertPointsEntryParams{
						ID:        newID(),
						EventId:   eventID,
						UserId:    entry.UserID,
						Points:    int32(entry.Points),
						CreatedAt: now,
					}); err != nil {
						stx.Rollback()
						b.Fatalf("upsert failed: %v", err)
					}
				}
				if err := stx.Commit(); err != nil {
					b.Fatalf("commit failed: %v", err)
				}
			}
		})

		b.Run(fmt.Sprintf("Batch_N%d", size), func(b *testing.B) {
			userID, eventID, _, _ := setupTestEventForBench(b, ctx, 1)
			_ = userID
			entries := make([]ProjectionEntry, size)
			ids := make([]string, size)
			userIDs := make([]string, size)
			points := make([]int32, size)

			for i := 0; i < size; i++ {
				uID := fmt.Sprintf("bench-u-%d-%s", i, newID()[:8])
				_, err := db.Exec(ctx,
					`INSERT INTO "user" (id, name, email, "siteRole", "createdAt", "updatedAt")
					 VALUES ($1, $2, $3, 'USER', NOW(), NOW()) ON CONFLICT DO NOTHING`,
					uID, "Bench User", uID+"@example.com",
				)
				if err != nil {
					b.Fatalf("failed to insert user: %v", err)
				}
				entries[i] = ProjectionEntry{UserID: uID, Points: i * 5}
				ids[i] = newID()
				userIDs[i] = uID
				points[i] = int32(i * 5)
			}

			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				stx, err := std().BeginTx(ctx, nil)
				if err != nil {
					b.Fatalf("failed to begin tx: %v", err)
				}
				qq := q().WithTx(stx)
				now := time.Now().UTC()

				if err := qq.BatchUpsertPointsEntries(ctx, sqlc.BatchUpsertPointsEntriesParams{
					Ids:       ids,
					EventID:   eventID,
					UserIds:   userIDs,
					Points:    points,
					CreatedAt: now,
				}); err != nil {
					stx.Rollback()
					b.Fatalf("batch upsert failed: %v", err)
				}
				if err := stx.Commit(); err != nil {
					b.Fatalf("commit failed: %v", err)
				}
			}
		})
	}
}

func setupTestEventForBench(b *testing.B, ctx context.Context, scoringType int) (userID, eventID, raceID1, raceID2 string) {
	b.Helper()
	tag := scoreSeq() + newID()[:8]
	userID = "sc-user-" + tag
	eventID = "sc-event-" + tag
	raceID1 = "sc-race1-" + tag
	raceID2 = "sc-race2-" + tag
	now := time.Now().UTC().Format(time.RFC3339Nano)

	_, err := db.Exec(ctx,
		`INSERT INTO "user" (id, name, email, "siteRole", "createdAt", "updatedAt")
		 VALUES ($1, $2, $3, 'USER', $4, $4)`,
		userID, "Test User", userID+"@example.com", now,
	)
	if err != nil {
		b.Fatalf("failed to insert user: %v", err)
	}
	_, err = db.Exec(ctx,
		`INSERT INTO "event" (id, name, "ownerType", "ownerUserId", "scoringType", status, "createdAt", "updatedAt")
		 VALUES ($1, 'Test Points Event', 'USER', $2, $3, 'UNOFFICIAL', $4, $4)`,
		eventID, userID, scoringType, now,
	)
	if err != nil {
		b.Fatalf("failed to insert event: %v", err)
	}
	return userID, eventID, raceID1, raceID2
}
