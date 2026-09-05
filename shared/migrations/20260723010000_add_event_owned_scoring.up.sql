-- AlterTable
ALTER TABLE "event" ADD COLUMN IF NOT EXISTS "customScoringTables" JSONB,
ADD COLUMN IF NOT EXISTS "scoringRulesMode" TEXT;

-- AlterTable
ALTER TABLE "race_event" ADD COLUMN IF NOT EXISTS "grade" TEXT;

-- Data Migration: Set existing points-based events to STANDARD scoring rules
UPDATE "event" SET "scoringRulesMode" = 'STANDARD' WHERE "scoringType" = 1;
