-- CreateEnum
CREATE TYPE "ClassTier" AS ENUM ('PRE_OP', 'OP', 'G3', 'G2', 'G1');

-- AlterTable
ALTER TABLE "user" ADD COLUMN "biography" TEXT,
ADD COLUMN "careerOverview" TEXT,
ADD COLUMN "classTier" "ClassTier";

-- AlterTable
ALTER TABLE "organization" ADD COLUMN "rankingAverage" DOUBLE PRECISION,
ADD COLUMN "pointsAverage" DOUBLE PRECISION,
ADD COLUMN "seasonRank" INTEGER,
ADD COLUMN "averagePointsPerEvent" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "organizationId" TEXT NOT NULL,
    "scoringType" SMALLINT NOT NULL,
    "classRestriction" "ClassTier",
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_member" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_schedule" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "title" TEXT,
    "startsAt" TIMESTAMP(6) NOT NULL,
    "endsAt" TIMESTAMP(6),
    "location" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_points_entry" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "event_points_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_ladder_entry" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "elo" INTEGER NOT NULL DEFAULT 1200,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "event_ladder_entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_organizationId_idx" ON "event"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "event_member_eventId_userId_key" ON "event_member"("eventId", "userId");

-- CreateIndex
CREATE INDEX "event_member_eventId_idx" ON "event_member"("eventId");

-- CreateIndex
CREATE INDEX "event_member_userId_idx" ON "event_member"("userId");

-- CreateIndex
CREATE INDEX "event_schedule_eventId_idx" ON "event_schedule"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "event_points_entry_eventId_userId_key" ON "event_points_entry"("eventId", "userId");

-- CreateIndex
CREATE INDEX "event_points_entry_eventId_idx" ON "event_points_entry"("eventId");

-- CreateIndex
CREATE INDEX "event_points_entry_userId_idx" ON "event_points_entry"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "event_ladder_entry_eventId_userId_key" ON "event_ladder_entry"("eventId", "userId");

-- CreateIndex
CREATE INDEX "event_ladder_entry_eventId_idx" ON "event_ladder_entry"("eventId");

-- CreateIndex
CREATE INDEX "event_ladder_entry_userId_idx" ON "event_ladder_entry"("userId");

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_member" ADD CONSTRAINT "event_member_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_member" ADD CONSTRAINT "event_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_schedule" ADD CONSTRAINT "event_schedule_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_points_entry" ADD CONSTRAINT "event_points_entry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_points_entry" ADD CONSTRAINT "event_points_entry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_ladder_entry" ADD CONSTRAINT "event_ladder_entry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_ladder_entry" ADD CONSTRAINT "event_ladder_entry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
