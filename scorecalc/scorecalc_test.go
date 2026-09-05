package scorecalc

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"reflect"
	"testing"
	"time"

	"encore.dev/beta/errs"
	"encore.dev/et"
	"encore.app/shared"
)

func TestMain(m *testing.M) {
	ctx := context.Background()
	testDB, err := et.NewTestDatabase(ctx, "lightwing")
	if err == nil {
		shared.SetTestDB(testDB)
	}
	code := m.Run()
	os.Exit(code)
}

var scoreTestSeq int

func scoreSeq() string {
	scoreTestSeq++
	return fmt.Sprintf("s%d", scoreTestSeq)
}

// setupTestEvent seeds a points event with a member and two races.
// Mirrors the TS setupTestEvent helper.
func setupTestEvent(t *testing.T, ctx context.Context, scoringType int) (userID, eventID, raceID1, raceID2 string) {
	t.Helper()
	tag := scoreSeq() + newID()[:8]
	userID = "sc-user-" + tag
	eventID = "sc-event-" + tag
	raceID1 = "sc-race1-" + tag
	raceID2 = "sc-race2-" + tag
	now := time.Now().UTC().Format(time.RFC3339Nano)

	_, err := shared.DB.Exec(ctx,
		`INSERT INTO "user" (id, name, email, "siteRole", "createdAt", "updatedAt")
		 VALUES ($1, $2, $3, 'USER', $4, $4)`,
		userID, "Test User", userID+"@example.com", now,
	)
	if err != nil {
		t.Fatalf("failed to insert user: %v", err)
	}
	_, err = shared.DB.Exec(ctx,
		`INSERT INTO "event" (id, name, "ownerType", "ownerUserId", "scoringType", status, "createdAt", "updatedAt")
		 VALUES ($1, 'Test Points Event', 'USER', $2, $3, 'UNOFFICIAL', $4, $4)`,
		eventID, userID, scoringType, now,
	)
	if err != nil {
		t.Fatalf("failed to insert event: %v", err)
	}
	_, err = shared.DB.Exec(ctx,
		`INSERT INTO "event_member" (id, "eventId", "userId", "createdAt")
		 VALUES (gen_random_uuid()::text, $1, $2, $3)`,
		eventID, userID, now,
	)
	if err != nil {
		t.Fatalf("failed to insert member: %v", err)
	}
	for _, race := range []struct {
		id, name, track, loc string
		dist                int
	}{
		{raceID1, "Race 1", "Asphalt", "Track A", 1000},
		{raceID2, "Race 2", "Dirt", "Track B", 1200},
	} {
		_, err = shared.DB.Exec(ctx,
			`INSERT INTO "race_event" (id, "eventId", name, "distanceMeters", "trackType", location, "createdAt", "updatedAt")
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
			race.id, eventID, race.name, race.dist, race.track, race.loc, now,
		)
		if err != nil {
			t.Fatalf("failed to insert race: %v", err)
		}
	}
	return userID, eventID, raceID1, raceID2
}

func readJob(t *testing.T, ctx context.Context, jobID string) scoreCalcJobRow {
	t.Helper()
	var j scoreCalcJobRow
	err := shared.DB.QueryRow(ctx,
		`SELECT id, "eventId", generation, "requestedUserIds", status, attempts
		 FROM "score_calc_task" WHERE id = $1`, jobID,
	).Scan(&j.ID, &j.EventID, &j.Generation, &j.RequestedUserIDs, &j.Status, &j.Attempts)
	if err != nil {
		t.Fatalf("failed to read job: %v", err)
	}
	return j
}

// Test_submitCalc mirrors "submitting calculation creates a job..." and the
// non-points no-op case.
func Test_submitCalc(t *testing.T) {
	ctx := context.Background()

	t.Run("creates job and increments generation", func(t *testing.T) {
		userID, eventID, _, _ := setupTestEvent(t, ctx, 1)
		resp, err := SubmitCalc(ctx, &SubmitCalcParams{EventID: eventID, UserIDs: []string{userID}})
		if err != nil {
			t.Fatalf("SubmitCalc failed: %v", err)
		}
		if resp.JobID == "" {
			t.Errorf("empty jobId")
		}
		if resp.Generation != 1 {
			t.Errorf("generation = %d, want 1", resp.Generation)
		}

		job := readJob(t, ctx, resp.JobID)
		if job.Status != "PENDING" {
			t.Errorf("status = %q, want PENDING", job.Status)
		}
		if job.Generation != 1 {
			t.Errorf("job generation = %d, want 1", job.Generation)
		}
		var ids []string
		if err := json.Unmarshal(job.RequestedUserIDs, &ids); err != nil {
			t.Fatalf("failed to decode requestedUserIds: %v", err)
		}
		if !reflect.DeepEqual(ids, []string{userID}) {
			t.Errorf("requestedUserIds = %v, want [%s]", ids, userID)
		}

		var latest, accepted int
		if err := shared.DB.QueryRow(ctx,
			`SELECT "latestGeneration", "acceptedGeneration" FROM "score_calc_state" WHERE "eventId" = $1`, eventID,
		).Scan(&latest, &accepted); err != nil {
			t.Fatalf("failed to read state: %v", err)
		}
		if latest != 1 || accepted != 0 {
			t.Errorf("state = (%d, %d), want (1, 0)", latest, accepted)
		}
	})

	t.Run("rejects empty userIds", func(t *testing.T) {
		_, eventID, _, _ := setupTestEvent(t, ctx, 1)
		_, err := SubmitCalc(ctx, &SubmitCalcParams{EventID: eventID})
		if err == nil {
			t.Fatal("expected error")
		}
		if errs.Code(err) != errs.InvalidArgument {
			t.Errorf("code = %v, want invalid_argument", errs.Code(err))
		}
	})

	t.Run("rejects unknown event", func(t *testing.T) {
		_, err := SubmitCalc(ctx, &SubmitCalcParams{EventID: "sc-nope", UserIDs: []string{"u"}})
		if err == nil {
			t.Fatal("expected error")
		}
		if errs.Code(err) != errs.NotFound {
			t.Errorf("code = %v, want not_found", errs.Code(err))
		}
	})

	t.Run("non-points event is a no-op", func(t *testing.T) {
		userID, eventID, _, _ := setupTestEvent(t, ctx, 2)
		resp, err := SubmitCalc(ctx, &SubmitCalcParams{EventID: eventID, UserIDs: []string{userID}})
		if err != nil {
			t.Fatalf("SubmitCalc failed: %v", err)
		}
		if resp.JobID != "no-op" || resp.Generation != 0 {
			t.Errorf("got %+v, want no-op/0", resp)
		}
		var count int
		if err := shared.DB.QueryRow(ctx,
			`SELECT COUNT(*) FROM "score_calc_task" WHERE "eventId" = $1`, eventID,
		).Scan(&count); err != nil {
			t.Fatalf("failed to count jobs: %v", err)
		}
		if count != 0 {
			t.Errorf("jobs = %d, want 0", count)
		}
	})
}

// claimJob simulates the worker claim step (status -> PROCESSING) so the
// coordinator path is testable without the worker package (which would
// create an import cycle). The real claim logic is covered in
// scorecalcworker.
func claimJob(t *testing.T, ctx context.Context, jobID string) {
	t.Helper()
	now := time.Now().UTC().Format(time.RFC3339Nano)
	_, err := shared.DB.Exec(ctx,
		`UPDATE "score_calc_task" SET status = 'PROCESSING', attempts = 1, "startedAt" = $1 WHERE id = $2`,
		now, jobID,
	)
	if err != nil {
		t.Fatalf("failed to claim job: %v", err)
	}
}

// Test_completed mirrors the coordinator half of the e2e pipeline test.
func Test_completed(t *testing.T) {
	ctx := context.Background()
	userID, eventID, _, _ := setupTestEvent(t, ctx, 1)
	now := time.Now().UTC().Format(time.RFC3339Nano)

	sub, err := SubmitCalc(ctx, &SubmitCalcParams{EventID: eventID, UserIDs: []string{userID}})
	if err != nil {
		t.Fatalf("SubmitCalc failed: %v", err)
	}
	claimJob(t, ctx, sub.JobID)

	entries := []ProjectionEntry{{UserID: userID, Points: 40}}
	if err := HandleScoreCalcCompleted(ctx, ScoreCalcCompleted{
		Version: 1, JobID: sub.JobID, EventID: eventID, Generation: sub.Generation,
		ComputedAt: now,
		Result: ScoreCalcProjection{EventID: eventID, Entries: entries},
		ResultChecksum: ComputeChecksum(entries),
	}); err != nil {
		t.Fatalf("HandleScoreCalcCompleted failed: %v", err)
	}

	job := readJob(t, ctx, sub.JobID)
	if job.Status != "COMPLETED" {
		t.Errorf("status = %q, want COMPLETED", job.Status)
	}
	var checksum string
	var completedAt time.Time
	if err := shared.DB.QueryRow(ctx,
		`SELECT "resultChecksum", "completedAt" FROM "score_calc_task" WHERE id = $1`, sub.JobID,
	).Scan(&checksum, &completedAt); err != nil {
		t.Fatalf("failed to read job completion: %v", err)
	}
	if checksum != ComputeChecksum(entries) {
		t.Errorf("checksum mismatch")
	}
	if completedAt.IsZero() {
		t.Errorf("completedAt not set")
	}

	var points int
	if err := shared.DB.QueryRow(ctx,
		`SELECT points FROM "event_points_entry" WHERE "eventId" = $1 AND "userId" = $2`,
		eventID, userID,
	).Scan(&points); err != nil {
		t.Fatalf("failed to read points: %v", err)
	}
	if points != 40 {
		t.Errorf("points = %d, want 40", points)
	}

	var accepted int
	if err := shared.DB.QueryRow(ctx,
		`SELECT "acceptedGeneration" FROM "score_calc_state" WHERE "eventId" = $1`, eventID,
	).Scan(&accepted); err != nil {
		t.Fatalf("failed to read state: %v", err)
	}
	if accepted != sub.Generation {
		t.Errorf("accepted = %d, want %d", accepted, sub.Generation)
	}
}

// Test_handleFailed mirrors the failed-handler test.
func Test_handleFailed(t *testing.T) {
	ctx := context.Background()
	userID, eventID, _, _ := setupTestEvent(t, ctx, 1)
	now := time.Now().UTC().Format(time.RFC3339Nano)

	sub, err := SubmitCalc(ctx, &SubmitCalcParams{EventID: eventID, UserIDs: []string{userID}})
	if err != nil {
		t.Fatalf("SubmitCalc failed: %v", err)
	}
	if err := HandleScoreCalcFailed(ctx, ScoreCalcFailed{
		Version: 1, JobID: sub.JobID, EventID: eventID, Generation: sub.Generation,
		FailedAt: now, ErrorCode: "TEST_ERROR",
		ErrorMessage: "Something went wrong during computation", Retryable: false,
	}); err != nil {
		t.Fatalf("HandleScoreCalcFailed failed: %v", err)
	}

	var status, lastError string
	if err := shared.DB.QueryRow(ctx,
		`SELECT status, "lastError" FROM "score_calc_task" WHERE id = $1`, sub.JobID,
	).Scan(&status, &lastError); err != nil {
		t.Fatalf("failed to read job: %v", err)
	}
	if status != "FAILED" {
		t.Errorf("status = %q, want FAILED", status)
	}
	if lastError != "Something went wrong during computation" {
		t.Errorf("lastError = %q", lastError)
	}
}
