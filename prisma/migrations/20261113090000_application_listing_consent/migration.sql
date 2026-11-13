-- Optional public-profile consent on /join. Additive: existing rows get false and no timestamp.
ALTER TABLE "ArtistApplication" ADD COLUMN "listingConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "listingConsentAt" TIMESTAMP(3),
ADD COLUMN "listingConsentVersion" TEXT;
