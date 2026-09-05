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
	"encore.dev/storage/sqldb"
	"encore.dev/pubsub"
	"encore.app/shared"
	"encore.app/scorecalc/sqlc"
	"github.com/sqlc-dev/pqtype"
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
	JobID     string `json:"jobId"`
	Generation int   `json:"generation"`
}

// SubmitCalc mirrors ts-legacy/scorecalc/scorecalc.ts submitCalc. Private: called from
// inside the app (eventmanager) only.
//
//encore:api private method=POST path=/scorecalc/submit
func SubmitCalc(ctx context.Context, params *SubmitCalcParams) (*SubmitCalcResponse, error) {
	if len(params.UserIDs) == 0 {
		return nil, &errs.Error{Code: errs.InvalidArgument, Message: "userIds list cannot be empty"}
	}

	scoringType, err := q().GetEventScoringType(ctx, params.EventID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, &errs.Error{Code: errs.NotFound, Message: fmt.Sprintf("Event %s not found", params.EventID)}
	}
	if err != nil {
		return nil, err
	}

	if int(scoringType) != 1 {
		rlog.Info(fmt.Sprintf("Defensively rejecting submitCalc for non-points event %s (scoringType=%d)", params.EventID, scoringType))
		return &SubmitCalcResponse{JobID: "no-op", Generation: 0}, nil
	}

	userIDsJSON, err := json.Marshal(params.UserIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to encode user ids: %w", err)
	}

	stx, err := std().BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer stx.Rollback()
	qq := q().WithTx(stx)

	generation32, err := qq.CoalesceGeneration(ctx, sqlc.CoalesceGenerationParams{
		EventId:   params.EventID,
		UpdatedAt: time.Now().UTC(),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to coalesce generation: %w", err)
	}
	generation := int(generation32)

	jobID := newID()
	now := time.Now().UTC()
	if err := qq.CreateJob(ctx, sqlc.CreateJobParams{
		ID:               jobID,
		EventId:          params.EventID,
		Generation:       generation32,
		RequestedUserIds: pqtype.NullRawMessage{RawMessage: userIDsJSON, Valid: true},
		RequestedAt:      now,
	}); err != nil {
		return nil, fmt.Errorf("failed to create job: %w", err)
	}
	if err := stx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit job: %w", err)
	}

	_ = sqldb.RegisterStdlibDriver(db)

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

	stx, err := std().BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer stx.Rollback()
	qq := q().WithTx(stx)

	job, err := qq.GetJob(ctx, event.JobID)
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

	latestGeneration, err := qq.GetLatestGeneration(ctx, event.EventID)
	if errors.Is(err, sql.ErrNoRows) {
		rlog.Error(fmt.Sprintf("ScoreCalcState not found for event %s. Skipping.", event.EventID))
		return nil
	}
	if err != nil {
		return err
	}

	if event.Generation < int(latestGeneration) {
		rlog.Info(fmt.Sprintf("Ignoring stale completion: generation %d is older than latest %d.", event.Generation, latestGeneration))
		if err := qq.MarkJobSuperseded(ctx, event.JobID); err != nil {
			return err
		}
		return stx.Commit()
	}

	now := time.Now().UTC()
	for _, entry := range event.Result.Entries {
		if err := qq.UpsertPointsEntry(ctx, sqlc.UpsertPointsEntryParams{
			ID:        newID(),
			EventId:   event.EventID,
			UserId:    entry.UserID,
			Points:    int32(entry.Points),
			CreatedAt: now,
		}); err != nil {
			return fmt.Errorf("failed to upsert points entry: %w", err)
		}
	}
	if err := qq.AcceptGeneration(ctx, sqlc.AcceptGenerationParams{
		AcceptedGeneration: int32(event.Generation),
		EventId:            event.EventID,
	}); err != nil {
		return err
	}
	if err := qq.CompleteJob(ctx, sqlc.CompleteJobParams{
		ID:             event.JobID,
		CompletedAt:    sql.NullTime{Time: now, Valid: true},
		ResultChecksum: sql.NullString{String: event.ResultChecksum, Valid: true},
	}); err != nil {
		return err
	}

	var userIDs []string
	if job.RequestedUserIds.Valid {
		_ = json.Unmarshal(job.RequestedUserIds.RawMessage, &userIDs)
	}
	if err := stx.Commit(); err != nil {
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

	stx, err := std().BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer stx.Rollback()
	qq := q().WithTx(stx)

	job, err := qq.GetJob(ctx, event.JobID)
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

	latestGeneration, err := qq.GetLatestGeneration(ctx, event.EventID)
	if err == nil {
		if event.Generation < int(latestGeneration) {
			if err := qq.MarkJobSuperseded(ctx, event.JobID); err != nil {
				return err
			}
			return stx.Commit()
		}
	} else if !errors.Is(err, sql.ErrNoRows) {
		return err
	}

	now := time.Now().UTC()
	if err := qq.FailJob(ctx, sqlc.FailJobParams{
		ID:          event.JobID,
		LastError:   sql.NullString{String: event.ErrorMessage, Valid: true},
		CompletedAt: sql.NullTime{Time: now, Valid: true},
	}); err != nil {
		return err
	}

	var userIDs []string
	if job.RequestedUserIds.Valid {
		_ = json.Unmarshal(job.RequestedUserIds.RawMessage, &userIDs)
	}
	if err := stx.Commit(); err != nil {
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
