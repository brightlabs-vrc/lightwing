-- CreateTable
CREATE TABLE IF NOT EXISTS "score_calc_task" (
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
CREATE INDEX IF NOT EXISTS "score_calc_task_status_idx" ON "score_calc_task"("status");

-- CreateIndex (guarded: "nextRunAt" is removed by 20260807000000, so replaying
-- over a database where that already happened must skip instead of failing on
-- the missing column).
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'score_calc_task' AND column_name = 'nextRunAt'
  ) THEN
    CREATE INDEX IF NOT EXISTS "score_calc_task_nextRunAt_idx" ON "score_calc_task"("nextRunAt");
  END IF;
END $$;

-- CreateIndex (guarded: "createdAt" is removed by 20260807000000, see above).
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'score_calc_task' AND column_name = 'createdAt'
  ) THEN
    CREATE INDEX IF NOT EXISTS "score_calc_task_createdAt_idx" ON "score_calc_task"("createdAt");
  END IF;
END $$;
