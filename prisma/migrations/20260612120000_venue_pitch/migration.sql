-- Phase 10.3: venue pitch drafts — VenuePitch + VenuePitchStatus.

-- CreateEnum
CREATE TYPE "VenuePitchStatus" AS ENUM ('PENDING', 'APPROVED', 'DISCARDED', 'SENT', 'EXPIRED');

-- CreateTable
CREATE TABLE "VenuePitch" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "status" "VenuePitchStatus" NOT NULL DEFAULT 'PENDING',
    "jurisdictionMode" TEXT NOT NULL,
    "model" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "editedSubject" TEXT,
    "editedBody" TEXT,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "VenuePitch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VenuePitch_venueId_idx" ON "VenuePitch"("venueId");

-- CreateIndex
CREATE INDEX "VenuePitch_businessId_status_idx" ON "VenuePitch"("businessId", "status");

-- AddForeignKey
ALTER TABLE "VenuePitch" ADD CONSTRAINT "VenuePitch_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenuePitch" ADD CONSTRAINT "VenuePitch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
