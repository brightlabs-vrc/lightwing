package scorecalcworker

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"encore.dev/rlog"
	"encore.dev/pubsub"
	"encore.app/scorecalc"
	"encore.app/shared"
)

// db is the shared Lightwing database (direct reference: Encore tracks
// resources through package-level references only).
var _ = pubsub.NewSubscription(scorecalc.ScoreCalcRequestedTopic, "scorecalc-worker-requests", pubsub.SubscriptionConfig[scorecalc.ScoreCalcRequested]{
	Handler: HandleScoreCalcRequest,
})

// HandleScoreCalcRequest claims a pending job, computes the projection from
// canonical source data, and publishes the completion.
//
// Mirrors ts-legacy/scorecalc-worker/worker.ts handleScoreCalcRequest.
func HandleScoreCalcRequest(ctx context.Context, event scorecalc.ScoreCalcRequested) error {
	jobID, eventID, generation := event.JobID, event.EventID, event.Generation
	rlog.Info(fmt.Sprintf("Received ScoreCalcRequested message: jobId=%s, eventId=%s, gen=%d", jobID, eventID, generation))

	tx, err := shared.DB.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	var jobIDScanned, jobEventID, status string
	var jobGeneration, attempts int
	err = tx.QueryRow(ctx,
		`SELECT id, "eventId", generation, status, attempts FROM "score_calc_task" WHERE id = $1`, jobID,
	).Scan(&jobIDScanned, &jobEventID, &jobGeneration, &status, &attempts)
	if errors.Is(err, sql.ErrNoRows) {
		rlog.Warn(fmt.Sprintf("Job %s not found in database.", jobID))
		return nil
	}
	if err != nil {
		return err
	}
	if status == "COMPLETED" || status == "SUPERSEDED" {
		rlog.Info(fmt.Sprintf("Job %s is already %s. Skipping.", jobID, status))
		return nil
	}

	var latestGeneration int
	err = tx.QueryRow(ctx,
		`SELECT "latestGeneration" FROM "score_calc_state" WHERE "eventId" = $1`, jobEventID,
	).Scan(&latestGeneration)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	if err == nil && jobGeneration < latestGeneration {
		rlog.Info(fmt.Sprintf("Job %s generation %d is superseded by latest generation %d.", jobID, jobGeneration, latestGeneration))
		if _, err := tx.Exec(ctx, `UPDATE "score_calc_task" SET status = 'SUPERSEDED' WHERE id = $1`, jobID); err != nil {
			return err
		}
		return tx.Commit()
	}

	if status != "PENDING" && status != "FAILED" {
		rlog.Info(fmt.Sprintf("Job %s is in status %s. Skipping.", jobID, status))
		return nil
	}

	now := time.Now().UTC()
	if _, err := tx.Exec(ctx,
		`UPDATE "score_calc_task" SET status = 'PROCESSING', attempts = $1, "startedAt" = $2 WHERE id = $3`,
		attempts+1, now, jobID,
	); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}

	var scoringType int
	err = shared.DB.QueryRow(ctx,
		`SELECT "scoringType" FROM "event" WHERE id = $1`, jobEventID,
	).Scan(&scoringType)
	if errors.Is(err, sql.ErrNoRows) {
		rlog.Error(fmt.Sprintf("Event %s not found for Job %s. Marking failed.", jobEventID, jobID))
		if _, err := shared.DB.Exec(ctx,
			`UPDATE "score_calc_task" SET status = 'FAILED', "lastError" = $1, "completedAt" = $2 WHERE id = $3`,
			fmt.Sprintf("Event %s not found.", jobEventID), time.Now().UTC(), jobID,
		); err != nil {
			return err
		}
		_, err = scorecalc.ScoreCalcFailedTopic.Publish(ctx, scorecalc.ScoreCalcFailed{
			Version: 1, JobID: jobID, EventID: eventID, Generation: generation,
			FailedAt: time.Now().UTC().Format(time.RFC3339Nano),
			ErrorCode: "EVENT_NOT_FOUND",
			ErrorMessage: fmt.Sprintf("Event %s not found.", jobEventID),
			Retryable: false,
		})
		return err
	}
	if err != nil {
		return err
	}

	if scoringType != 1 {
		rlog.Info(fmt.Sprintf("Event %s is not points-based (scoringType=%d). Rejecting job %s.", jobEventID, scoringType, jobID))
		_, err = shared.DB.Exec(ctx,
			`UPDATE "score_calc_task" SET status = 'SUPERSEDED', "lastError" = $1, "completedAt" = $2 WHERE id = $3`,
			fmt.Sprintf("Rejected: event is not points-based (scoringType=%d)", scoringType), time.Now().UTC(), jobID,
		)
		return err
	}

	rows, err := shared.DB.Query(ctx, `SELECT "userId" FROM "event_member" WHERE "eventId" = $1`, jobEventID)
	if err != nil {
		return err
	}
	var members []string
	for rows.Next() {
		var userID string
		if err := rows.Scan(&userID); err != nil {
			rows.Close()
			return err
		}
		members = append(members, userID)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	rows, err = shared.DB.Query(ctx,
		`SELECT r."userId", r.points FROM "race_result" r
		 JOIN "race_event" re ON re.id = r."raceEventId"
		 WHERE re."eventId" = $1`, jobEventID)
	if err != nil {
		return err
	}
	var results []scorecalc.RaceResultInput
	for rows.Next() {
		var r scorecalc.RaceResultInput
		if err := rows.Scan(&r.UserID, &r.Points); err != nil {
			rows.Close()
			return err
		}
		results = append(results, r)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	projection := scorecalc.CalculateEventProjection(scorecalc.EventScoreInput{
		EventID: jobEventID, Members: members, RaceResults: results,
	})
	checksum := scorecalc.ComputeChecksum(projection.Entries)

	rlog.Info(fmt.Sprintf("Calculation completed for Job %s, publishing results. Checksum: %s", jobID, checksum))
	_, err = scorecalc.ScoreCalcCompletedTopic.Publish(ctx, scorecalc.ScoreCalcCompleted{
		Version: 1, JobID: jobID, EventID: jobEventID, Generation: jobGeneration,
		ComputedAt: time.Now().UTC().Format(time.RFC3339Nano),
		Result: projection, ResultChecksum: checksum,
	})
	return err
}
