// Idempotent Stripe setup — the COMPLETE per-mode bootstrap (audit 2026-07:
// every manual dashboard step is a silent-failure mode at cutover):
//   1. Catalog: three subscription products + monthly prices with stable
//      lookup_keys (capacity/autonomy descriptions matching plan-features).
//   2. Portal configuration with subscription_update enabled (one-click plan
//      changes via flow_data deep links) — prints STRIPE_PORTAL_CONFIG to set.
//   3. Optional --with-webhook: registers the webhook endpoint for APP_URL
//      with exactly the 3 events the handler processes, prints the whsec.
//   4. Prints the remaining manual cutover checklist.
// Safe to re-run; run once per mode (test now, live at launch).
// Usage: npx tsx scripts/stripe-setup.ts [--with-webhook]
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import Stripe from "stripe";

// Descriptions follow the tier law (ADR-003): every tier is the complete
// assistant; tiers differ by capacity + autonomy, never capability. No
// multi-performer/team claims until the roster ships (P13).
const CATALOG = [
  { lookupKey: "brightears_starter_monthly", name: "Bright Ears Starter", amount: 2500, description: "The complete agent - up to 15 inbound inquiries/month, you approve every send." },
  { lookupKey: "brightears_pro_monthly", name: "Bright Ears Pro", amount: 7900, description: "The complete agent working harder - up to 60 inquiries/month, auto-send from trusted sources, hunts up to 3 cities." },
  { lookupKey: "brightears_studio_monthly", name: "Bright Ears Studio", amount: 14900, description: "The complete agent at full stretch - up to 150 inquiries/month, auto-send, hunts all your cities." },
];

const PORTAL_HEADLINE = "Bright Ears — manage your plan";

// Exactly what lib/billing/webhook.ts + the route handle. Registering more
// events just fills the dead-letter queue; fewer silently drops plan syncs.
const WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];

async function ensureCatalog(stripe: Stripe): Promise<string[]> {
  const priceIds: string[] = [];
  for (const item of CATALOG) {
    const existing = await stripe.prices.list({ lookup_keys: [item.lookupKey], limit: 1 });
    if (existing.data.length) {
      const price = existing.data[0];
      priceIds.push(price.id);
      // Keep the product name/description in sync with the tier law on re-runs.
      const productId = typeof price.product === "string" ? price.product : price.product?.id;
      if (productId) {
        await stripe.products.update(productId, { name: item.name, description: item.description });
      }
      console.log(`✓ ${item.lookupKey} exists (${price.id}) — description synced`);
      continue;
    }
    const product = await stripe.products.create({
      name: item.name,
      description: item.description,
    });
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: item.amount,
      currency: "usd",
      recurring: { interval: "month" },
      lookup_key: item.lookupKey,
    });
    priceIds.push(price.id);
    console.log(`+ created ${item.name}: ${price.id} (${item.lookupKey})`);
  }
  return priceIds;
}

/** Portal config with plan switching between our three prices, cancel at
 *  period end, payment-method + invoice access. Idempotent by headline. */
async function ensurePortalConfig(stripe: Stripe, priceIds: string[]): Promise<string> {
  const products: { product: string; prices: string[] }[] = [];
  for (const id of priceIds) {
    const price = await stripe.prices.retrieve(id);
    const productId = typeof price.product === "string" ? price.product : price.product!.id;
    products.push({ product: productId, prices: [id] });
  }
  const features: Stripe.BillingPortal.ConfigurationCreateParams.Features = {
    payment_method_update: { enabled: true },
    invoice_history: { enabled: true },
    subscription_cancel: { enabled: true, mode: "at_period_end" },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ["price"],
      proration_behavior: "create_prorations",
      products,
    },
  };

  const existing = await stripe.billingPortal.configurations.list({ limit: 100 });
  const ours = existing.data.find((c) => c.business_profile?.headline === PORTAL_HEADLINE);
  if (ours) {
    await stripe.billingPortal.configurations.update(ours.id, { features });
    console.log(`✓ portal configuration synced (${ours.id})`);
    return ours.id;
  }
  const created = await stripe.billingPortal.configurations.create({
    business_profile: { headline: PORTAL_HEADLINE },
    features,
  });
  console.log(`+ created portal configuration ${created.id}`);
  return created.id;
}

async function ensureWebhook(stripe: Stripe): Promise<void> {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    console.log("· skipped webhook registration (APP_URL not set)");
    return;
  }
  const url = `${appUrl.replace(/\/$/, "")}/api/webhooks/stripe`;
  const existing = await stripe.webhookEndpoints.list({ limit: 100 });
  const ours = existing.data.find((e) => e.url === url);
  if (ours) {
    await stripe.webhookEndpoints.update(ours.id, { enabled_events: WEBHOOK_EVENTS });
    console.log(`✓ webhook endpoint exists for ${url} (events synced; secret only shown at creation)`);
    return;
  }
  const created = await stripe.webhookEndpoints.create({ url, enabled_events: WEBHOOK_EVENTS });
  console.log(`+ created webhook endpoint ${created.id} for ${url}`);
  console.log(`  STRIPE_WEBHOOK_SECRET=${created.secret}  ← set on the server NOW (only shown once)`);
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("STRIPE_SECRET_KEY missing in .env.local");
    process.exit(1);
  }
  const stripe = new Stripe(key);
  const mode = key.startsWith("sk_test") ? "TEST" : "LIVE";
  console.log(`Setting up Stripe in ${mode} mode...`);

  const priceIds = await ensureCatalog(stripe);
  const portalId = await ensurePortalConfig(stripe, priceIds);
  if (process.argv.includes("--with-webhook")) await ensureWebhook(stripe);

  console.log("\nDone. Set on the server (Render env):");
  console.log(`  STRIPE_PORTAL_CONFIG=${portalId}`);
  console.log("\nManual checklist still on the founder (per mode):");
  console.log("  · Mint the 100%-off-first-month PROMOTION CODE (comped artists)");
  console.log("  · Billing → Subscriptions and emails → dunning: cancel after failed payments");
  console.log("  · LIVE cutover only: re-run with --with-webhook once APP_URL is the real domain");
}

main();
