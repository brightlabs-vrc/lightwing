-- Add EVENT_ADMIN enum value to SiteRole if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SiteRole') THEN
        ALTER TYPE "SiteRole" ADD VALUE IF NOT EXISTS 'EVENT_ADMIN';
    END IF;
END $$;

-- Recreate team table
CREATE TABLE IF NOT EXISTS "team" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "submittedByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(6),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6),

    CONSTRAINT "team_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "team_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "user"("id") ON DELETE SET NULL,
    CONSTRAINT "team_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "user"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "team_slug_key" ON "team"("slug");

-- Recreate teamMember table
CREATE TABLE IF NOT EXISTS "teamMember" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT DEFAULT 'member',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teamMember_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "teamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE,
    CONSTRAINT "teamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "teamMember_teamId_userId_key" ON "teamMember"("teamId", "userId");
CREATE INDEX IF NOT EXISTS "teamMember_teamId_idx" ON "teamMember"("teamId");
CREATE INDEX IF NOT EXISTS "teamMember_userId_idx" ON "teamMember"("userId");

-- Create teamOrganization join table
CREATE TABLE IF NOT EXISTS "teamOrganization" (
    "teamId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teamOrganization_pkey" PRIMARY KEY ("teamId", "organizationId"),
    CONSTRAINT "teamOrganization_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE,
    CONSTRAINT "teamOrganization_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "teamOrganization_teamId_isPrimary_key" ON "teamOrganization"("teamId") WHERE "isPrimary" = true;
CREATE INDEX IF NOT EXISTS "teamOrganization_teamId_idx" ON "teamOrganization"("teamId");
CREATE INDEX IF NOT EXISTS "teamOrganization_organizationId_idx" ON "teamOrganization"("organizationId");

-- Add columns to organization table
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "orgType" TEXT DEFAULT 'ORGANIZATION';
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'APPROVED';
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "discordInvite" TEXT;
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "vrchatGroupId" TEXT;
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "submittedByUserId" TEXT;
