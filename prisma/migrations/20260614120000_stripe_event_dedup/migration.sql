-- Audit B1: idempotency ledger for Stripe webhooks.
-- Stripe retries a webhook delivery for up to ~3 days until it receives a 2xx.
-- The handler now checks this table on event.id BEFORE applying side effects and
-- records the id after processing, so a retried delivery cannot double-apply a
-- plan/subscription change. Keyed on the Stripe event id (evt_...).

-- CreateTable
CREATE TABLE "ProcessedStripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedStripeEvent_pkey" PRIMARY KEY ("id")
);
