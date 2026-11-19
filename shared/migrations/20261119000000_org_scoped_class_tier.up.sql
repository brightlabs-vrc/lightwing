-- CreateTable: org-scoped class tiers
CREATE TABLE IF NOT EXISTS "org_class_tier" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "classTier" "ClassTier",
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_class_tier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "org_class_tier_organizationId_userId_key" ON "org_class_tier"("organizationId", "userId");
CREATE INDEX IF NOT EXISTS "org_class_tier_organizationId_idx" ON "org_class_tier"("organizationId");
CREATE INDEX IF NOT EXISTS "org_class_tier_userId_idx" ON "org_class_tier"("userId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "org_class_tier" ADD CONSTRAINT "org_class_tier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "org_class_tier" ADD CONSTRAINT "org_class_tier_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "org_class_tier" ADD CONSTRAINT "org_class_tier_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill: copy existing non-null user.classTier into org_class_tier for every
-- organization where the user is a member or has participated in an event.
INSERT INTO "org_class_tier" ("organizationId", "userId", "classTier")
SELECT DISTINCT org_users."organizationId", u.id, u."classTier"
FROM "user" u
JOIN (
    SELECT "organizationId", "userId" FROM "member"
    UNION
    SELECT e."organizationId", em."userId"
    FROM "event_member" em
    JOIN "event" e ON e.id = em."eventId"
    WHERE e."organizationId" IS NOT NULL
) org_users ON org_users."userId" = u.id
WHERE u."classTier" IS NOT NULL AND u."classTier" NOT IN ('PRE_OP', 'OP')
ON CONFLICT ("organizationId", "userId") DO NOTHING;
