-- Query member leaderboard stats for a team.
-- name: GetTeamMembersLeaderboardStats :many
SELECT
    m."userId",
    COALESCE(SUM(epe.points), 0)::bigint AS total_points,
    COALESCE(AVG(rr.position), 0)::double precision AS avg_position,
    COUNT(DISTINCT epe."eventId")::bigint AS events_participated
FROM "member" m
LEFT JOIN "event_points_entry" epe ON epe."userId" = m."userId"
LEFT JOIN "race_event" re ON re."eventId" = epe."eventId"
LEFT JOIN "race_result" rr ON rr."raceEventId" = re.id AND rr."userId" = m."userId" AND rr.position IS NOT NULL
WHERE m."organizationId" = $1
GROUP BY m."userId";
