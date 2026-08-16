-- Add durable contact-enrichment queue state. Existing venues start as
-- never-attempted so the first post-deploy passes rotate through the backlog.
CREATE TYPE "ContactEnrichmentState" AS ENUM (
  'IN_PROGRESS',
  'NOT_FOUND',
  'ERROR',
  'FOUND_GENERIC',
  'FOUND_DIRECT',
  'SUPPRESSED'
);

ALTER TABLE "Venue"
ADD COLUMN "contactAttemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "contactLastAttemptAt" TIMESTAMP(3),
ADD COLUMN "contactRetryAfter" TIMESTAMP(3),
ADD COLUMN "contactExhaustedAt" TIMESTAMP(3),
ADD COLUMN "contactState" "ContactEnrichmentState";

CREATE INDEX "Venue_contact_queue_idx"
ON "Venue"(
  "businessId",
  "status",
  "contactAttemptCount",
  "contactRetryAfter",
  "fitScore",
  "id"
);

-- Existing saved contacts were found before queue state existed. Classify
-- them once so generic addresses remain eligible for slow direct-contact
-- upgrades while direct booking/events inboxes are settled.
UPDATE "Venue"
SET
  "contactAttemptCount" = 1,
  "contactLastAttemptAt" = "updatedAt",
  "contactState" = CASE
    WHEN lower(split_part("bookingEmail", '@', 1)) ~ '(event|booking|privatehire|private-hire|function|venuehire|parties)'
      THEN 'FOUND_DIRECT'::"ContactEnrichmentState"
    ELSE 'FOUND_GENERIC'::"ContactEnrichmentState"
  END,
  "contactRetryAfter" = CASE
    WHEN lower(split_part("bookingEmail", '@', 1)) ~ '(event|booking|privatehire|private-hire|function|venuehire|parties)'
      THEN NULL
    ELSE CURRENT_TIMESTAMP + INTERVAL '30 days'
  END
WHERE "bookingEmail" IS NOT NULL;
