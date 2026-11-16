-- Catalogue profiles for consented applicants, and the desk's action log. Additive.
CREATE TABLE "CatalogueProfile" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "applicationRef" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "stageName" TEXT NOT NULL,
    "actLabelEn" TEXT NOT NULL,
    "actLabelTh" TEXT NOT NULL,
    "actType" TEXT NOT NULL,
    "actTags" TEXT[],
    "bioEn" TEXT NOT NULL,
    "bioTh" TEXT NOT NULL,
    "genres" TEXT[],
    "basedIn" TEXT NOT NULL,
    "links" JSONB NOT NULL,
    "photoBytes" BYTEA NOT NULL,
    "photoType" TEXT NOT NULL,
    "photoSha256" TEXT NOT NULL,
    "photoCredit" TEXT,
    "playedForBrightEars" BOOLEAN NOT NULL DEFAULT false,
    "previewTokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "CatalogueProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogueProfileEvent" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogueProfileEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CatalogueProfile_slug_key" ON "CatalogueProfile"("slug");
CREATE UNIQUE INDEX "CatalogueProfile_previewTokenHash_key" ON "CatalogueProfile"("previewTokenHash");
CREATE INDEX "CatalogueProfile_status_idx" ON "CatalogueProfile"("status");
CREATE INDEX "CatalogueProfileEvent_slug_at_idx" ON "CatalogueProfileEvent"("slug", "at");
