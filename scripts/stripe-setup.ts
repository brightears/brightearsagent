// Idempotent Stripe catalog setup: creates the three subscription products +
// monthly prices with stable lookup_keys. Safe to re-run; run once per mode
// (test now, live at launch). Usage: npx tsx scripts/stripe-setup.ts
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import Stripe from "stripe";

const CATALOG = [
  { lookupKey: "brightears_starter_monthly", name: "Bright Ears Starter", amount: 2500, description: "15 leads/month, 1 performer, instant AI replies you approve from your phone." },
  { lookupKey: "brightears_pro_monthly", name: "Bright Ears Pro", amount: 7900, description: "60 leads/month, follow-up sequences until booked, auto-send, weekly report." },
  { lookupKey: "brightears_studio_monthly", name: "Bright Ears Studio", amount: 14900, description: "150 leads/month, multiple performers, team access." },
];

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("STRIPE_SECRET_KEY missing in .env.local");
    process.exit(1);
  }
  const stripe = new Stripe(key);
  const mode = key.startsWith("sk_test") ? "TEST" : "LIVE";
  console.log(`Setting up catalog in ${mode} mode...`);

  for (const item of CATALOG) {
    const existing = await stripe.prices.list({ lookup_keys: [item.lookupKey], limit: 1 });
    if (existing.data.length) {
      console.log(`✓ ${item.lookupKey} exists (${existing.data[0].id})`);
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
    console.log(`+ created ${item.name}: ${price.id} (${item.lookupKey})`);
  }
  console.log("Catalog ready.");
}

main();
