-- Onboarding redesign (June 2026): structured "how the artist works" dials that
-- replace the event-typed package builder. Non-narrowing matching/pitch signals,
-- kept strictly separate from the USD subscription billing.
--   gigTypes      — "one-off" and/or "residency" (multi-select; "both" = both present)
--   acceptsTravel — structured travel-willingness signal read by venue scoring
--   residencyRate — cents; per-night going rate for a regular slot (≠ one-off feeFloor)
ALTER TABLE "Business" ADD COLUMN     "gigTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "acceptsTravel" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "residencyRate" INTEGER;
