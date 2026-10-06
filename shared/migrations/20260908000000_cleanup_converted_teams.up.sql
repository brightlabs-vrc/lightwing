-- Migration: Remove duplicate teams that were migrated to converted organizations

-- 1. Copy any missing teamMember entries for teams that correspond to organizations to the member table
INSERT INTO "member" (id, "organizationId", "userId", role)
SELECT gen_random_uuid()::text, o.id, tm."userId", tm.role
FROM "teamMember" tm
JOIN "team" t ON tm."teamId" = t.id
JOIN "organization" o ON (o.id = t.id OR o.slug = t.slug OR o.slug = t.slug || '-org')
WHERE NOT EXISTS (
    SELECT 1 FROM "member" m WHERE m."organizationId" = o.id AND m."userId" = tm."userId"
)
ON CONFLICT DO NOTHING;

-- Also check teamOrganization links
INSERT INTO "member" (id, "organizationId", "userId", role)
SELECT gen_random_uuid()::text, tor."organizationId", tm."userId", tm.role
FROM "teamMember" tm
JOIN "teamOrganization" tor ON tm."teamId" = tor."teamId"
WHERE NOT EXISTS (
    SELECT 1 FROM "member" m WHERE m."organizationId" = tor."organizationId" AND m."userId" = tm."userId"
)
ON CONFLICT DO NOTHING;

-- 2. Delete teamOrganization records for teams that correspond to converted organizations
DELETE FROM "teamOrganization"
WHERE "teamId" IN (
    SELECT t.id FROM "team" t
    WHERE EXISTS (
        SELECT 1 FROM "organization" o
        WHERE o.id = t.id OR o.slug = t.slug OR o.slug = t.slug || '-org'
    )
    OR EXISTS (
        SELECT 1 FROM "teamOrganization" tor
        JOIN "organization" o ON tor."organizationId" = o.id
        WHERE tor."teamId" = t.id AND o."orgType" = 'ORGANIZATION'
    )
);

-- 3. Delete teamMember records for converted duplicate teams
DELETE FROM "teamMember"
WHERE "teamId" IN (
    SELECT t.id FROM "team" t
    WHERE EXISTS (
        SELECT 1 FROM "organization" o
        WHERE o.id = t.id OR o.slug = t.slug OR o.slug = t.slug || '-org'
    )
);

-- 4. Delete converted duplicate teams from team table
DELETE FROM "team"
WHERE id IN (
    SELECT t.id FROM "team" t
    WHERE EXISTS (
        SELECT 1 FROM "organization" o
        WHERE o.id = t.id OR o.slug = t.slug OR o.slug = t.slug || '-org'
    )
);

-- 5. Restore org slugs if they were suffixed with '-org' due to previous slug collisions with team rows
UPDATE "organization" o
SET slug = substring(o.slug from 1 for length(o.slug) - 4),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE o.slug LIKE '%-org'
  AND NOT EXISTS (
    SELECT 1 FROM "organization" o2 WHERE o2.slug = substring(o.slug from 1 for length(o.slug) - 4)
  )
  AND NOT EXISTS (
    SELECT 1 FROM "team" t2 WHERE t2.slug = substring(o.slug from 1 for length(o.slug) - 4)
  );
