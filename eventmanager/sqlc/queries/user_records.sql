-- User race records query.
-- name: ListUserRaceRecords :many
SELECT
    r.id AS "resultId",
    r.position,
    r.points,
    r."finishTime",
    r."resultStatus",
    r."createdAt" AS "resultCreatedAt",
    re.id AS "raceId",
    re.name AS "raceName",
    re.sequence AS "raceSequence",
    re.grade AS "raceGrade",
    e.id AS "eventId",
    e.name AS "eventName",
    e.tag AS "eventTag",
    e."scheduledAt" AS "eventScheduledAt"
FROM "race_result" r
JOIN "race_event" re ON re.id = r."raceEventId"
JOIN "event" e ON e.id = re."eventId"
WHERE r."userId" = $1
ORDER BY e."createdAt" DESC, re.sequence ASC
LIMIT NULLIF($2::int, 0) OFFSET $3::int;

-- name: CountUserRaceRecords :one
SELECT COUNT(*)
FROM "race_result" r
JOIN "race_event" re ON re.id = r."raceEventId"
JOIN "event" e ON e.id = re."eventId"
WHERE r."userId" = $1;
