-- Add resultStatus column for DSQ/DNF handling
ALTER TABLE race_result ADD COLUMN IF NOT EXISTS "resultStatus" TEXT;
ALTER TABLE event_points_entry ADD COLUMN IF NOT EXISTS "resultStatus" TEXT;
