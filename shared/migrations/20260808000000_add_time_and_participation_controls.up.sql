-- AlterTable
ALTER TABLE "event" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3),
                    ADD COLUMN IF NOT EXISTS "participantLimit" INTEGER,
                    ADD COLUMN IF NOT EXISTS "maxConcurrentRaceParticipations" INTEGER;

-- AlterTable
ALTER TABLE "race_event" ADD COLUMN IF NOT EXISTS "participantLimit" INTEGER;

-- Add DB constraints
DO $$ BEGIN
  ALTER TABLE "event" ADD CONSTRAINT "chk_event_participantLimit" CHECK ("participantLimit" IS NULL OR "participantLimit" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "event" ADD CONSTRAINT "chk_event_maxConcurrentRaceParticipations" CHECK ("maxConcurrentRaceParticipations" IS NULL OR "maxConcurrentRaceParticipations" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "race_event" ADD CONSTRAINT "chk_race_event_participantLimit" CHECK ("participantLimit" IS NULL OR "participantLimit" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Preserve the existing event schedule when introducing the event-level
-- scheduledAt field. Events without a schedule remain unset, and the
-- participant limits intentionally remain NULL to preserve unlimited signup
-- behavior for existing events and races.
WITH first_schedules AS (
    SELECT DISTINCT ON ("eventId")
        "eventId",
        "startsAt"
    FROM "event_schedule"
    WHERE "startsAt" IS NOT NULL
    ORDER BY "eventId", "startsAt", "id"
)
UPDATE "event" AS event
SET "scheduledAt" = first_schedules."startsAt"
FROM first_schedules
WHERE event."id" = first_schedules."eventId"
  AND event."scheduledAt" IS NULL;
