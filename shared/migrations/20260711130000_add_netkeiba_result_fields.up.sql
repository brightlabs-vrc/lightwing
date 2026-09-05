-- Add Netkeiba-style recordkeeping columns to race_result.
-- All columns are nullable so existing results remain valid. These fields are
-- descriptive only and are intentionally excluded from scoring calculations.

ALTER TABLE "race_result" ADD COLUMN "gateNumber" SMALLINT;
ALTER TABLE "race_result" ADD COLUMN "finishTime" TEXT;
ALTER TABLE "race_result" ADD COLUMN "margin" TEXT;
ALTER TABLE "race_result" ADD COLUMN "passingOrder" TEXT;
ALTER TABLE "race_result" ADD COLUMN "final3F" TEXT;
