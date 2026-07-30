-- Postmark delivery recovery and explicit auto-reply state.
ALTER TABLE "Message"
  ADD COLUMN "autoReply" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "bouncedAt" TIMESTAMP(3),
  ADD COLUMN "bounceType" TEXT,
  ADD COLUMN "bounceDetail" TEXT;

ALTER TABLE "Lead"
  ADD COLUMN "undeliverableAt" TIMESTAMP(3),
  ADD COLUMN "undeliverableReason" TEXT;
