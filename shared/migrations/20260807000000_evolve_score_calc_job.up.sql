-- DropIndex
DROP INDEX "score_calc_task_createdAt_idx";

-- DropIndex
DROP INDEX "score_calc_task_nextRunAt_idx";

-- DropIndex
DROP INDEX "score_calc_task_status_idx";

-- Add the new columns before removing the legacy columns so existing jobs can
-- be migrated into per-event generations without colliding on the new key.
ALTER TABLE "score_calc_task"
ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "completedAt" TIMESTAMP(6),
ADD COLUMN     "generation" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "requestedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "requestedUserIds" JSONB,
ADD COLUMN     "resultChecksum" TEXT,
ADD COLUMN     "startedAt" TIMESTAMP(6);

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

-- CreateTable
CREATE TABLE "score_calc_state" (
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
GROUP BY "eventId";

-- Remove legacy columns after their values have been migrated.
ALTER TABLE "score_calc_task"
DROP COLUMN "createdAt",
DROP COLUMN "nextRunAt",
DROP COLUMN "retryCount",
DROP COLUMN "updatedAt",
DROP COLUMN "userId",
ALTER COLUMN "status" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "score_calc_task_eventId_generation_idx" ON "score_calc_task"("eventId", "generation");

-- CreateIndex
CREATE INDEX "score_calc_task_status_requestedAt_idx" ON "score_calc_task"("status", "requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "score_calc_task_eventId_generation_key" ON "score_calc_task"("eventId", "generation");
