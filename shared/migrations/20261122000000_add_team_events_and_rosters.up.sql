-- Add team-based event configuration columns to event
ALTER TABLE "event"
    ADD COLUMN IF NOT EXISTS "isTeamEvent" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "maxPrimaryRosterSize" INTEGER,
    ADD COLUMN IF NOT EXISTS "maxBackupRosterSize" INTEGER;

-- Create event_team table for teams registered in team-based events
CREATE TABLE IF NOT EXISTS "event_team" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "eventId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "registeredByUserId" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_team_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "event_team_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE,
    CONSTRAINT "event_team_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE,
    CONSTRAINT "event_team_registeredByUserId_fkey" FOREIGN KEY ("registeredByUserId") REFERENCES "user"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "event_team_eventId_teamId_key" ON "event_team"("eventId", "teamId");
CREATE INDEX IF NOT EXISTS "event_team_eventId_idx" ON "event_team"("eventId");
CREATE INDEX IF NOT EXISTS "event_team_teamId_idx" ON "event_team"("teamId");

-- Extend event_member with team affiliation and primary/backup roster role
ALTER TABLE "event_member"
    ADD COLUMN IF NOT EXISTS "teamId" TEXT,
    ADD COLUMN IF NOT EXISTS "rosterRole" TEXT;

DO $$ BEGIN
    ALTER TABLE "event_member"
        ADD CONSTRAINT "event_member_teamId_fkey"
        FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "event_member_eventId_teamId_idx" ON "event_member"("eventId", "teamId");
