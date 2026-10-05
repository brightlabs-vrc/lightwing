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

-- name: BatchUpsertPointsEntries :exec
INSERT INTO "event_points_entry" (id, "eventId", "userId", points, "createdAt", "updatedAt")
SELECT unnest(@ids::text[]), @event_id::text, unnest(@user_ids::text[]), unnest(@points::int[]), @created_at::timestamp, @created_at::timestamp
ON CONFLICT ("eventId", "userId") DO UPDATE SET points = EXCLUDED.points;

-- name: AcceptGeneration :exec
UPDATE "score_calc_state" SET "acceptedGeneration" = $1 WHERE "eventId" = $2;

-- name: CompleteJob :exec
UPDATE "score_calc_task" SET status = 'COMPLETED', "completedAt" = $1, "resultChecksum" = $2 WHERE id = $3;

-- name: FailJob :exec
UPDATE "score_calc_task" SET status = 'FAILED', "lastError" = $1, "completedAt" = $2 WHERE id = $3;

-- Leaderboard aggregation.

-- name: CalculateLeaderboardStats :many
SELECT
  u.id AS user_id,
  u.name AS name,
  u."vrchatUsername" AS vrchat_username,
  u.slug AS slug,
  u.image AS image,
  COALESCE(u."classTier"::text, '') AS class_tier,
  COALESCE(p.total_points, 0)::int AS total_points,
  COALESCE(r.avg_position, 0)::float8 AS avg_position,
  COALESCE(r.races_participated, 0)::int AS races_participated,
  COALESCE(r.wins, 0)::int AS wins,
  COALESCE(p.events_participated, 0)::int AS events_participated,
  COALESCE(s.seasons_count, 1)::int AS seasons_count,
  CASE
    WHEN COALESCE(s.seasons_count, 1) > 0 THEN COALESCE(p.total_points, 0)::float8 / COALESCE(s.seasons_count, 1)
    ELSE COALESCE(p.total_points, 0)::float8
  END AS avg_points_per_season
FROM "user" u
LEFT JOIN (
  SELECT "userId", SUM(points) AS total_points, COUNT(DISTINCT "eventId") AS events_participated
  FROM "event_points_entry"
  GROUP BY "userId"
) p ON p."userId" = u.id
LEFT JOIN (
  SELECT
    rr."userId",
    AVG(rr.position) FILTER (WHERE rr.position IS NOT NULL AND rr.position > 0) AS avg_position,
    COUNT(DISTINCT rr."raceEventId") AS races_participated,
    COUNT(*) FILTER (WHERE rr.position = 1) AS wins
  FROM "race_result" rr
  GROUP BY rr."userId"
) r ON r."userId" = u.id
LEFT JOIN (
  SELECT
    epe."userId",
    COUNT(DISTINCT EXTRACT(YEAR FROM COALESCE(e."scheduledAt", e."createdAt"))) AS seasons_count
  FROM "event_points_entry" epe
  JOIN "event" e ON e.id = epe."eventId"
  GROUP BY epe."userId"
) s ON s."userId" = u.id
WHERE (COALESCE(p.total_points, 0) > 0 OR COALESCE(r.races_participated, 0) > 0)
ORDER BY total_points DESC;
