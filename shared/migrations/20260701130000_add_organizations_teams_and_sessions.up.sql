-- CreateTable
CREATE TABLE IF NOT EXISTS "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6),

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "member" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(6) NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inviterId" TEXT NOT NULL,
    "teamId" TEXT,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL,
    "updatedAt" TIMESTAMP(6),

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "teamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teamMember_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "activeOrganizationId" TEXT;

-- AlterTable
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "activeTeamId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "organization_slug_key" ON "organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "member_organizationId_userId_key" ON "member"("organizationId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "member_organizationId_idx" ON "member"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "member_userId_idx" ON "member"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invitation_organizationId_idx" ON "invitation"("organizationId");

-- CreateIndex (guarded: the "teamId" column is removed by
-- 20260702010000, so replaying over a database where that already happened
-- must skip instead of failing on the missing column).
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invitation' AND column_name = 'teamId'
  ) THEN
    CREATE INDEX IF NOT EXISTS "invitation_teamId_idx" ON "invitation"("teamId");
  END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invitation_email_idx" ON "invitation"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "team_organizationId_idx" ON "team"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "teamMember_teamId_userId_key" ON "teamMember"("teamId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "teamMember_teamId_idx" ON "teamMember"("teamId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "teamMember_userId_idx" ON "teamMember"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "session_activeOrganizationId_idx" ON "session"("activeOrganizationId");

-- CreateIndex (guarded: "activeTeamId" is removed by 20260702010000, see above).
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'session' AND column_name = 'activeTeamId'
  ) THEN
    CREATE INDEX IF NOT EXISTS "session_activeTeamId_idx" ON "session"("activeTeamId");
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "member" ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "member" ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (guarded: no-op when "invitation"."teamId" is already gone;
-- the duplicate_object handler covers the constraint already existing).
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invitation' AND column_name = 'teamId'
  ) THEN
    ALTER TABLE "invitation" ADD CONSTRAINT "invitation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "team" ADD CONSTRAINT "team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "teamMember" ADD CONSTRAINT "teamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "teamMember" ADD CONSTRAINT "teamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

