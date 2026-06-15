-- Travel Mode: an artist's HOME BASE is Business.serviceCities; a TRAVEL
-- WINDOW ("in Lisbon Aug 4-11") makes the Hunt ALSO scan that city for those
-- dates, drafting date-bounded outreach. The window's country drives the
-- DESTINATION jurisdiction. packaging: founder decision — included for ALL
-- tiers for now (no per-tier limits on travel windows).

-- CreateEnum
CREATE TYPE "TravelWindowStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED');

-- Business: advisory Home Base radius (UI shows it; scan scoping is advisory).
ALTER TABLE "Business" ADD COLUMN "homeRadiusKm" INTEGER;

-- CreateTable
CREATE TABLE "TravelWindow" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "radiusKm" INTEGER,
    "feeOverride" INTEGER,
    "roleTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "TravelWindowStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "TravelWindow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TravelWindow_businessId_status_idx" ON "TravelWindow"("businessId", "status");

-- Venue: the travel window a venue was discovered for (null = home-base hunt).
ALTER TABLE "Venue" ADD COLUMN "travelWindowId" TEXT;

-- AddForeignKey
ALTER TABLE "TravelWindow" ADD CONSTRAINT "TravelWindow_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_travelWindowId_fkey" FOREIGN KEY ("travelWindowId") REFERENCES "TravelWindow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
