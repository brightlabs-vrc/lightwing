-- AlterTable
ALTER TABLE "event" ADD COLUMN IF NOT EXISTS "granularParticipation" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "race_event_member" (
    "id" TEXT NOT NULL,
    "raceEventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "race_event_member_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "race_event_member_raceEventId_userId_key" ON "race_event_member"("raceEventId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "race_event_member_raceEventId_idx" ON "race_event_member"("raceEventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "race_event_member_userId_idx" ON "race_event_member"("userId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "race_event_member" ADD CONSTRAINT "race_event_member_raceEventId_fkey" FOREIGN KEY ("raceEventId") REFERENCES "race_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "race_event_member" ADD CONSTRAINT "race_event_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
