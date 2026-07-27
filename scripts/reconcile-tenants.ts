/**
 * One-time tenant reconciliation (2026-07-27), founder-approved.
 *
 *   npx tsx scripts/reconcile-tenants.ts           # dry run — prints the plan
 *   npx tsx scripts/reconcile-tenants.ts --apply   # execute
 *
 * WHY. The census (scripts/tenants.ts) found three Business rows where the
 * cutover had assumed one:
 *
 *   norbert          BeNorBe                     4 leads, 108 venues, TRIAL
 *   platzer-norbert  Norbert Platzer's Business  1 lead,   0 venues, STARTER + live sub
 *   norbert-2        BeNorBe                     0 leads,  0 venues, TRIAL
 *
 * `norbert` is the real business — it holds the leads, the hunted venues, the
 * EPK, and the parse address the Gmail forwarding already points at. The other
 * two are accidents of the sign-up ladder: each was minted when the same person
 * signed in with a different verified address, because getCurrentBusiness ends
 * in an unconditional createBusinessForUser.
 *
 * They are not harmless. All three serve a live, public, indexable press kit —
 * two of them duplicates of the same brand, one titled "Norbert Platzer's
 * Business". And because Clerk production offers Google One Tap, signing in
 * with the wrong Google account lands on a decoy that looks plausible (it is
 * built from the same person's profile) while the real tenant keeps collecting
 * forwarded inquiries nobody is reading.
 *
 * ORDER MATTERS. Hiding a press kit is reversible, so it happens first and
 * unconditionally. Deleting a tenant is not, so every delete is guarded:
 *   - refuse while the row holds a Stripe subscription (deleting it would
 *     orphan the webhook's customer→business mapping while billing is live);
 *   - refuse if the row has leads (someone's real inquiry lives there);
 *   - never touch the canonical slug.
 * platzer-norbert therefore survives this run by design — its subscription runs
 * to Aug 24. Re-run after it lapses and the guard will let it go.
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

const CANONICAL = "norbert";
const DECOYS = ["platzer-norbert", "norbert-2"];

async function main() {
  const apply = process.argv.includes("--apply");
  const { db } = await import("../lib/db");

  const rows = await db.business.findMany({
    where: { slug: { in: [CANONICAL, ...DECOYS] } },
    select: {
      slug: true, name: true, plan: true, epkEnabled: true,
      stripeSubscriptionId: true, _count: { select: { leads: true } },
    },
  });

  const canonical = rows.find((r) => r.slug === CANONICAL);
  if (!canonical) throw new Error(`canonical tenant "${CANONICAL}" not found — refusing to touch anything`);
  console.log(`canonical: ${canonical.slug} (${canonical.name}) — ${canonical._count.leads} leads, plan ${canonical.plan}\n`);

  // Step 1 — hide the duplicate press kits. Reversible, so unconditional.
  const toHide = rows.filter((r) => DECOYS.includes(r.slug) && r.epkEnabled);
  for (const r of toHide) console.log(`HIDE   /epk/${r.slug} (epkEnabled true → false)`);
  if (!toHide.length) console.log("HIDE   nothing — no decoy press kit is public");

  // Step 2 — delete, but only what is provably safe to lose.
  const plan: { slug: string; go: boolean; reason: string }[] = [];
  for (const r of rows.filter((x) => DECOYS.includes(x.slug))) {
    if (r.stripeSubscriptionId) plan.push({ slug: r.slug, go: false, reason: `holds Stripe subscription ${r.stripeSubscriptionId} — delete after it lapses` });
    else if (r._count.leads > 0) plan.push({ slug: r.slug, go: false, reason: `has ${r._count.leads} lead(s) — move or review them first` });
    else plan.push({ slug: r.slug, go: true, reason: "no subscription, no leads" });
  }
  for (const p of plan) console.log(`${p.go ? "DELETE" : "KEEP  "} ${p.slug} — ${p.reason}`);

  if (!apply) {
    console.log("\nDRY RUN. Re-run with --apply to execute.");
  } else {
    if (toHide.length) {
      const { count } = await db.business.updateMany({
        where: { slug: { in: toHide.map((r) => r.slug) } },
        data: { epkEnabled: false },
      });
      console.log(`\nhid ${count} press kit(s)`);
    }
    for (const p of plan.filter((x) => x.go)) {
      await db.business.delete({ where: { slug: p.slug } });
      console.log(`deleted ${p.slug}`);
    }
    console.log("done");
  }

  await db.$disconnect();
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
