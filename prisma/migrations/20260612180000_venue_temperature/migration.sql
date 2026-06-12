-- Phase 10.2c: opportunity TEMPERATURE model — HOT (deciding now) / WARM
-- (already buys entertainment) / SEED (relationship-planting). Fit and timing
-- stay separate: fitScore = the room, timingScore = the moment.

-- CreateEnum (declaration order = sort order: HOT < WARM < SEED for the feed)
CREATE TYPE "VenueTemperature" AS ENUM ('HOT', 'WARM', 'SEED');

-- Extend SignalType with the WARM-battery evidence classes.
ALTER TYPE "SignalType" ADD VALUE 'HOSTS_ENTERTAINMENT';
ALTER TYPE "SignalType" ADD VALUE 'EVENT_PROGRAM';
ALTER TYPE "SignalType" ADD VALUE 'TEAM_CONTACT';

-- Venue: temperature (existing rows are the hot scanner's finds → HOT),
-- timing score, grounded entertainment evidence, LinkedIn handoff URL.
ALTER TABLE "Venue" ADD COLUMN "temperature" "VenueTemperature" NOT NULL DEFAULT 'HOT';
ALTER TABLE "Venue" ADD COLUMN "timingScore" INTEGER;
ALTER TABLE "Venue" ADD COLUMN "entertainmentEvidence" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Venue" ADD COLUMN "linkedinUrl" TEXT;

-- VenuePitch: temperature snapshot at draft time (caps + sequencing guard).
ALTER TABLE "VenuePitch" ADD COLUMN "temperature" "VenueTemperature" NOT NULL DEFAULT 'HOT';

-- Business: warm-wheel counter (every 3rd scan fires the WARM battery).
ALTER TABLE "Business" ADD COLUMN "discoveryScanCount" INTEGER NOT NULL DEFAULT 0;
