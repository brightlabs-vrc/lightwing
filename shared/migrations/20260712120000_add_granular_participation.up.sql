-- AlterTable
ALTER TABLE "event" ADD COLUMN "granularParticipation" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "race_event_member" (
    "id" TEXT NOT NULL,
    "raceEventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "race_event_member_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "race_event_member_raceEventId_userId_key" ON "race_event_member"("raceEventId", "userId");

-- CreateIndex
CREATE INDEX "race_event_member_raceEventId_idx" ON "race_event_member"("raceEventId");

-- CreateIndex
CREATE INDEX "race_event_member_userId_idx" ON "race_event_member"("userId");

-- AddForeignKey
ALTER TABLE "race_event_member" ADD CONSTRAINT "race_event_member_raceEventId_fkey" FOREIGN KEY ("raceEventId") REFERENCES "race_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "race_event_member" ADD CONSTRAINT "race_event_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
