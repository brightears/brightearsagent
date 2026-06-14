-- Audit NF18: one Stripe subscription maps to exactly one business, so the
-- webhook can look it up with findUnique instead of findFirst. Add the unique
-- index (NULLs are allowed and not considered equal, so unsubscribed businesses
-- with NULL stripeSubscriptionId don't collide).
CREATE UNIQUE INDEX "Business_stripeSubscriptionId_key" ON "Business"("stripeSubscriptionId");
