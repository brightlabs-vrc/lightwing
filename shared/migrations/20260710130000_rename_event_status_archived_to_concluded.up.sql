-- Rename the EventStatus enum value ARCHIVED -> CONCLUDED. Semantics are
-- unchanged; CONCLUDED is what ARCHIVED was. ALTER TYPE ... RENAME VALUE renames
-- the member in place, so every existing "event"."status" row previously set to
-- 'ARCHIVED' is atomically reflected as 'CONCLUDED' with no separate data
-- migration required.
ALTER TYPE "EventStatus" RENAME VALUE 'ARCHIVED' TO 'CONCLUDED';
