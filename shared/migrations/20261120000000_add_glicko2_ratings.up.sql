-- Add per-race rating tracking columns to race_result
ALTER TABLE "race_result"
  ADD COLUMN IF NOT EXISTS "ratingBefore" INTEGER,
  ADD COLUMN IF NOT EXISTS "ratingAfter" INTEGER,
  ADD COLUMN IF NOT EXISTS "ratingDelta" INTEGER,
  ADD COLUMN IF NOT EXISTS "rdAfter" INTEGER;

-- Create per-user, per-season rating snapshot table
CREATE TABLE IF NOT EXISTS "user_rating_snapshot" (
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1500,
    "ratingDeviation" INTEGER NOT NULL DEFAULT 350,
    "ratingVolatility" DOUBLE PRECISION NOT NULL DEFAULT 0.06,
    "peakRating" INTEGER NOT NULL DEFAULT 1500,
    "seasonRatingDelta" INTEGER NOT NULL DEFAULT 0,
    "ratedRaces" INTEGER NOT NULL DEFAULT 0,
    "isProvisional" BOOLEAN NOT NULL DEFAULT TRUE,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_rating_snapshot_pkey" PRIMARY KEY ("userId", "year")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_rating_snapshot_year_rating_idx"
  ON "user_rating_snapshot"("year", "rating" DESC);

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "user_rating_snapshot"
    ADD CONSTRAINT "user_rating_snapshot_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
