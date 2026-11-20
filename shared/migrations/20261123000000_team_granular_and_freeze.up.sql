-- Add per-team-per-race limit for team events (especially granular team events)
ALTER TABLE "race_event"
    ADD COLUMN IF NOT EXISTS "maxMembersPerTeam" INTEGER;

-- Preserve historical team affiliation snapshots on event_member so concluded events
-- remain immutable even if a racer switches teams or a team is later renamed/deleted.
ALTER TABLE "event_member"
    ADD COLUMN IF NOT EXISTS "teamNameSnapshot" TEXT,
    ADD COLUMN IF NOT EXISTS "teamSlugSnapshot" TEXT;

-- Backfill snapshots for any existing team event_member rows
UPDATE "event_member" em
SET
    "teamNameSnapshot" = t.name,
    "teamSlugSnapshot" = t.slug
FROM "team" t
WHERE em."teamId" = t.id
  AND (em."teamNameSnapshot" IS NULL OR em."teamSlugSnapshot" IS NULL);

-- Switch event_member.teamId FK from ON DELETE CASCADE to ON DELETE SET NULL
-- so historical event participation records are never destroyed if a team is deleted.
DO $$ BEGIN
    ALTER TABLE "event_member" DROP CONSTRAINT IF EXISTS "event_member_teamId_fkey";
    ALTER TABLE "event_member"
        ADD CONSTRAINT "event_member_teamId_fkey"
        FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
