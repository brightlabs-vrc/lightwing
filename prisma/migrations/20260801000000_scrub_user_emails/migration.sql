-- Migration: scrub_user_emails
-- Replaces all real email addresses on user accounts with a deterministic,
-- non-routable synthetic placeholder derived from the user's stable Discord ID.
-- The `.invalid` TLD is RFC-2606-reserved and will never route to a real mailbox.

UPDATE "user"
SET "email" = CONCAT(
  COALESCE(
    (
      SELECT "accountId"
      FROM "account"
      WHERE "account"."userId" = "user"."id"
        AND "account"."providerId" = 'discord'
      ORDER BY "account"."updatedAt" DESC
      LIMIT 1
    ),
    "user"."id"
  ),
  '@discord.invalid'
)
WHERE "email" NOT LIKE '%@discord.invalid';
