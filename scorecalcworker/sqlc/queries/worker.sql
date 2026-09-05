-- Claim: load the task and fence against newer generations.

-- name: GetTaskForClaim :one
SELECT id, "eventId", generation, status, attempts
FROM "score_calc_task" WHERE id = $1;

-- name: GetLatestGenerationState :one
SELECT "latestGeneration" FROM "score_calc_state" WHERE "eventId" = $1;

-- name: MarkTaskSuperseded :exec
UPDATE "score_calc_task" SET status = 'SUPERSEDED' WHERE id = $1;

-- name: ClaimTask :exec
UPDATE "score_calc_task" SET status = 'PROCESSING', attempts = $1, "startedAt" = $2 WHERE id = $3;

-- Source data for the projection.

-- name: GetEventScoringType :one
SELECT "scoringType" FROM "event" WHERE id = $1;

-- name: FailTask :exec
UPDATE "score_calc_task" SET status = 'FAILED', "lastError" = $1, "completedAt" = $2 WHERE id = $3;

-- name: SupersedeTaskWithError :exec
UPDATE "score_calc_task" SET status = 'SUPERSEDED', "lastError" = $1, "completedAt" = $2 WHERE id = $3;

-- name: ListEventMemberUserIDs :many
SELECT "userId" FROM "event_member" WHERE "eventId" = $1;

-- name: ListRaceResultInputs :many
SELECT r."userId", r.points FROM "race_result" r
JOIN "race_event" re ON re.id = r."raceEventId"
WHERE re."eventId" = $1;
