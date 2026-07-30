/**
 * Read-only preflight for the things that can ONLY be checked where the live
 * environment lives: run this in the Render shell with `npx tsx`.
 *
 * It answers the two questions no amount of local inspection can:
 *   1. Does outbound mail pass DMARC? (OUTBOUND_FROM must align with the DKIM
 *      domain Postmark actually signs with — read off a real sent message.)
 *   2. Does billing work beyond Starter? (live prices for all three lookup
 *      keys, and a LIVE-mode portal configuration — the only value in git
 *      history is a test-mode bpc_, which would 500 the "Manage billing"
 *      button for every paying customer.)
 *
 * Touches nothing. Every call is a GET.
 */
// Render already has the live values in process.env; locally this makes a dry
// run against test mode possible so the logic itself can be proven first.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import Stripe from "stripe";
import { PLAN_LOOKUP_KEYS } from "../lib/billing/stripe";

const ok = (s: string) => console.log(`  ✓ ${s}`);
const bad = (s: string) => console.log(`  ✗ ${s}`);
const info = (s: string) => console.log(`  · ${s}`);

async function mail() {
  console.log("\n=== 1. OUTBOUND MAIL / DMARC ===");
  const from = process.env.OUTBOUND_FROM;
  const token = process.env.POSTMARK_SERVER_TOKEN;
  console.log(`  OUTBOUND_FROM = ${from ?? "(unset!)"}`);
  if (!from) return bad("unset — sends would use replies@dev.invalid");

  const fromDomain = from.split("@")[1] ?? "";
  if (fromDomain === "mail.brightears.io") ok("From is on the mail subdomain");
  else info(`From domain is ${fromDomain} — must be covered by the DKIM signature below`);

  if (!token) return bad("POSTMARK_SERVER_TOKEN unset — cannot inspect real headers");

  const h = { "X-Postmark-Server-Token": token, Accept: "application/json" };
  const listRes = await fetch("https://api.postmarkapp.com/messages/outbound?count=5&offset=0", {
    headers: h,
  });
  if (!listRes.ok) return bad(`Postmark list failed: ${listRes.status} ${await listRes.text()}`);
  const list = (await listRes.json()) as {
    TotalCount: number;
    Messages: { MessageID: string; From: string; Recipients: string[]; Status: string; ReceivedAt: string }[];
  };
  console.log(`  ${list.TotalCount} messages sent to date; most recent:`);
  for (const m of list.Messages) {
    console.log(`    ${m.ReceivedAt}  ${m.From} -> ${m.Recipients?.[0]}  [${m.Status}]`);
  }
  const newest = list.Messages[0];
  if (!newest) return info("no sent messages yet — send one reply, then re-run");

  // The raw signed source is ground truth for alignment: DKIM d= must be the
  // From domain or its parent for relaxed DMARC alignment to hold.
  const dumpRes = await fetch(
    `https://api.postmarkapp.com/messages/outbound/${newest.MessageID}/dump`,
    { headers: h },
  );
  if (!dumpRes.ok) return bad(`dump failed: ${dumpRes.status}`);
  const { Body } = (await dumpRes.json()) as { Body: string };
  const sig = Body.match(/DKIM-Signature:[\s\S]{0,400}/i)?.[0] ?? "";
  const d = sig.match(/[;\s]d=([^;\s]+)/i)?.[1];
  const s = sig.match(/[;\s]s=([^;\s]+)/i)?.[1];
  const headerFrom = Body.match(/^From:.*$/im)?.[0];
  console.log(`  ${headerFrom ?? "(no From header found)"}`);
  if (!d) {
    bad("NO DKIM-Signature on a real sent message — DMARC cannot pass on DKIM");
  } else {
    console.log(`  DKIM: d=${d} s=${s}`);
    const org = (x: string) => x.split(".").slice(-2).join(".");
    if (org(d) === org(fromDomain)) ok(`aligned with From domain ${fromDomain} (relaxed alignment)`);
    else bad(`d=${d} does NOT align with From ${fromDomain} — DMARC fails on DKIM`);
    info(`DKIM DNS record to expect: ${s}._domainkey.${d}`);
  }
  const rp = Body.match(/^Return-Path:.*$/im)?.[0];
  if (rp) info(rp.trim());
}

async function billing() {
  console.log("\n=== 2. STRIPE BEYOND STARTER ===");
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return bad("STRIPE_SECRET_KEY unset");
  const live = key.startsWith("sk_live_");
  console.log(`  key mode: ${live ? "LIVE" : "TEST"}`);
  if (!live) bad("not a live key — everything below is test-mode and proves nothing about production");
  const stripe = new Stripe(key);

  for (const [plan, lookup] of Object.entries(PLAN_LOOKUP_KEYS)) {
    try {
      const prices = await stripe.prices.list({ lookup_keys: [lookup], active: true, limit: 2 });
      if (!prices.data.length) {
        bad(`${plan}: NO active price for lookup_key "${lookup}" — checkout hard-errors for this tier`);
        continue;
      }
      const p = prices.data[0];
      const amt = p.unit_amount != null ? `${(p.unit_amount / 100).toFixed(2)} ${p.currency.toUpperCase()}` : "?";
      ok(`${plan}: ${amt}/${p.recurring?.interval ?? "?"} (${p.id})${prices.data.length > 1 ? "  ⚠ MORE THAN ONE active price shares this lookup_key" : ""}`);
    } catch (e) {
      bad(`${plan}: ${(e as Error).message}`);
    }
  }

  const cfg = process.env.STRIPE_PORTAL_CONFIG;
  console.log(`  STRIPE_PORTAL_CONFIG = ${cfg ?? "(unset — Stripe uses the account default)"}`);
  if (cfg) {
    try {
      const c = await stripe.billingPortal.configurations.retrieve(cfg);
      if (c.active) ok(`portal config resolves and is active (livemode=${c.livemode})`);
      else bad("portal config resolves but is INACTIVE — Manage billing will fail");
      if (c.livemode !== live) bad("portal config mode does not match the API key mode");
    } catch (e) {
      bad(`portal config unusable: ${(e as Error).message} — every "Manage billing" click 500s`);
    }
  } else {
    // Not fatal: Stripe falls back to the dashboard default configuration,
    // but only if one has been saved in LIVE mode at least once.
    try {
      const all = await stripe.billingPortal.configurations.list({ active: true, limit: 3 });
      if (all.data.some((c) => c.is_default)) ok("a default live portal configuration exists");
      else bad("no default live portal configuration — Manage billing will fail until one is saved");
    } catch (e) {
      bad(`portal list failed: ${(e as Error).message}`);
    }
  }
}

async function main() {
  await mail().catch((e) => bad(`mail check threw: ${(e as Error).message}`));
  await billing().catch((e) => bad(`billing check threw: ${(e as Error).message}`));
  console.log("\ndone — read-only, nothing was changed.\n");
}

main();
