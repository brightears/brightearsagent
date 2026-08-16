-- A valid physical business mailing address is required before venue outreach.
-- Existing tenants are intentionally left NULL and fail closed until the owner
-- supplies the address in onboarding or Control Room settings.
ALTER TABLE "Business" ADD COLUMN "postalAddress" TEXT;
