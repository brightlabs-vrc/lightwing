-- Event lookup.

-- name: GetEventScoringType :one
SELECT "scoringType" FROM "event" WHERE id = $1;

-- Generation coalescing: insert the state row or bump the generation,
-- returning the generation this job must use.

-- name: CoalesceGeneration :one
INSERT INTO "score_calc_state" ("eventId", "latestGeneration", "acceptedGeneration", "updatedAt")
VALUES ($1, 1, 0, $2)
ON CONFLICT ("eventId") DO UPDATE SET "latestGeneration" = "score_calc_state"."latestGeneration" + 1
RETURNING "latestGeneration";

-- name: CreateJob :exec
INSERT INTO "score_calc_task" (id, "eventId", generation, "requestedUserIds", status, attempts, "requestedAt")
VALUES ($1, $2, $3, $4, 'PENDING', 0, $5);

-- Job lifecycle.

-- name: GetJob :one
SELECT id, "eventId", generation, "requestedUserIds", status, attempts
FROM "score_calc_task" WHERE id = $1;

-- name: GetLatestGeneration :one
SELECT "latestGeneration" FROM "score_calc_state" WHERE "eventId" = $1;

-- name: MarkJobSuperseded :exec
UPDATE "score_calc_task" SET status = 'SUPERSEDED' WHERE id = $1;

-- name: UpsertPointsEntry :exec
INSERT INTO "event_points_entry" (id, "eventId", "userId", points, "createdAt", "updatedAt")
VALUES ($1, $2, $3, $4, $5, $5)
ON CONFLICT ("eventId", "userId") DO UPDATE SET points = EXCLUDED.points;

-- name: AcceptGeneration :exec
UPDATE "score_calc_state" SET "acceptedGeneration" = $1 WHERE "eventId" = $2;

-- name: CompleteJob :exec
UPDATE "score_calc_task" SET status = 'COMPLETED', "completedAt" = $1, "resultChecksum" = $2 WHERE id = $3;

-- name: FailJob :exec
UPDATE "score_calc_task" SET status = 'FAILED', "lastError" = $1, "completedAt" = $2 WHERE id = $3;
