-- CreateEnum (idempotent: skips if the type already exists, e.g. on a
-- database originally created by Prisma, which this migration history replays).
DO $$ BEGIN
  CREATE TYPE "ClassTier" AS ENUM ('PRE_OP', 'OP', 'G3', 'G2', 'G1');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "biography" TEXT,
ADD COLUMN IF NOT EXISTS "careerOverview" TEXT,
ADD COLUMN IF NOT EXISTS "classTier" "ClassTier";

-- AlterTable
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "rankingAverage" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "pointsAverage" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "seasonRank" INTEGER,
ADD COLUMN IF NOT EXISTS "averagePointsPerEvent" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE IF NOT EXISTS "event" (
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
CREATE TABLE IF NOT EXISTS "event_member" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "event_schedule" (
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
CREATE TABLE IF NOT EXISTS "event_points_entry" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "event_points_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "event_ladder_entry" (
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
CREATE INDEX IF NOT EXISTS "event_organizationId_idx" ON "event"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "event_member_eventId_userId_key" ON "event_member"("eventId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "event_member_eventId_idx" ON "event_member"("eventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "event_member_userId_idx" ON "event_member"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "event_schedule_eventId_idx" ON "event_schedule"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "event_points_entry_eventId_userId_key" ON "event_points_entry"("eventId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "event_points_entry_eventId_idx" ON "event_points_entry"("eventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "event_points_entry_userId_idx" ON "event_points_entry"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "event_ladder_entry_eventId_userId_key" ON "event_ladder_entry"("eventId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "event_ladder_entry_eventId_idx" ON "event_ladder_entry"("eventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "event_ladder_entry_userId_idx" ON "event_ladder_entry"("userId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "event" ADD CONSTRAINT "event_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "event_member" ADD CONSTRAINT "event_member_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "event_member" ADD CONSTRAINT "event_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "event_schedule" ADD CONSTRAINT "event_schedule_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "event_points_entry" ADD CONSTRAINT "event_points_entry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "event_points_entry" ADD CONSTRAINT "event_points_entry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "event_ladder_entry" ADD CONSTRAINT "event_ladder_entry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "event_ladder_entry" ADD CONSTRAINT "event_ladder_entry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
