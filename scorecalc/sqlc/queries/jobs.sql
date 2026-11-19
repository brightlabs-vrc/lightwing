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
  CASE ct.avg_tier_rank
    WHEN 5 THEN 'G1'
    WHEN 4 THEN 'G2'
    WHEN 3 THEN 'G3'
    ELSE ''
  END AS class_tier,
  COALESCE(p.total_points, 0)::int AS total_points,
  COALESCE(r.avg_position, 0)::float8 AS avg_position,
  COALESCE(r.races_participated, 0)::int AS races_participated,
  COALESCE(r.wins, 0)::int AS wins,
  COALESCE(p.events_participated, 0)::int AS events_participated,
  COALESCE(s.seasons_count, 1)::int AS seasons_count,
  CASE
    WHEN COALESCE(s.seasons_count, 1) > 0 THEN COALESCE(p.total_points, 0)::float8 / COALESCE(s.seasons_count, 1)
    ELSE COALESCE(p.total_points, 0)::float8
  END AS avg_points_per_season,
  COALESCE(urs.rating, 1500)::int AS rating,
  COALESCE(urs."ratingDeviation", 350)::int AS rating_deviation,
  COALESCE(urs."ratingVolatility", 0.06)::float8 AS rating_volatility,
  COALESCE(urs."peakRating", 1500)::int AS peak_rating,
  COALESCE(urs."seasonRatingDelta", 0)::int AS season_rating_delta,
  COALESCE(urs."isProvisional", TRUE)::boolean AS is_provisional
FROM "user" u
LEFT JOIN (
  SELECT
    epe."userId",
    SUM(epe.points) AS total_points,
    COUNT(DISTINCT epe."eventId") AS events_participated
  FROM "event_points_entry" epe
  JOIN "event" e ON e.id = epe."eventId"
  WHERE EXTRACT(YEAR FROM COALESCE(e."scheduledAt", e."createdAt"))::int = @year::int
  GROUP BY epe."userId"
) p ON p."userId" = u.id
LEFT JOIN (
  SELECT
    rr."userId",
    AVG(rr.position) FILTER (WHERE rr.position IS NOT NULL AND rr.position > 0) AS avg_position,
    COUNT(DISTINCT rr."raceEventId") AS races_participated,
    COUNT(*) FILTER (WHERE rr.position = 1) AS wins
  FROM "race_result" rr
  JOIN "race_event" re ON re.id = rr."raceEventId"
  JOIN "event" e ON e.id = re."eventId"
  WHERE EXTRACT(YEAR FROM COALESCE(e."scheduledAt", e."createdAt"))::int = @year::int
  GROUP BY rr."userId"
) r ON r."userId" = u.id
LEFT JOIN (
  SELECT
    epe."userId",
    COUNT(DISTINCT EXTRACT(YEAR FROM COALESCE(e."scheduledAt", e."createdAt"))) AS seasons_count
  FROM "event_points_entry" epe
  JOIN "event" e ON e.id = epe."eventId"
  WHERE EXTRACT(YEAR FROM COALESCE(e."scheduledAt", e."createdAt"))::int = @year::int
  GROUP BY epe."userId"
) s ON s."userId" = u.id
LEFT JOIN (
  SELECT
    ev."userId",
    ROUND(AVG(
      CASE oct."classTier"::text
        WHEN 'G3' THEN 3
        WHEN 'G2' THEN 4
        WHEN 'G1' THEN 5
      END
    ))::int AS avg_tier_rank
  FROM (
    SELECT DISTINCT em."userId", e.id AS "eventId", e."organizationId"
    FROM "event_member" em
    JOIN "event" e ON e.id = em."eventId"
    WHERE e."organizationId" IS NOT NULL
      AND EXTRACT(YEAR FROM COALESCE(e."scheduledAt", e."createdAt"))::int = @year::int
    UNION
    SELECT DISTINCT epe."userId", e.id AS "eventId", e."organizationId"
    FROM "event_points_entry" epe
    JOIN "event" e ON e.id = epe."eventId"
    WHERE e."organizationId" IS NOT NULL
      AND EXTRACT(YEAR FROM COALESCE(e."scheduledAt", e."createdAt"))::int = @year::int
  ) ev
  JOIN "org_class_tier" oct ON oct."organizationId" = ev."organizationId" AND oct."userId" = ev."userId"
  WHERE oct."classTier" IN ('G3', 'G2', 'G1')
  GROUP BY ev."userId"
) ct ON ct."userId" = u.id
LEFT JOIN "user_rating_snapshot" urs ON urs."userId" = u.id AND urs."year" = @year::int
WHERE (COALESCE(p.total_points, 0) > 0 OR COALESCE(r.races_participated, 0) > 0)
ORDER BY total_points DESC;

-- name: ListLeaderboardYears :many
SELECT DISTINCT EXTRACT(YEAR FROM COALESCE("scheduledAt", "createdAt"))::int AS year
FROM "event"
WHERE "deletedAt" IS NULL
ORDER BY year DESC;

-- Glicko-2 rating calculation & persistence queries.

-- name: ListAllChronologicalRaceResults :many
SELECT
  rr.id AS result_id,
  rr."raceEventId" AS race_event_id,
  e.id AS event_id,
  re.sequence AS race_sequence,
  COALESCE(re."startsAt", e."scheduledAt", e."createdAt") AS occurred_at,
  EXTRACT(YEAR FROM COALESCE(e."scheduledAt", e."createdAt"))::int AS event_year,
  rr."userId" AS user_id,
  rr.position AS position,
  rr."resultStatus" AS result_status
FROM "race_result" rr
JOIN "race_event" re ON re.id = rr."raceEventId"
JOIN "event" e ON e.id = re."eventId"
WHERE e."deletedAt" IS NULL
ORDER BY
  COALESCE(re."startsAt", e."scheduledAt", e."createdAt") ASC,
  e."createdAt" ASC,
  e.id ASC,
  re.sequence ASC,
  re.id ASC,
  rr.id ASC;

-- name: CountUserRatingSnapshots :one
SELECT COUNT(*) FROM "user_rating_snapshot";

-- name: CountRaceResults :one
SELECT COUNT(*) FROM "race_result";

-- name: ClearUserRatingSnapshots :exec
DELETE FROM "user_rating_snapshot";

-- name: BatchUpsertUserRatingSnapshots :exec
INSERT INTO "user_rating_snapshot" (
  "userId",
  "year",
  "rating",
  "ratingDeviation",
  "ratingVolatility",
  "peakRating",
  "seasonRatingDelta",
  "ratedRaces",
  "isProvisional",
  "updatedAt"
)
SELECT
  unnest(@user_ids::text[]),
  unnest(@years::int[]),
  unnest(@ratings::int[]),
  unnest(@rating_deviations::int[]),
  unnest(@rating_volatilities::float8[]),
  unnest(@peak_ratings::int[]),
  unnest(@season_rating_deltas::int[]),
  unnest(@rated_races::int[]),
  unnest(@is_provisionals::boolean[]),
  @updated_at::timestamp
ON CONFLICT ("userId", "year") DO UPDATE SET
  "rating" = EXCLUDED."rating",
  "ratingDeviation" = EXCLUDED."ratingDeviation",
  "ratingVolatility" = EXCLUDED."ratingVolatility",
  "peakRating" = EXCLUDED."peakRating",
  "seasonRatingDelta" = EXCLUDED."seasonRatingDelta",
  "ratedRaces" = EXCLUDED."ratedRaces",
  "isProvisional" = EXCLUDED."isProvisional",
  "updatedAt" = EXCLUDED."updatedAt";

-- name: ClearRaceResultRatings :exec
UPDATE "race_result"
SET "ratingBefore" = NULL, "ratingAfter" = NULL, "ratingDelta" = NULL, "rdAfter" = NULL
WHERE "ratingAfter" IS NOT NULL;

-- name: BatchUpdateRaceResultRatings :exec
UPDATE "race_result" rr
SET
  "ratingBefore" = data.rating_before,
  "ratingAfter" = data.rating_after,
  "ratingDelta" = data.rating_delta,
  "rdAfter" = data.rd_after
FROM (
  SELECT
    unnest(@result_ids::text[]) AS id,
    unnest(@rating_befores::int[]) AS rating_before,
    unnest(@rating_afters::int[]) AS rating_after,
    unnest(@rating_deltas::int[]) AS rating_delta,
    unnest(@rd_afters::int[]) AS rd_after
) data
WHERE rr.id = data.id;
