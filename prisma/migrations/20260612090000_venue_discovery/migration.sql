-- Phase 10.2: venue discovery — Venue, VenueSignal, OutreachSuppression.

-- CreateEnum
CREATE TYPE "VenueKind" AS ENUM ('BAR', 'ROOFTOP', 'HOTEL', 'RESTAURANT', 'EVENT_SPACE', 'CLUB', 'OTHER');

-- CreateEnum
CREATE TYPE "VenueStatus" AS ENUM ('DISCOVERED', 'QUALIFIED', 'PITCH_DRAFTED', 'PITCHED', 'REPLIED', 'IN_CONVERSATION', 'BOOKED', 'DEAD', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('NEW_OPENING', 'OPENING_SOON', 'HIRING', 'NEW_SOCIAL', 'PRESS', 'MANUAL');

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "kind" "VenueKind" NOT NULL DEFAULT 'OTHER',
    "website" TEXT,
    "instagram" TEXT,
    "bookingEmail" TEXT,
    "bookingContactName" TEXT,
    "contactSource" TEXT,
    "status" "VenueStatus" NOT NULL DEFAULT 'DISCOVERED',
    "fitScore" INTEGER,
    "fitReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "caution" TEXT,
    "lastSignalAt" TIMESTAMP(3),
    "pitchedAt" TIMESTAMP(3),
    "suppressedReason" TEXT,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueSignal" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "type" "SignalType" NOT NULL,
    "summary" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachSuppression" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachSuppression_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Venue_businessId_name_city_key" ON "Venue"("businessId", "name", "city");

-- CreateIndex
CREATE INDEX "Venue_businessId_status_idx" ON "Venue"("businessId", "status");

-- CreateIndex
CREATE INDEX "Venue_businessId_fitScore_idx" ON "Venue"("businessId", "fitScore");

-- CreateIndex
CREATE INDEX "VenueSignal_venueId_idx" ON "VenueSignal"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachSuppression_businessId_email_key" ON "OutreachSuppression"("businessId", "email");

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueSignal" ADD CONSTRAINT "VenueSignal_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachSuppression" ADD CONSTRAINT "OutreachSuppression_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
