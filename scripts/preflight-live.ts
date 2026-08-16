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
let failureCount = 0;
const bad = (s: string) => {
  failureCount++;
  console.log(`  ✗ ${s}`);
};
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

  // What CAN be settled without a live capture: SPF authorisation and DMARC
  // alignment, both of which are pure DNS. This is the mechanism that actually
  // carries our mail today.
  console.log("\n  -- SPF / DMARC alignment (DNS, authoritative):");
  const { resolveTxt, resolveCname } = await import("node:dns/promises");
  const orgOf = (x: string) => x.split(".").slice(-2).join(".");
  const envelope = `pm-bounces.${fromDomain}`;
  try {
    const cname = await resolveCname(envelope).catch(() => []);
    if (cname.length) ok(`${envelope} -> ${cname[0]} (custom Return-Path is live)`);
    else bad(`${envelope} has no CNAME — Postmark falls back to its own bounce domain, which does NOT align`);
    // Own catch: a missing TXT must not skip the alignment verdict below, which
    // is computed from names alone and is useful even when SPF is absent.
    const txt = (await resolveTxt(envelope).catch(() => [] as string[][])).map((r) => r.join(""));
    const spf = txt.find((t) => t.startsWith("v=spf1"));
    if (spf) ok(`envelope SPF: ${spf}`);
    else bad("envelope domain publishes no SPF — SPF cannot pass");
    if (orgOf(envelope) === orgOf(fromDomain)) {
      ok(`aligned: envelope org ${orgOf(envelope)} == From org ${orgOf(fromDomain)} (relaxed)`);
      if (spf) ok("=> DMARC PASSES via SPF, independently of DKIM");
    } else {
      bad(`NOT aligned: envelope org ${orgOf(envelope)} != From org ${orgOf(fromDomain)}`);
    }
  } catch (e) {
    bad(`envelope DNS lookup failed: ${(e as Error).message}`);
  }

  const dmarc = await import("node:dns/promises")
    .then((dns) => dns.resolveTxt(`_dmarc.${orgOf(fromDomain)}`))
    .then((r) => r.map((x) => x.join("")).find((t) => t.startsWith("v=DMARC1")))
    .catch(() => undefined);
  console.log(`  DMARC: ${dmarc ?? "(none published)"}`);
  if (dmarc?.includes("p=none")) {
    info("p=none — nothing bounces on a failure, so problems here are silent deliverability loss, not errors");
  }


  // DKIM, verified rather than assumed. The selector CANNOT be brute-forced:
  // Postmark's format is <yyyymmddHHMMSS>pm — a timestamp to the second — so
  // ~130 guesses of <yyyymmdd>pm found nothing and led to a wrong "DKIM is not
  // published" conclusion. It was published all along. The selector below was
  // read off a real delivered message (see the loopback recipe under the
  // DKIM_SELECTOR comment), which is the only reliable way to obtain one.
  const DKIM_SELECTOR = "20260723080904pm";
  const dkimHost = `${DKIM_SELECTOR}._domainkey.${fromDomain}`;
  const key = await import("node:dns/promises")
    .then((dns) => dns.resolveTxt(dkimHost))
    .then((r) => r.map((x) => x.join("")).find((t) => t.includes("p=")))
    .catch(() => undefined);
  if (key) {
    ok(`DKIM key published at ${dkimHost} (${key.length} bytes)`);
    ok("=> DMARC also passes via DKIM, which (unlike SPF) survives auto-forwarding");
  } else {
    bad(`no DKIM key at ${dkimHost} — the selector may have been rotated.`);
    info(
      "To read the CURRENT selector without any login: send through this Postmark server to leads@<nonexistent-slug>.in.brightears.io (wildcard MX accepts it, no tenant claims it, so nothing is created), then GET /messages/inbound?count=20&offset=0 and /messages/inbound/{id}/details and read the DKIM-Signature s= value. Both count AND offset are required.",
    );
  }

  if (!token) return info("POSTMARK_SERVER_TOKEN unset — skipping the sent-message inspection; the DNS verdict above is the one that matters");

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

  // CAREFUL: /dump returns the message as Postmark STORED it, before its MTA
  // signs and stamps the envelope. Both DKIM-Signature and Return-Path are
  // added at send time, so their absence here proves NOTHING — an earlier
  // version of this script read that absence as "DMARC cannot pass" and was
  // wrong twice over: wrong about the evidence, and wrong about the inference,
  // because DMARC passes on EITHER mechanism and this domain passes on SPF.
  const dumpRes = await fetch(
    `https://api.postmarkapp.com/messages/outbound/${newest.MessageID}/dump`,
    { headers: h },
  );
  if (dumpRes.ok) {
    const { Body } = (await dumpRes.json()) as { Body: string };
    console.log(`  ${Body.match(/^From:.*$/im)?.[0] ?? "(no From header in dump)"}`);
    const d = Body.match(/DKIM-Signature:[\s\S]{0,400}/i)?.[0]?.match(/[;\s]d=([^;\s]+)/i)?.[1];
    if (d) ok(`dump already carries DKIM d=${d}`);
    else info("no DKIM-Signature in the stored copy — expected; Postmark signs on the way out, so this is inconclusive by design");
  }

  // DKIM is still worth having even though SPF carries us: SPF breaks the moment
  // a recipient auto-forwards (the forwarder becomes the sender), while a DKIM
  // signature survives it. Report whether a key is actually published.
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
  console.log(
    failureCount
      ? `\nFAIL — ${failureCount} live preflight check(s) need attention. Nothing was changed.\n`
      : "\nPASS — live preflight is clean. Read-only; nothing was changed.\n",
  );
  process.exitCode = failureCount ? 1 : 0;
}

main();
