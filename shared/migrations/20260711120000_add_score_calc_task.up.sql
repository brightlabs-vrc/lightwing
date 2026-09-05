-- CreateTable
CREATE TABLE "score_calc_task" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "score_calc_task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "score_calc_task_status_idx" ON "score_calc_task"("status");

-- CreateIndex
CREATE INDEX "score_calc_task_nextRunAt_idx" ON "score_calc_task"("nextRunAt");

-- CreateIndex
CREATE INDEX "score_calc_task_createdAt_idx" ON "score_calc_task"("createdAt");
