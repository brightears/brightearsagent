-- Reactive reply feedback: persist edited subjects, structured rejection
-- reasons, and the explicit voice-example opt-in receipt.
ALTER TABLE "Draft"
ADD COLUMN "editedSubject" TEXT,
ADD COLUMN "rejectionReason" TEXT,
ADD COLUMN "voiceSampleSavedAt" TIMESTAMP(3);

-- Proactive pitch feedback: structured discard reason and explicit
-- voice-example opt-in receipt. editedSubject/editedBody already exist.
ALTER TABLE "VenuePitch"
ADD COLUMN "discardReason" TEXT,
ADD COLUMN "voiceSampleSavedAt" TIMESTAMP(3);
