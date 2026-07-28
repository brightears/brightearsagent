/**
 * Remove synthetic leads so the founder's customer-zero week starts on a board
 * where every row is real.
 *
 *   npx tsx scripts/clear-test-leads.ts           # inventory + plan, deletes nothing
 *   npx tsx scripts/clear-test-leads.ts --apply   # delete
 *
 * Deliberately an explicit list, not a "looks like a test" heuristic. Guessing
 * here throws away a real client's inquiry, which is the single most expensive
 * thing this product could do to someone — so anything not named below is
 * printed and left alone, and the operator decides.
 *
 * Lead deletion cascades to messages, drafts and sequence runs (schema
 * onDelete: Cascade), and nulls the gig link (SetNull), so no orphans remain.
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

const TENANT = "norbert";

/** Addresses Claude sent test inquiries from while proving the pipeline. */
const CLAUDE_TEST_SENDERS = [
  "claire.whitmore.test@gmail.com", // live agent test, after the STARTER payment
  "norbert+epktest@brightears.io", // submitted through the live EPK form
  "amara.lindqvist.test@gmail.com", // inbound replay probe
];

/**
 * The reasoning-leak row: a pre-2026-07-10 parse wrote the model's entire
 * chain-of-thought into `venue`, and it rendered on the live dashboard with a
 * real email address in it. It was also actively harmful — being an open lead
 * for the founder's own gmail, it swallowed every later inquiry from that
 * address as a "reply" (see lib/inbound/pipeline.ts reply-match window).
 */
const looksLikeReasoningLeak = (venue: string | null) =>
  !!venue && (/[\n\r`{}]/.test(venue) || venue.length > 200);

async function main() {
  const apply = process.argv.includes("--apply");
  const { db } = await import("../lib/db");

  const business = await db.business.findUnique({ where: { slug: TENANT }, select: { id: true, name: true } });
  if (!business) throw new Error(`tenant "${TENANT}" not found — refusing to guess`);

  const leads = await db.lead.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, clientName: true, clientEmail: true, eventType: true, eventDate: true,
      venue: true, status: true, createdAt: true,
      _count: { select: { messages: true, drafts: true } },
    },
  });

  console.log(`${business.name}: ${leads.length} lead(s)\n${"─".repeat(72)}`);
  const doomed: string[] = [];
  for (const l of leads) {
    const why = CLAUDE_TEST_SENDERS.includes((l.clientEmail ?? "").toLowerCase())
      ? "Claude test inquiry"
      : looksLikeReasoningLeak(l.venue)
        ? "corrupt row — model reasoning in the venue field"
        : null;
    if (why) doomed.push(l.id);
    console.log(
      `${why ? "DELETE" : "KEEP  "}  ${(l.clientName ?? "Unknown").padEnd(24)} ${(l.clientEmail ?? "—").padEnd(34)} ` +
        `${(l.eventType ?? "—").padEnd(10)} ${l.status.padEnd(9)} ${l.createdAt.toISOString().slice(0, 10)} ` +
        `${l._count.messages}m/${l._count.drafts}d${why ? `  ← ${why}` : ""}`,
    );
  }

  console.log(`${"─".repeat(72)}\n${doomed.length} to delete, ${leads.length - doomed.length} kept.`);
  console.log("Anything listed KEEP that you know is a test: tell Claude and it goes in the next pass.");

  if (!apply) {
    console.log("\nDRY RUN. Re-run with --apply to delete.");
  } else if (doomed.length) {
    const { count } = await db.lead.deleteMany({ where: { id: { in: doomed } } });
    console.log(`\ndeleted ${count} lead(s) — messages, drafts and sequence runs cascaded`);
  }

  await db.$disconnect();
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
