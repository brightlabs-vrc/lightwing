-- Remove leaderboard-level resultStatus. DSQ/DNF is now a per-race attribute
-- stored on race_result only; the standings leaderboard is points-only.
ALTER TABLE "event_points_entry" DROP COLUMN IF EXISTS "resultStatus";
