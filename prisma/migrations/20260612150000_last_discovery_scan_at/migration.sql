-- Phase 10.2b: per-tenant discovery-scan budget guard (refuse if < 20h since last scan)
ALTER TABLE "Business" ADD COLUMN "lastDiscoveryScanAt" TIMESTAMP(3);
