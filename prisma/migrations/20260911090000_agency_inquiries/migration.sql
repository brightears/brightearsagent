CREATE TABLE "AgencyInquiry" (
    "id" TEXT NOT NULL,
    "submissionKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locale" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "brief" JSONB NOT NULL,
    "clientHash" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),
    "handoffReference" TEXT,
    CONSTRAINT "AgencyInquiry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AgencyInquiry_submissionKey_key" ON "AgencyInquiry"("submissionKey");
CREATE INDEX "AgencyInquiry_acknowledgedAt_createdAt_idx" ON "AgencyInquiry"("acknowledgedAt", "createdAt");
CREATE INDEX "AgencyInquiry_clientHash_createdAt_idx" ON "AgencyInquiry"("clientHash", "createdAt");
CREATE INDEX "AgencyInquiry_createdAt_idx" ON "AgencyInquiry"("createdAt");
