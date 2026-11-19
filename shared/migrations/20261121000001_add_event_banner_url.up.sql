-- Add bannerUrl column to event table
ALTER TABLE "event" ADD COLUMN IF NOT EXISTS "bannerUrl" TEXT;
