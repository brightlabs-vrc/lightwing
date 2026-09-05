-- Add Netkeiba-style recordkeeping columns to race_result.
-- All columns are nullable so existing results remain valid. These fields are
-- descriptive only and are intentionally excluded from scoring calculations.

ALTER TABLE "race_result" ADD COLUMN IF NOT EXISTS "gateNumber" SMALLINT;
ALTER TABLE "race_result" ADD COLUMN IF NOT EXISTS "finishTime" TEXT;
ALTER TABLE "race_result" ADD COLUMN IF NOT EXISTS "margin" TEXT;
ALTER TABLE "race_result" ADD COLUMN IF NOT EXISTS "passingOrder" TEXT;
ALTER TABLE "race_result" ADD COLUMN IF NOT EXISTS "final3F" TEXT;
