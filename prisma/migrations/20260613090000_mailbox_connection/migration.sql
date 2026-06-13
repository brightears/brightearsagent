-- Phase 10.5: own-mailbox sending (Gmail OAuth, ADR-004 D4). Proactive venue
-- pitches send from the artist's own inbox, never from shared Postmark infra.
-- Tokens are stored ENCRYPTED ONLY (AES-256-GCM, lib/crypto/tokens.ts).

-- CreateEnum
CREATE TYPE "MailboxProvider" AS ENUM ('GOOGLE', 'MICROSOFT');
CREATE TYPE "MailboxStatus" AS ENUM ('CONNECTED', 'REVOKED', 'ERROR');

-- CreateTable: one connected sending mailbox per tenant (1:1 with Business).
CREATE TABLE "MailboxConnection" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "provider" "MailboxProvider" NOT NULL DEFAULT 'GOOGLE',
    "email" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "status" "MailboxStatus" NOT NULL DEFAULT 'CONNECTED',
    "lastError" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailboxConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: one mailbox per tenant.
CREATE UNIQUE INDEX "MailboxConnection_businessId_key" ON "MailboxConnection"("businessId");

-- AddForeignKey
ALTER TABLE "MailboxConnection" ADD CONSTRAINT "MailboxConnection_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- VenuePitch: send provenance — delivery moment + Gmail message id (reply
-- threading later + the idempotency anchor: a SENT pitch never re-sends).
ALTER TABLE "VenuePitch" ADD COLUMN "sentAt" TIMESTAMP(3);
ALTER TABLE "VenuePitch" ADD COLUMN "providerMessageId" TEXT;
