-- CreateEnum
CREATE TYPE "EventOwnerType" AS ENUM ('ORGANIZATION', 'USER');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'UNOFFICIAL', 'OFFICIAL', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SiteRole" AS ENUM ('USER', 'SITE_ADMIN');

-- AlterTable
ALTER TABLE "user" ADD COLUMN "siteRole" "SiteRole" NOT NULL DEFAULT 'USER';

-- AlterTable
ALTER TABLE "event" ADD COLUMN "ownerType" "EventOwnerType",
ADD COLUMN "ownerUserId" TEXT,
ADD COLUMN "status" "EventStatus" NOT NULL DEFAULT 'UNOFFICIAL';

-- Backfill: every existing event is organization-owned.
UPDATE "event" SET "ownerType" = 'ORGANIZATION' WHERE "ownerType" IS NULL;

-- AlterColumn
ALTER TABLE "event" ALTER COLUMN "ownerType" SET NOT NULL;
ALTER TABLE "event" ALTER COLUMN "organizationId" DROP NOT NULL;

-- AddCheck: exactly one owner (organization XOR user), consistent with ownerType.
ALTER TABLE "event" ADD CONSTRAINT "event_owner_xor" CHECK (
    ("organizationId" IS NOT NULL AND "ownerUserId" IS NULL AND "ownerType" = 'ORGANIZATION')
    OR
    ("organizationId" IS NULL AND "ownerUserId" IS NOT NULL AND "ownerType" = 'USER')
);

-- CreateTable
CREATE TABLE "race_event" (
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
CREATE TABLE "race_result" (
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
CREATE TABLE "event_admin" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_admin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_ownerUserId_idx" ON "event"("ownerUserId");

-- CreateIndex
CREATE INDEX "race_event_eventId_idx" ON "race_event"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "race_result_raceEventId_userId_key" ON "race_result"("raceEventId", "userId");

-- CreateIndex
CREATE INDEX "race_result_raceEventId_idx" ON "race_result"("raceEventId");

-- CreateIndex
CREATE INDEX "race_result_userId_idx" ON "race_result"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "event_admin_eventId_userId_key" ON "event_admin"("eventId", "userId");

-- CreateIndex
CREATE INDEX "event_admin_eventId_idx" ON "event_admin"("eventId");

-- CreateIndex
CREATE INDEX "event_admin_userId_idx" ON "event_admin"("userId");

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "race_event" ADD CONSTRAINT "race_event_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "race_result" ADD CONSTRAINT "race_result_raceEventId_fkey" FOREIGN KEY ("raceEventId") REFERENCES "race_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "race_result" ADD CONSTRAINT "race_result_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_admin" ADD CONSTRAINT "event_admin_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_admin" ADD CONSTRAINT "event_admin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
