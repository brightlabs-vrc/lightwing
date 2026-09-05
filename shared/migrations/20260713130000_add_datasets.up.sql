-- CreateEnum (idempotent, see 20260709120000).
DO $$ BEGIN
  CREATE TYPE "DatasetStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "dataset" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "rows" INTEGER NOT NULL,
    "status" "DatasetStatus" NOT NULL DEFAULT 'PENDING',
    "importedAt" TIMESTAMP(6),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "dataset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "dataset_eventId_idx" ON "dataset"("eventId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "dataset" ADD CONSTRAINT "dataset_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
