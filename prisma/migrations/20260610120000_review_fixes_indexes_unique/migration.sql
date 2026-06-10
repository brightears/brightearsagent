-- Webhook idempotency backstop: concurrent redelivery can't double-create.
CREATE UNIQUE INDEX "Message_providerMessageId_key" ON "Message"("providerMessageId");

-- Push subscriptions scoped per (business, device) instead of globally per device.
DROP INDEX "PushSubscription_endpoint_key";
CREATE UNIQUE INDEX "PushSubscription_businessId_endpoint_key" ON "PushSubscription"("businessId", "endpoint");

-- Hot cron-query indexes.
CREATE INDEX "Draft_status_expiresAt_idx" ON "Draft"("status", "expiresAt");
CREATE INDEX "SequenceRun_stoppedAt_nextRunAt_idx" ON "SequenceRun"("stoppedAt", "nextRunAt");
