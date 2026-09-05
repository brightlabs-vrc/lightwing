package scorecalcworker

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"encore.dev/et"
	"encore.app/scorecalc"
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

var workerTestSeq int

// setupWorkerEvent seeds a points event with a member, two races, and two
// race results (25 + 15 pts). Mirrors the TS setupTestEvent helper.
func setupWorkerEvent(t *testing.T, ctx context.Context) (userID, eventID, raceID1, raceID2 string) {
	t.Helper()
	workerTestSeq++
	tag := fmt.Sprintf("w%d", workerTestSeq)
	userID = "w-user-" + tag
	eventID = "w-event-" + tag
	raceID1 = "w-race1-" + tag
	raceID2 = "w-race2-" + tag
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
		 VALUES ($1, 'Test Points Event', 'USER', $2, 1, 'UNOFFICIAL', $3, $3)`,
		eventID, userID, now,
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
	races := []struct {
		id, name, track, loc string
		dist, points, pos    int
	}{
		{raceID1, "Race 1", "Asphalt", "Track A", 1000, 25, 1},
		{raceID2, "Race 2", "Dirt", "Track B", 1200, 15, 2},
	}
	for _, race := range races {
		_, err = shared.DB.Exec(ctx,
			`INSERT INTO "race_event" (id, "eventId", name, "distanceMeters", "trackType", location, "createdAt", "updatedAt")
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
			race.id, eventID, race.name, race.dist, race.track, race.loc, now,
		)
		if err != nil {
			t.Fatalf("failed to insert race: %v", err)
		}
		_, err = shared.DB.Exec(ctx,
			`INSERT INTO "race_result" (id, "raceEventId", "userId", points, position, "createdAt", "updatedAt")
			 VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $5)`,
			race.id, userID, race.points, race.pos, now,
		)
		if err != nil {
			t.Fatalf("failed to insert result: %v", err)
		}
	}
	return userID, eventID, raceID1, raceID2
}

func readWorkerJob(t *testing.T, ctx context.Context, jobID string) (status string, attempts int) {
	t.Helper()
	if err := shared.DB.QueryRow(ctx,
		`SELECT status, attempts FROM "score_calc_task" WHERE id = $1`, jobID,
	).Scan(&status, &attempts); err != nil {
		t.Fatalf("failed to read job: %v", err)
	}
	return status, attempts
}

// Test_claim mirrors the worker-claim half of the TS e2e test: handling a
// request claims the job exactly once. The status may already have advanced
// to COMPLETED if the coordinator subscription also processed the published
// completion, so both are accepted.
func Test_claim(t *testing.T) {
	ctx := context.Background()
	userID, eventID, _, _ := setupWorkerEvent(t, ctx)

	sub, err := scorecalc.SubmitCalc(ctx, &scorecalc.SubmitCalcParams{EventID: eventID, UserIDs: []string{userID}})
	if err != nil {
		t.Fatalf("SubmitCalc failed: %v", err)
	}
	if err := HandleScoreCalcRequest(ctx, scorecalc.ScoreCalcRequested{
		Version: 1, JobID: sub.JobID, EventID: eventID,
		Generation: sub.Generation, RequestedAt: time.Now().UTC().Format(time.RFC3339Nano),
	}); err != nil {
		t.Fatalf("HandleScoreCalcRequest failed: %v", err)
	}

	status, attempts := readWorkerJob(t, ctx, sub.JobID)
	if status != "PROCESSING" && status != "COMPLETED" {
		t.Errorf("status = %q, want PROCESSING or COMPLETED", status)
	}
	if attempts != 1 {
		t.Errorf("attempts = %d, want 1", attempts)
	}
}

// Test_workerPublishesCompletion verifies the worker computes the projection
// from canonical source data and publishes it, without involving the
// coordinator: the completed message must carry the 25 + 15 = 40 checksum.
func Test_workerPublishesCompletion(t *testing.T) {
	ctx := context.Background()
	userID, eventID, _, _ := setupWorkerEvent(t, ctx)

	sub, err := scorecalc.SubmitCalc(ctx, &scorecalc.SubmitCalcParams{EventID: eventID, UserIDs: []string{userID}})
	if err != nil {
		t.Fatalf("SubmitCalc failed: %v", err)
	}
	if err := HandleScoreCalcRequest(ctx, scorecalc.ScoreCalcRequested{
		Version: 1, JobID: sub.JobID, EventID: eventID,
		Generation: sub.Generation, RequestedAt: time.Now().UTC().Format(time.RFC3339Nano),
	}); err != nil {
		t.Fatalf("HandleScoreCalcRequest failed: %v", err)
	}

	var found *scorecalc.ScoreCalcCompleted
	for _, msg := range et.Topic(scorecalc.ScoreCalcCompletedTopic).PublishedMessages() {
		if msg.JobID == sub.JobID {
			msg := msg
			found = &msg
			break
		}
	}
	if found == nil {
		t.Fatalf("no completed message published for job %s", sub.JobID)
	}
	wantEntries := []scorecalc.ProjectionEntry{{UserID: userID, Points: 40}}
	if found.Result.EventID != eventID || len(found.Result.Entries) != 1 ||
		found.Result.Entries[0] != wantEntries[0] {
		t.Errorf("result = %+v, want 40 pts for %s", found.Result, userID)
	}
	if found.ResultChecksum != scorecalc.ComputeChecksum(wantEntries) {
		t.Errorf("checksum = %s, want projection checksum", found.ResultChecksum)
	}
}

// Test_generationFencing mirrors the TS stale-completion test: a delayed
// gen-1 completion is fenced out once gen 2 is latest; gen 2 then completes.
func Test_generationFencing(t *testing.T) {
	ctx := context.Background()
	userID, eventID, _, _ := setupWorkerEvent(t, ctx)
	now := time.Now().UTC().Format(time.RFC3339Nano)

	gen1, err := scorecalc.SubmitCalc(ctx, &scorecalc.SubmitCalcParams{EventID: eventID, UserIDs: []string{userID}})
	if err != nil {
		t.Fatalf("submit gen1 failed: %v", err)
	}
	gen2, err := scorecalc.SubmitCalc(ctx, &scorecalc.SubmitCalcParams{EventID: eventID, UserIDs: []string{userID}})
	if err != nil {
		t.Fatalf("submit gen2 failed: %v", err)
	}
	if gen1.Generation != 1 || gen2.Generation != 2 {
		t.Fatalf("generations = %d, %d; want 1, 2", gen1.Generation, gen2.Generation)
	}

	claim := func(jobID string, gen int) {
		t.Helper()
		if err := HandleScoreCalcRequest(ctx, scorecalc.ScoreCalcRequested{
			Version: 1, JobID: jobID, EventID: eventID, Generation: gen, RequestedAt: now,
		}); err != nil {
			t.Fatalf("claim failed: %v", err)
		}
	}
	claim(gen1.JobID, 1)
	claim(gen2.JobID, 2)

	complete := func(jobID string, gen, points int) {
		t.Helper()
		entries := []scorecalc.ProjectionEntry{{UserID: userID, Points: points}}
		if err := scorecalc.HandleScoreCalcCompleted(ctx, scorecalc.ScoreCalcCompleted{
			Version: 1, JobID: jobID, EventID: eventID, Generation: gen, ComputedAt: now,
			Result: scorecalc.ScoreCalcProjection{EventID: eventID, Entries: entries},
			ResultChecksum: scorecalc.ComputeChecksum(entries),
		}); err != nil {
			t.Fatalf("complete failed: %v", err)
		}
	}

	complete(gen1.JobID, 1, 10)
	if status, _ := readWorkerJob(t, ctx, gen1.JobID); status != "SUPERSEDED" {
		t.Fatalf("gen1 status = %q, want SUPERSEDED", status)
	}
	var count int
	if err := shared.DB.QueryRow(ctx,
		`SELECT COUNT(*) FROM "event_points_entry" WHERE "eventId" = $1`, eventID,
	).Scan(&count); err != nil {
		t.Fatalf("failed to count points: %v", err)
	}
	if count != 0 {
		t.Errorf("points rows = %d, want 0 (stale gen must not persist)", count)
	}

	complete(gen2.JobID, 2, 50)
	if status, _ := readWorkerJob(t, ctx, gen2.JobID); status != "COMPLETED" {
		t.Fatalf("gen2 status = %q, want COMPLETED", status)
	}
	var points int
	if err := shared.DB.QueryRow(ctx,
		`SELECT points FROM "event_points_entry" WHERE "eventId" = $1 AND "userId" = $2`,
		eventID, userID,
	).Scan(&points); err != nil {
		t.Fatalf("failed to read points: %v", err)
	}
	if points != 50 {
		t.Errorf("points = %d, want 50", points)
	}
}
