-- CreateTable: organization_newsletter
CREATE TABLE IF NOT EXISTS "organization_newsletter" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "thumbnailUrl" TEXT,
    "content" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(6),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_newsletter_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "organization_newsletter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "organization_newsletter_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "organization_newsletter_org_status_pub_idx"
    ON "organization_newsletter"("organizationId", "status", "publishedAt" DESC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "organization_newsletter_status_pub_idx"
    ON "organization_newsletter"("status", "publishedAt" DESC, "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "organization_newsletter_org_slug_key"
    ON "organization_newsletter"("organizationId", "slug");
