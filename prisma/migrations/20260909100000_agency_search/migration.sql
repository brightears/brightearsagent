CREATE TABLE "AgencySearchCache" ("key" TEXT NOT NULL PRIMARY KEY, "payload" JSONB, "expiresAt" TIMESTAMP(3) NOT NULL, "leaseUntil" TIMESTAMP(3) NOT NULL);
CREATE INDEX "AgencySearchCache_expiresAt_idx" ON "AgencySearchCache"("expiresAt");
CREATE TABLE "AgencySearchBudget" ("key" TEXT NOT NULL PRIMARY KEY, "used" INTEGER NOT NULL DEFAULT 0, "expiresAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "AgencySearchBudget_expiresAt_idx" ON "AgencySearchBudget"("expiresAt");
