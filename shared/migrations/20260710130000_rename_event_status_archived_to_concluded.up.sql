-- Rename the EventStatus enum value ARCHIVED -> CONCLUDED. Semantics are
-- unchanged; CONCLUDED is what ARCHIVED was. ALTER TYPE ... RENAME VALUE renames
-- the member in place, so every existing "event"."status" row previously set to
-- 'ARCHIVED' is atomically reflected as 'CONCLUDED' with no separate data
-- migration required. Guarded so replaying over a database where the rename
-- already happened is a no-op.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'EventStatus' AND e.enumlabel = 'ARCHIVED'
  ) THEN
    ALTER TYPE "EventStatus" RENAME VALUE 'ARCHIVED' TO 'CONCLUDED';
  END IF;
END $$;
