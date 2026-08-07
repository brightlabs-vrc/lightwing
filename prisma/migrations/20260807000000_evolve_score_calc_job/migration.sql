-- DropIndex
DROP INDEX "score_calc_task_createdAt_idx";

-- DropIndex
DROP INDEX "score_calc_task_nextRunAt_idx";

-- DropIndex
DROP INDEX "score_calc_task_status_idx";

-- AlterTable
ALTER TABLE "score_calc_task" DROP COLUMN "createdAt",
DROP COLUMN "nextRunAt",
DROP COLUMN "retryCount",
DROP COLUMN "updatedAt",
DROP COLUMN "userId",
ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "completedAt" TIMESTAMP(6),
ADD COLUMN     "generation" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "requestedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "requestedUserIds" JSONB,
ADD COLUMN     "resultChecksum" TEXT,
ADD COLUMN     "startedAt" TIMESTAMP(6),
ALTER COLUMN "status" DROP DEFAULT;

-- CreateTable
CREATE TABLE "score_calc_state" (
    "eventId" TEXT NOT NULL,
    "latestGeneration" INTEGER NOT NULL,
    "acceptedGeneration" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "score_calc_state_pkey" PRIMARY KEY ("eventId")
);

-- CreateIndex
CREATE INDEX "score_calc_task_eventId_generation_idx" ON "score_calc_task"("eventId", "generation");

-- CreateIndex
CREATE INDEX "score_calc_task_status_requestedAt_idx" ON "score_calc_task"("status", "requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "score_calc_task_eventId_generation_key" ON "score_calc_task"("eventId", "generation");
