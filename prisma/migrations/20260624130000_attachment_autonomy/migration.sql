-- Smart-attachment autonomy (June 2026). Per-artist toggles for auto-attaching
-- the press kit / a quote, and per-draft intent flags the drafter sets from the
-- inquiry (does the client want a profile / a price?). Both default false/off:
-- conservative — a binding quote never goes out unless the artist opted in.
ALTER TABLE "Business" ADD COLUMN     "autoAttachProfile" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoAttachQuote" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Draft" ADD COLUMN     "wantsProfile" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "wantsQuote" BOOLEAN NOT NULL DEFAULT false;
