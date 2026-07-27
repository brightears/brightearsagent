/**
 * Read-only tenant census. Run in the Render web shell:
 *
 *   npx tsx scripts/tenants.ts
 *
 * Written 2026-07-27, after an unauthenticated probe showed three live
 * Business rows (/epk/norbert, /epk/norbert-2, /epk/platzer-norbert all 200)
 * when the launch had been reasoned about on the assumption of one. Which row
 * holds the live Stripe subscription, and which email/Clerk id each Member
 * carries, decides whether the founder's sign-in lands on the real tenant or a
 * plausible-looking decoy — and nothing else in the cutover can be settled
 * until that is on paper.
 *
 * SELECTs only: no update, no delete, no side effects. Safe to run repeatedly.
 * Prints no secrets — ids and addresses only.
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

async function main() {
  const { db } = await import("../lib/db");

  const businesses = await db.business.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      ownerEmail: true,
      plan: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      epkEnabled: true,
      createdAt: true,
      members: { select: { email: true, clerkUserId: true, isOwner: true } },
      _count: { select: { leads: true, venues: true } },
    },
  });

  console.log(`\n${businesses.length} business row(s)\n${"=".repeat(72)}`);
  for (const b of businesses) {
    console.log(`
slug            ${b.slug}
name            ${b.name}
ownerEmail      ${b.ownerEmail}
plan            ${b.plan}
stripeCustomer  ${b.stripeCustomerId ?? "—"}
stripeSub       ${b.stripeSubscriptionId ?? "—"}
epkEnabled      ${b.epkEnabled}
created         ${b.createdAt.toISOString()}
leads / venues  ${b._count.leads} / ${b._count.venues}
members         ${b.members
      .map((m) => `${m.email}${m.isOwner ? " (owner)" : ""} → ${m.clerkUserId ?? "UNCLAIMED"}`)
      .join("\n                ")}`);
  }

  // The decision this census exists to inform: exactly one tenant should look
  // like the real business, and no other row should be reachable by an address
  // the founder can sign in with.
  console.log(`\n${"=".repeat(72)}`);
  const paying = businesses.filter((b) => b.stripeSubscriptionId);
  const withLeads = businesses.filter((b) => b._count.leads > 0);
  console.log(`with a Stripe subscription : ${paying.map((b) => b.slug).join(", ") || "none"}`);
  console.log(`with leads                 : ${withLeads.map((b) => `${b.slug}(${b._count.leads})`).join(", ") || "none"}`);
  console.log(`public press kits live     : ${businesses.filter((b) => b.epkEnabled).map((b) => b.slug).join(", ") || "none"}`);

  await db.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
