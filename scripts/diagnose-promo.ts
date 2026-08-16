/**
 * Why does the configured beta promotion fail at checkout?
 *
 *   npx tsx scripts/diagnose-promo.ts <promotion-code>
 *
 * Applying a promotion code inside Stripe's hosted Checkout is Stripe's own
 * internal operation: it never reaches our API logs, and the buyer is shown a
 * deliberately vague "Something went wrong, please try again" so codes cannot
 * be enumerated. That vagueness is why this script exists — creating a session
 * with the discount attached SERVER-SIDE surfaces the real error instead.
 *
 * Read-only apart from creating Checkout Sessions, which charge nothing and
 * expire on their own; nothing here can take money or mutate the catalog.
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

const CODE = process.argv[2]?.trim();
if (!CODE) {
  throw new Error("Pass the promotion code as the first argument; there is no safe default.");
}

async function main() {
  const { stripe, PLAN_LOOKUP_KEYS } = await import("../lib/billing/stripe");
  const s = stripe();

  // expand: this API version omits the coupon from the promotion code unless asked.
  const found = await s.promotionCodes.list({ code: CODE, limit: 1, expand: ["data.coupon"] });
  const promo = found.data[0];
  if (!promo) {
    console.log("no matching promotion code in this mode — is the key live vs test?");
    process.exit(1);
  }

  console.log("PROMOTION CODE");
  console.log(JSON.stringify({
    id: promo.id, active: promo.active,
    max_redemptions: promo.max_redemptions, times_redeemed: promo.times_redeemed,
    expires_at: promo.expires_at, customer: promo.customer, restrictions: promo.restrictions,
  }, null, 1));

  // This Stripe API version does not surface `coupon` on the PromotionCode
  // type, though the object carries it — read it through a narrow cast.
  // Best-effort: the coupon is useful context (applies_to is a classic silent
  // killer — a coupon restricted to products that exclude the plan being bought
  // applies to nothing) but it is NOT required to answer the question. The
  // checkout probe below is the decisive test, so never let this stop it.
  const couponRef = (promo as unknown as { coupon?: string | { id: string } }).coupon;
  const couponId =
    process.argv[3] ?? (typeof couponRef === "string" ? couponRef : couponRef?.id);
  let coupon: Awaited<ReturnType<typeof s.coupons.retrieve>> | null = null;
  if (couponId) {
    try {
      coupon = await s.coupons.retrieve(couponId);
      console.log("\nCOUPON");
      console.log(JSON.stringify({
        id: coupon.id, name: coupon.name, valid: coupon.valid,
        percent_off: coupon.percent_off, amount_off: coupon.amount_off, currency: coupon.currency,
        duration: coupon.duration, duration_in_months: coupon.duration_in_months,
        max_redemptions: coupon.max_redemptions, times_redeemed: coupon.times_redeemed,
        redeem_by: coupon.redeem_by, applies_to: coupon.applies_to,
      }, null, 1));
    } catch {
      console.log(`\nCOUPON ${couponId} could not be read — continuing to the probe`);
    }
  } else {
    console.log("\nCOUPON not resolvable from this API version — pass its id as a second argument for detail. Continuing to the probe.");
  }

  const prices = await s.prices.list({ lookup_keys: [PLAN_LOOKUP_KEYS.STARTER], limit: 1 });
  const price = prices.data[0];
  if (!price) { console.log("\nno STARTER price found — nothing to probe against"); process.exit(1); }
  console.log(`\nSTARTER price ${price.id} (${price.unit_amount} ${price.currency}), product ${String(price.product)}`);
  if (coupon?.applies_to?.products?.length) {
    const ok = coupon.applies_to.products.includes(String(price.product));
    console.log(`coupon applies_to.products includes this product: ${ok ? "YES" : "NO  ← this alone would reject it"}`);
  }

  // The probe. Same shape as startCheckout, but with the discount attached
  // server-side so Stripe has to explain itself.
  const attempts: [string, Record<string, unknown>][] = [
    ["discount + adaptive pricing ON (as production behaves today)", {}],
    ["discount + adaptive pricing OFF", { adaptive_pricing: { enabled: false } }],
  ];
  for (const [label, extra] of attempts) {
    try {
      const session = await s.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: price.id, quantity: 1 }],
        customer_email: "promo-probe@brightears.io",
        discounts: [{ promotion_code: promo.id }],
        success_url: "https://brightears.io/dashboard/settings?billing=success",
        cancel_url: "https://brightears.io/dashboard/settings?billing=cancelled",
        ...extra,
      } as never);
      console.log(`\n✓ ${label}`);
      console.log(`   total ${session.amount_total} ${session.currency} (subtotal ${session.amount_subtotal})`);
      console.log(`   ${session.amount_total === 0 ? "DISCOUNT APPLIED — the code works in this configuration" : "code accepted but total is NOT zero"}`);
    } catch (err) {
      const e = err as { type?: string; code?: string; param?: string; message?: string };
      console.log(`\n✗ ${label}`);
      console.log(`   ${e.type ?? ""} ${e.code ?? ""} ${e.param ? `(param ${e.param})` : ""}`);
      console.log(`   ${e.message}`);
    }
  }

  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
