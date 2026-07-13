-- CreateEnum
CREATE TYPE "DatasetStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "dataset" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "rows" INTEGER NOT NULL DEFAULT 0,
    "status" "DatasetStatus" NOT NULL DEFAULT 'PENDING',
    "importedAt" TIMESTAMP(6),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "dataset_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "dataset" ADD CONSTRAINT "dataset_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "dataset_eventId_idx" ON "dataset" ("eventId");
