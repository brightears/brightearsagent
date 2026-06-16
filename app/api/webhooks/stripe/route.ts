import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { stripe, stripeEnabled } from "@/lib/billing/stripe";
import { applyStripeEvent } from "@/lib/billing/webhook";

/**
 * Stripe webhook: keeps Business.plan + customer/subscription ids in sync.
 * Signature-verified with STRIPE_WEBHOOK_SECRET (fail-closed in production).
 */
export async function POST(req: NextRequest) {
  if (!stripeEnabled) return NextResponse.json({ error: "billing disabled" }, { status: 503 });

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "webhook secret not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "set STRIPE_WEBHOOK_SECRET (stripe listen prints it)" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(await req.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  // Idempotency (audit B1): Stripe retries a delivery for up to ~3 days until it
  // gets a 2xx. Skip events we've already processed so a retry can't double-apply
  // a plan/subscription change. (We only reach the recorder below after the
  // handler runs without throwing — a thrown handler returns 5xx, Stripe retries,
  // and the event reprocesses.)
  const alreadyProcessed = await db.processedStripeEvent.findUnique({ where: { id: event.id } });
  if (alreadyProcessed) return NextResponse.json({ received: true, deduped: true });

  // Subscription-lifecycle sync lives in lib/billing/webhook.ts (unit-tested).
  const result = await applyStripeEvent(event);

  // An event that's ours (carries our businessId) but whose tenant we couldn't
  // resolve right now → 5xx so Stripe re-delivers, and DON'T record it as
  // processed (so the retry actually reprocesses). Anything else (applied, or a
  // not-ours/irrelevant event) is recorded so retries don't reprocess junk.
  if (result.retry) {
    console.error(`stripe webhook ${event.id} (${event.type}): tenant unresolved — returning 500 to retry`);
    return NextResponse.json({ error: "tenant unresolved" }, { status: 500 });
  }

  await db.processedStripeEvent
    .create({ data: { id: event.id, type: event.type } })
    .catch(() => {}); // swallow the unique-violation race between concurrent deliveries

  return NextResponse.json({ received: true });
}
