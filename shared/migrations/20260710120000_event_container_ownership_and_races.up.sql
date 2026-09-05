-- CreateEnum (idempotent, see 20260709120000).
DO $$ BEGIN
  CREATE TYPE "EventOwnerType" AS ENUM ('ORGANIZATION', 'USER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum (idempotent, see 20260709120000).
DO $$ BEGIN
  CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'UNOFFICIAL', 'OFFICIAL', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum (idempotent, see 20260709120000).
DO $$ BEGIN
  CREATE TYPE "SiteRole" AS ENUM ('USER', 'SITE_ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "siteRole" "SiteRole" NOT NULL DEFAULT 'USER';

-- AlterTable
ALTER TABLE "event" ADD COLUMN IF NOT EXISTS "ownerType" "EventOwnerType",
ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT,
ADD COLUMN IF NOT EXISTS "status" "EventStatus" NOT NULL DEFAULT 'UNOFFICIAL';

-- Backfill: every existing event is organization-owned.
UPDATE "event" SET "ownerType" = 'ORGANIZATION' WHERE "ownerType" IS NULL;

-- AlterColumn
ALTER TABLE "event" ALTER COLUMN "ownerType" SET NOT NULL;
ALTER TABLE "event" ALTER COLUMN "organizationId" DROP NOT NULL;

-- AddCheck: exactly one owner (organization XOR user), consistent with ownerType.
-- Wrapped so replaying over a database where the check already exists is a no-op.
DO $$ BEGIN
  ALTER TABLE "event" ADD CONSTRAINT "event_owner_xor" CHECK (
      ("organizationId" IS NOT NULL AND "ownerUserId" IS NULL AND "ownerType" = 'ORGANIZATION')
      OR
      ("organizationId" IS NULL AND "ownerUserId" IS NOT NULL AND "ownerType" = 'USER')
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "race_event" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "distanceMeters" INTEGER NOT NULL,
    "trackType" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "scoringType" SMALLINT,
    "classRestriction" "ClassTier",
    "startsAt" TIMESTAMP(6),
    "endsAt" TIMESTAMP(6),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "race_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "race_result" (
    "id" TEXT NOT NULL,
    "raceEventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" INTEGER,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "race_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "event_admin" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_admin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "event_ownerUserId_idx" ON "event"("ownerUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "race_event_eventId_idx" ON "race_event"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "race_result_raceEventId_userId_key" ON "race_result"("raceEventId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "race_result_raceEventId_idx" ON "race_result"("raceEventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "race_result_userId_idx" ON "race_result"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "event_admin_eventId_userId_key" ON "event_admin"("eventId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "event_admin_eventId_idx" ON "event_admin"("eventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "event_admin_userId_idx" ON "event_admin"("userId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "event" ADD CONSTRAINT "event_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "race_event" ADD CONSTRAINT "race_event_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "race_result" ADD CONSTRAINT "race_result_raceEventId_fkey" FOREIGN KEY ("raceEventId") REFERENCES "race_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "race_result" ADD CONSTRAINT "race_result_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "event_admin" ADD CONSTRAINT "event_admin_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "event_admin" ADD CONSTRAINT "event_admin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
