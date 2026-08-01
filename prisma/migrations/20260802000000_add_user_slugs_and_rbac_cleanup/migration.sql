-- Add user slug column as nullable
ALTER TABLE "user" ADD COLUMN "slug" TEXT;

-- Convert legacy eventAdministrator roles to explicit EventAdmin rows
INSERT INTO "event_admin" ("id", "eventId", "userId", "createdAt")
SELECT gen_random_uuid()::text, e."id", m."userId", NOW()
FROM "member" m
JOIN "event" e ON e."organizationId" = m."organizationId"
WHERE m."role" = 'eventAdministrator'
ON CONFLICT ("eventId", "userId") DO NOTHING;

-- Downgrade legacy eventAdministrator and organizationAdministrator roles to member
UPDATE "member"
SET "role" = 'member'
WHERE "role" IN ('eventAdministrator', 'organizationAdministrator');

-- Create unique index on user slug
CREATE UNIQUE INDEX "user_slug_key" ON "user"("slug");
