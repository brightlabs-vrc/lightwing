-- AlterTable
ALTER TABLE "event" ADD COLUMN "customScoringTables" JSONB,
ADD COLUMN "scoringRulesMode" TEXT;

-- AlterTable
ALTER TABLE "race_event" ADD COLUMN "grade" TEXT;

-- Data Migration: Set existing points-based events to STANDARD scoring rules
UPDATE "event" SET "scoringRulesMode" = 'STANDARD' WHERE "scoringType" = 1;
