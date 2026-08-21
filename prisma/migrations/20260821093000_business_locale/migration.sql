-- Persist the owner's UI/notification language so background jobs do not have
-- to guess from a browser cookie. Kept as a validated string rather than a
-- database enum so adding the next locale does not require an enum rewrite.
ALTER TABLE "Business" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';
