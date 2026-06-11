import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
process.env.DEV_TENANT_SLUG = "norbert";
async function main() {
  const { db } = await import("../lib/db");
  const { meterState, PLAN_LEAD_CAPS } = await import("../lib/billing/metering");
  const { stripe } = await import("../lib/billing/stripe");
  const biz = await db.business.findUniqueOrThrow({ where: { slug: "norbert" } });

  // 1. Metering now reflects PRO
  const meter = await meterState(biz.id, biz.plan, new Date(), biz.trialEndsAt);
  console.log(`Lead cap for ${biz.plan}: ${meter.cap} (expected ${PLAN_LEAD_CAPS.PRO}) — ${meter.cap === PLAN_LEAD_CAPS.PRO ? "OK" : "MISMATCH"}`);

  // 2. Customer portal session creation (non-destructive — just builds the URL)
  if (biz.stripeCustomerId) {
    const portal = await stripe().billingPortal.sessions.create({
      customer: biz.stripeCustomerId,
      return_url: "http://localhost:3057/dashboard/settings",
    });
    console.log(`Portal session created: ${portal.url.startsWith("https://billing.stripe.com") ? "OK" : portal.url}`);
  }

  // 3. Subscription is live in Stripe
  if (biz.stripeSubscriptionId) {
    const sub = await stripe().subscriptions.retrieve(biz.stripeSubscriptionId);
    console.log(`Stripe subscription status: ${sub.status}, price lookup_key: ${sub.items.data[0]?.price?.lookup_key}`);
  }
  await db.$disconnect();
  process.exit(0);
}
main();
