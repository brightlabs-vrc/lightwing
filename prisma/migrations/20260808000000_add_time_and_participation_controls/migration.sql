-- AlterTable
ALTER TABLE "event" ADD COLUMN "scheduledAt" TIMESTAMP(3),
                    ADD COLUMN "participantLimit" INTEGER,
                    ADD COLUMN "maxConcurrentRaceParticipations" INTEGER;

-- AlterTable
ALTER TABLE "race_event" ADD COLUMN "participantLimit" INTEGER;

-- Add DB constraints
ALTER TABLE "event" ADD CONSTRAINT "chk_event_participantLimit" CHECK ("participantLimit" IS NULL OR "participantLimit" > 0);
ALTER TABLE "event" ADD CONSTRAINT "chk_event_maxConcurrentRaceParticipations" CHECK ("maxConcurrentRaceParticipations" IS NULL OR "maxConcurrentRaceParticipations" > 0);

ALTER TABLE "race_event" ADD CONSTRAINT "chk_race_event_participantLimit" CHECK ("participantLimit" IS NULL OR "participantLimit" > 0);
