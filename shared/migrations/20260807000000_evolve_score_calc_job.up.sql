-- DropIndex
DROP INDEX IF EXISTS "score_calc_task_createdAt_idx";

-- DropIndex
DROP INDEX IF EXISTS "score_calc_task_nextRunAt_idx";

-- DropIndex
DROP INDEX IF EXISTS "score_calc_task_status_idx";

-- Add the new columns before removing the legacy columns so existing jobs can
-- be migrated into per-event generations without colliding on the new key.
ALTER TABLE "score_calc_task"
ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(6),
ADD COLUMN IF NOT EXISTS "generation" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "lastError" TEXT,
ADD COLUMN IF NOT EXISTS "requestedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "requestedUserIds" JSONB,
ADD COLUMN IF NOT EXISTS "resultChecksum" TEXT,
ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(6);

-- Data migration from the legacy columns into the new generation model. Reads
-- the legacy columns, so it only runs when they still exist (on a fresh
-- database, or the first time this migration applies); replaying over a
-- database where this migration already ran is a no-op.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'score_calc_task' AND column_name = 'retryCount'
  ) THEN
    WITH ranked_jobs AS (
        SELECT
            "id",
            ROW_NUMBER() OVER (
                PARTITION BY "eventId"
                ORDER BY "createdAt", "id"
            ) AS "generation"
        FROM "score_calc_task"
    )
    UPDATE "score_calc_task" AS task
    SET
        "attempts" = task."retryCount",
        "generation" = ranked_jobs."generation",
        "requestedAt" = task."createdAt",
        "requestedUserIds" = jsonb_build_array(task."userId")
    FROM ranked_jobs
    WHERE task."id" = ranked_jobs."id";
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "score_calc_state" (
    "eventId" TEXT NOT NULL,
    "latestGeneration" INTEGER NOT NULL,
    "acceptedGeneration" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "score_calc_state_pkey" PRIMARY KEY ("eventId")
);

INSERT INTO "score_calc_state" ("eventId", "latestGeneration", "acceptedGeneration", "updatedAt")
SELECT
    "eventId",
    MAX("generation"),
    COALESCE(MAX("generation") FILTER (WHERE "status" = 'COMPLETED'), 0),
    CURRENT_TIMESTAMP
FROM "score_calc_task"
GROUP BY "eventId"
ON CONFLICT ("eventId") DO NOTHING;

-- Remove legacy columns after their values have been migrated.
ALTER TABLE "score_calc_task"
DROP COLUMN IF EXISTS "createdAt",
DROP COLUMN IF EXISTS "nextRunAt",
DROP COLUMN IF EXISTS "retryCount",
DROP COLUMN IF EXISTS "updatedAt",
DROP COLUMN IF EXISTS "userId",
ALTER COLUMN "status" DROP DEFAULT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "score_calc_task_eventId_generation_idx" ON "score_calc_task"("eventId", "generation");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "score_calc_task_status_requestedAt_idx" ON "score_calc_task"("status", "requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "score_calc_task_eventId_generation_key" ON "score_calc_task"("eventId", "generation");
