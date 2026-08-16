-- Durable action timestamps for beta cohorts and rolling quality reporting.
ALTER TABLE "Business"
ADD COLUMN "firstSubscribedAt" TIMESTAMP(3),
ADD COLUMN "betaStartedAt" TIMESTAMP(3);

ALTER TABLE "Venue"
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "bookedAt" TIMESTAMP(3);

CREATE INDEX "Business_firstSubscribedAt_idx"
ON "Business"("firstSubscribedAt");

CREATE INDEX "Business_betaStartedAt_idx"
ON "Business"("betaStartedAt");

-- Historical approximations are intentionally conservative and only seed
-- already-live records. All post-migration actions receive exact timestamps.
UPDATE "Business"
SET "firstSubscribedAt" = "createdAt"
WHERE "plan" <> 'TRIAL' AND "firstSubscribedAt" IS NULL;

UPDATE "Venue"
SET "reviewedAt" = "updatedAt"
WHERE "suppressedReason" IN (
  'WRONG_VIBE',
  'TOO_FAR',
  'BELOW_FEE',
  'NO_ENTERTAINMENT',
  'STALE_OR_CLOSED',
  'NOT_INTERESTED'
);

UPDATE "Venue"
SET "repliedAt" = "updatedAt"
WHERE "status" IN ('REPLIED', 'IN_CONVERSATION', 'BOOKED')
  AND "repliedAt" IS NULL;

UPDATE "Venue"
SET "bookedAt" = "updatedAt"
WHERE "status" = 'BOOKED' AND "bookedAt" IS NULL;
