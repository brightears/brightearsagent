-- Public artist applications (/join). Additive: no existing table changes.
CREATE TABLE "ArtistApplication" (
    "id" TEXT NOT NULL,
    "submissionKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locale" TEXT NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "actType" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "utm" JSONB,
    "status" TEXT NOT NULL DEFAULT 'new',
    "clientHash" TEXT,
    "exportedAt" TIMESTAMP(3),
    "exportReference" TEXT,
    CONSTRAINT "ArtistApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ArtistApplicationPhoto" (
    "applicationId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    CONSTRAINT "ArtistApplicationPhoto_pkey" PRIMARY KEY ("applicationId")
);

CREATE UNIQUE INDEX "ArtistApplication_submissionKey_key" ON "ArtistApplication"("submissionKey");
CREATE INDEX "ArtistApplication_exportedAt_createdAt_idx" ON "ArtistApplication"("exportedAt", "createdAt");
CREATE INDEX "ArtistApplication_clientHash_createdAt_idx" ON "ArtistApplication"("clientHash", "createdAt");
CREATE INDEX "ArtistApplication_createdAt_idx" ON "ArtistApplication"("createdAt");

ALTER TABLE "ArtistApplicationPhoto" ADD CONSTRAINT "ArtistApplicationPhoto_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "ArtistApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
