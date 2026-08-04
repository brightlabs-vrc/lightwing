-- Convert existing PRE_OP and OP values to NULL (unrestricted/none representation)
UPDATE "user" SET "classTier" = NULL WHERE "classTier" IN ('PRE_OP', 'OP');
UPDATE "event" SET "classRestriction" = NULL WHERE "classRestriction" IN ('PRE_OP', 'OP');
UPDATE "race_event" SET "classRestriction" = NULL WHERE "classRestriction" IN ('PRE_OP', 'OP');
