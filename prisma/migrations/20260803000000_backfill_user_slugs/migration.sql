-- SQL backfill script to populate missing user slugs deterministically and collision-free within 24 characters limit
UPDATE "user"
SET "slug" = 'u' || RIGHT(LOWER(REGEXP_REPLACE(COALESCE(
  (SELECT "accountId" FROM "account" WHERE "userId" = "user"."id" AND "providerId" = 'discord' LIMIT 1),
  "user"."id"
), '[^a-zA-Z0-9]', '', 'g')), 23)
WHERE "user"."slug" IS NULL;
