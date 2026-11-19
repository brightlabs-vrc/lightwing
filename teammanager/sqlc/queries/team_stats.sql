-- Query member leaderboard stats for a team (cut off by current year).
-- name: GetTeamMembersLeaderboardStats :many
SELECT
    m."userId",
    COALESCE(SUM(epe.points), 0)::bigint AS total_points,
    COALESCE(AVG(rr.position), 0)::double precision AS avg_position,
    COUNT(DISTINCT epe."eventId")::bigint AS events_participated
FROM "member" m
LEFT JOIN "event_points_entry" epe ON epe."userId" = m."userId"
LEFT JOIN "event" e ON e.id = epe."eventId"
    AND EXTRACT(YEAR FROM COALESCE(e."scheduledAt", e."createdAt")) = EXTRACT(YEAR FROM NOW() AT TIME ZONE 'UTC')
LEFT JOIN "race_event" re ON re."eventId" = e.id
LEFT JOIN "race_result" rr ON rr."raceEventId" = re.id AND rr."userId" = m."userId" AND rr.position IS NOT NULL
WHERE m."organizationId" = $1
  AND (epe.id IS NULL OR e.id IS NOT NULL)
GROUP BY m."userId";
