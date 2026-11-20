-- User race records query.
-- name: ListUserRaceRecords :many
SELECT
    r.id AS "resultId",
    r.position,
    r.points,
    r."finishTime",
    r."resultStatus",
    r."createdAt" AS "resultCreatedAt",
    r."ratingBefore",
    r."ratingAfter",
    r."ratingDelta",
    r."rdAfter",
    re.id AS "raceId",
    re.name AS "raceName",
    re.sequence AS "raceSequence",
    re.grade AS "raceGrade",
    e.id AS "eventId",
    e.name AS "eventName",
    e.tag AS "eventTag",
    e."scheduledAt" AS "eventScheduledAt",
    em."teamId" AS "teamId",
    CASE WHEN e.status = 'CONCLUDED' THEN COALESCE(em."teamNameSnapshot", t.name) ELSE COALESCE(t.name, em."teamNameSnapshot") END AS "teamName",
    CASE WHEN e.status = 'CONCLUDED' THEN COALESCE(em."teamSlugSnapshot", t.slug) ELSE COALESCE(t.slug, em."teamSlugSnapshot") END AS "teamSlug"
FROM "race_result" r
JOIN "race_event" re ON re.id = r."raceEventId"
JOIN "event" e ON e.id = re."eventId"
LEFT JOIN "event_member" em ON em."eventId" = e.id AND em."userId" = r."userId"
LEFT JOIN "team" t ON t.id = em."teamId"
WHERE r."userId" = $1
  AND ($4::int = 0 OR EXTRACT(YEAR FROM COALESCE(e."scheduledAt", e."createdAt"))::int = $4::int)
ORDER BY e."createdAt" DESC, re.sequence ASC
LIMIT NULLIF($2::int, 0) OFFSET $3::int;

-- name: CountUserRaceRecords :one
SELECT COUNT(*)
FROM "race_result" r
JOIN "race_event" re ON re.id = r."raceEventId"
JOIN "event" e ON e.id = re."eventId"
WHERE r."userId" = $1
  AND ($2::int = 0 OR EXTRACT(YEAR FROM COALESCE(e."scheduledAt", e."createdAt"))::int = $2::int);
