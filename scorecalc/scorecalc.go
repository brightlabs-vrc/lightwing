package scorecalc

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"encore.dev/beta/errs"
	"encore.dev/rlog"
	"encore.dev/storage/cache"
	"encore.dev/pubsub"
	"encore.app/shared"
)

// newID generates a random UUIDv4 string for row ids.
func newID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// db is the shared Lightwing database (no aliasing: Encore tracks resources
// through direct package-level references only).
// eventDetailCache mirrors the TS duplicate keyspace definition: it exists
// so this service can invalidate the event-detail cache across the service
// boundary (same Redis keys as eventmanager's keyspace).
type eventDetailKey struct {
	ID string
}

type eventDetailValue struct {
	ID string `json:"id"`
}

var eventDetailCache = cache.NewStructKeyspace[eventDetailKey, eventDetailValue](shared.Cache, cache.KeyspaceConfig{
	KeyPattern:    "event-detail/:ID",
	DefaultExpiry: cache.ExpireIn(120 * time.Second),
})

var (
	_ = pubsub.NewSubscription(ScoreCalcCompletedTopic, "scorecalc-completed-handler", pubsub.SubscriptionConfig[ScoreCalcCompleted]{
		Handler: HandleScoreCalcCompleted,
	})
	_ = pubsub.NewSubscription(ScoreCalcFailedTopic, "scorecalc-failed-handler", pubsub.SubscriptionConfig[ScoreCalcFailed]{
		Handler: HandleScoreCalcFailed,
	})
)

// SubmitCalcParams requests a score calculation for an event.
type SubmitCalcParams struct {
	EventID string   `json:"eventId"`
	UserIDs []string `json:"userIds"`
}

// SubmitCalcResponse carries the queued job id and generation.
type SubmitCalcResponse struct {
	JobID      string `json:"jobId"`
	Generation int    `json:"generation"`
}

// SubmitCalc queues a score calculation: validates the event, coalesces the
// generation, persists a pending job, and publishes the request + status.
//
// Mirrors ts-legacy/scorecalc/scorecalc.ts submitCalc. Private: called from
// inside the app (eventmanager) only.
//
//encore:api private method=POST path=/scorecalc/submit
func SubmitCalc(ctx context.Context, params *SubmitCalcParams) (*SubmitCalcResponse, error) {
	if len(params.UserIDs) == 0 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "userIds list cannot be empty"}
	}

	var scoringType int
	err := db.QueryRow(ctx,
		`SELECT "scoringType" FROM "event" WHERE id = $1`, params.EventID,
	).Scan(&scoringType)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, &errs.Error{Code: errs.NotFound, Message: fmt.Sprintf("Event %s not found", params.EventID)}
	}
	if err != nil {
		return nil, err
	}

	if scoringType != 1 {
		rlog.Info(fmt.Sprintf("Defensively rejecting submitCalc for non-points event %s (scoringType=%d)", params.EventID, scoringType))
		return &SubmitCalcResponse{JobID: "no-op", Generation: 0}, nil
	}

	userIDsJSON, err := json.Marshal(params.UserIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to encode user ids: %w", err)
	}

	tx, err := db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	var generation int
	err = tx.QueryRow(ctx,
		`INSERT INTO "score_calc_state" ("eventId", "latestGeneration", "acceptedGeneration", "updatedAt")
		 VALUES ($1, 1, 0, $2)
		 ON CONFLICT ("eventId") DO UPDATE SET "latestGeneration" = "score_calc_state"."latestGeneration" + 1
		 RETURNING "latestGeneration"`,
		params.EventID, time.Now().UTC(),
	).Scan(&generation)
	if err != nil {
		return nil, fmt.Errorf("failed to coalesce generation: %w", err)
	}

	jobID := newID()
	now := time.Now().UTC()
	_, err = tx.Exec(ctx,
		`INSERT INTO "score_calc_task" (id, "eventId", generation, "requestedUserIds", status, attempts, "requestedAt")
		 VALUES ($1, $2, $3, $4, 'PENDING', 0, $5)`,
		jobID, params.EventID, generation, string(userIDsJSON), now,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create job: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit job: %w", err)
	}

	if _, err := ScoreCalcRequestedTopic.Publish(ctx, ScoreCalcRequested{
		Version: 1, JobID: jobID, EventID: params.EventID,
		Generation: generation, RequestedAt: now.Format(time.RFC3339Nano),
	}); err != nil {
		return nil, fmt.Errorf("failed to publish request: %w", err)
	}
	if _, err := ScoreCalcStatusTopic.Publish(ctx, ScoreCalcStatusEvent{
		EventID: params.EventID, UserIDs: params.UserIDs,
		Status: "queued", Timestamp: now.Format(time.RFC3339Nano),
	}); err != nil {
		return nil, fmt.Errorf("failed to publish status: %w", err)
	}

	return &SubmitCalcResponse{JobID: jobID, Generation: generation}, nil
}

// scoreCalcJobRow mirrors the score_calc_task columns read by handlers.
type scoreCalcJobRow struct {
	ID               string
	EventID          string
	Generation       int
	RequestedUserIDs []byte
	Status           string
	Attempts         int
}

// HandleScoreCalcCompleted persists a finished projection with generation
// fencing: stale completions are marked SUPERSEDED and never overwrite newer
// generations.
//
// Mirrors ts-legacy/scorecalc/scorecalc.ts handleScoreCalcCompleted.
func HandleScoreCalcCompleted(ctx context.Context, event ScoreCalcCompleted) error {
	rlog.Info(fmt.Sprintf("Received ScoreCalcCompleted message: jobId=%s, eventId=%s, gen=%d", event.JobID, event.EventID, event.Generation))

	tx, err := db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	var job scoreCalcJobRow
	err = tx.QueryRow(ctx,
		`SELECT id, "eventId", generation, "requestedUserIds", status, attempts
		 FROM "score_calc_task" WHERE id = $1`, event.JobID,
	).Scan(&job.ID, &job.EventID, &job.Generation, &job.RequestedUserIDs, &job.Status, &job.Attempts)
	if errors.Is(err, sql.ErrNoRows) {
		rlog.Warn(fmt.Sprintf("Job %s not found in database. Skipping.", event.JobID))
		return nil
	}
	if err != nil {
		return err
	}
	if job.Status == "COMPLETED" || job.Status == "SUPERSEDED" {
		rlog.Info(fmt.Sprintf("Job %s is already %s. Skipping.", event.JobID, job.Status))
		return nil
	}

	var latestGeneration int
	err = tx.QueryRow(ctx,
		`SELECT "latestGeneration" FROM "score_calc_state" WHERE "eventId" = $1`, event.EventID,
	).Scan(&latestGeneration)
	if errors.Is(err, sql.ErrNoRows) {
		rlog.Error(fmt.Sprintf("ScoreCalcState not found for event %s. Skipping.", event.EventID))
		return nil
	}
	if err != nil {
		return err
	}

	if event.Generation < latestGeneration {
		rlog.Info(fmt.Sprintf("Ignoring stale completion: generation %d is older than latest %d.", event.Generation, latestGeneration))
		_, err = tx.Exec(ctx, `UPDATE "score_calc_task" SET status = 'SUPERSEDED' WHERE id = $1`, event.JobID)
		if err != nil {
			return err
		}
		return tx.Commit()
	}

	now := time.Now().UTC()
	for _, entry := range event.Result.Entries {
		_, err = tx.Exec(ctx,
			`INSERT INTO "event_points_entry" (id, "eventId", "userId", points, "createdAt", "updatedAt")
			 VALUES ($1, $2, $3, $4, $5, $5)
			 ON CONFLICT ("eventId", "userId") DO UPDATE SET points = EXCLUDED.points`,
			newID(), event.EventID, entry.UserID, entry.Points, now,
		)
		if err != nil {
			return fmt.Errorf("failed to upsert points entry: %w", err)
		}
	}
	if _, err := tx.Exec(ctx,
		`UPDATE "score_calc_state" SET "acceptedGeneration" = $1 WHERE "eventId" = $2`,
		event.Generation, event.EventID,
	); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`UPDATE "score_calc_task" SET status = 'COMPLETED', "completedAt" = $1, "resultChecksum" = $2 WHERE id = $3`,
		now, event.ResultChecksum, event.JobID,
	); err != nil {
		return err
	}

	var userIDs []string
	if len(job.RequestedUserIDs) > 0 {
		_ = json.Unmarshal(job.RequestedUserIDs, &userIDs)
	}
	if err := tx.Commit(); err != nil {
		return err
	}

	// Post-commit cache invalidation + status publish.
	if eventDetailCache != nil {
		_, _ = eventDetailCache.Delete(ctx, eventDetailKey{ID: event.EventID})
	}
	if _, err := ScoreCalcStatusTopic.Publish(ctx, ScoreCalcStatusEvent{
		EventID: event.EventID, UserIDs: userIDs,
		Status: "completed", Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
	}); err != nil {
		return err
	}
	rlog.Info(fmt.Sprintf("Successfully persisted score projection for jobId=%s", event.JobID))
	return nil
}

// HandleScoreCalcFailed marks a job failed without regressing newer
// generations to a stale failure.
//
// Mirrors ts-legacy/scorecalc/scorecalc.ts handleScoreCalcFailed.
func HandleScoreCalcFailed(ctx context.Context, event ScoreCalcFailed) error {
	rlog.Info(fmt.Sprintf("Received ScoreCalcFailed message: jobId=%s, eventId=%s, gen=%d", event.JobID, event.EventID, event.Generation))

	tx, err := db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	var job scoreCalcJobRow
	err = tx.QueryRow(ctx,
		`SELECT id, "eventId", generation, "requestedUserIds", status, attempts
		 FROM "score_calc_task" WHERE id = $1`, event.JobID,
	).Scan(&job.ID, &job.EventID, &job.Generation, &job.RequestedUserIDs, &job.Status, &job.Attempts)
	if errors.Is(err, sql.ErrNoRows) {
		rlog.Warn(fmt.Sprintf("Job %s not found. Skipping.", event.JobID))
		return nil
	}
	if err != nil {
		return err
	}
	if job.Status == "COMPLETED" || job.Status == "SUPERSEDED" {
		return nil
	}

	var latestGeneration *int
	var lg int
	err = tx.QueryRow(ctx,
		`SELECT "latestGeneration" FROM "score_calc_state" WHERE "eventId" = $1`, event.EventID,
	).Scan(&lg)
	if err == nil {
		latestGeneration = &lg
	} else if !errors.Is(err, sql.ErrNoRows) {
		return err
	}

	if latestGeneration != nil && event.Generation < *latestGeneration {
		_, err = tx.Exec(ctx, `UPDATE "score_calc_task" SET status = 'SUPERSEDED' WHERE id = $1`, event.JobID)
		if err != nil {
			return err
		}
		return tx.Commit()
	}

	now := time.Now().UTC()
	if _, err := tx.Exec(ctx,
		`UPDATE "score_calc_task" SET status = 'FAILED', "lastError" = $1, "completedAt" = $2 WHERE id = $3`,
		event.ErrorMessage, now, event.JobID,
	); err != nil {
		return err
	}

	var userIDs []string
	if len(job.RequestedUserIDs) > 0 {
		_ = json.Unmarshal(job.RequestedUserIDs, &userIDs)
	}
	if err := tx.Commit(); err != nil {
		return err
	}

	if _, err := ScoreCalcStatusTopic.Publish(ctx, ScoreCalcStatusEvent{
		EventID: event.EventID, UserIDs: userIDs,
		Status: "failed", Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
	}); err != nil {
		return err
	}
	return nil
}
