-- Add description column to organization and team tables
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "team" ADD COLUMN IF NOT EXISTS "description" TEXT;
