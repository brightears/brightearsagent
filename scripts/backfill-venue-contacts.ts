// Bounded contact-only maintenance pass for an existing tenant backlog.
//
//   DEV_TENANT_SLUG=my-act npm run contacts:backfill
//   DEV_TENANT_SLUG=my-act npm run contacts:backfill -- --execute --max=10
//
// Dry-run is the default. Execution requires an active subscription and a
// Serper key, caps itself at 25 external queries, and imports no discovery,
// LLM, pitch-drafting, Gmail, or Postmark path.
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

const DEFAULT_MAX = 10;
const HARD_MAX = 25;
const WALL_CLOCK_MS = 3 * 60 * 1_000;

function maxArg(): number {
  const raw = process.argv.find((arg) => arg.startsWith("--max="))?.split("=")[1];
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_MAX;
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > HARD_MAX) {
    throw new Error(`--max must be an integer from 1 to ${HARD_MAX}`);
  }
  return parsed;
}

async function main() {
  const slug = process.env.DEV_TENANT_SLUG?.trim();
  if (!slug) throw new Error("DEV_TENANT_SLUG is required; no default tenant is safe in production");

  const execute = process.argv.includes("--execute");
  const max = maxArg();
  const now = new Date();
  const { db } = await import("../lib/db");
  const { isAgentPaused } = await import("../lib/billing/metering");
  const {
    CONTACT_MAX_ATTEMPTS,
    CONTACT_MIN_SCORE,
    isContactAttemptDue,
    runContactPass,
  } = await import("../lib/discovery/contacts");

  const business = await db.business.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      plan: true,
      country: true,
      lastDiscoveryScanAt: true,
      _count: { select: { venuePitches: true } },
    },
  });
  if (!business) throw new Error(`Tenant "${slug}" was not found`);
  if (isAgentPaused(business.plan)) {
    throw new Error(`Tenant "${slug}" is paused; contact spend is disabled without an active subscription`);
  }

  const candidates = await db.venue.findMany({
    where: {
      businessId: business.id,
      status: "DISCOVERED",
      fitScore: { gte: CONTACT_MIN_SCORE },
      contactExhaustedAt: null,
      contactAttemptCount: { lt: CONTACT_MAX_ATTEMPTS },
      OR: [
        { bookingEmail: null },
        { contactState: "FOUND_GENERIC" },
      ],
    },
    select: {
      contactAttemptCount: true,
      contactRetryAfter: true,
      contactExhaustedAt: true,
      contactState: true,
    },
  });
  const due = candidates.filter((venue) => isContactAttemptDue(venue, now)).length;

  console.log(
    `Contact backfill preview · ${business.name} (${slug}) · ${due} due now · cap ${Math.min(max, due)}`,
  );
  if (!execute) {
    console.log("Dry run only. Add --execute to spend the bounded Serper queries and save results.");
    await db.$disconnect();
    return;
  }
  if (!process.env.SERPER_API_KEY) throw new Error("SERPER_API_KEY is required for --execute");

  const started = Date.now();
  let attempted = 0;
  let queries = 0;
  let found = 0;
  let suppressed = 0;
  while (attempted < max && Date.now() - started < WALL_CLOCK_MS) {
    // One row at a time keeps the wall-clock limit meaningful even when a
    // venue site is slow or blocks several conventional contact paths.
    const result = await runContactPass(business.id, {
      now: new Date(),
      gl: business.country.trim().toLowerCase(),
      limit: 1,
    });
    if (result.attempted === 0) break;
    attempted += result.attempted;
    queries += result.serperQueries;
    found += result.found.length;
    suppressed += result.suppressed.length;
    for (const contact of result.found) console.log(`  found · ${contact.name}`);
  }

  // Maintenance invariants: this script must never draft and must never spend
  // the full discovery scan's 20-hour budget.
  const after = await db.business.findUniqueOrThrow({
    where: { id: business.id },
    select: { lastDiscoveryScanAt: true, _count: { select: { venuePitches: true } } },
  });
  if (
    after._count.venuePitches !== business._count.venuePitches ||
    after.lastDiscoveryScanAt?.getTime() !== business.lastDiscoveryScanAt?.getTime()
  ) {
    throw new Error("Safety invariant failed: contact-only backfill changed discovery or pitch state");
  }

  console.log(
    `Complete · ${attempted} attempted · ${queries} Serper queries · ${found} contacts saved · ${suppressed} suppressed`,
  );
  console.log("Safety: no venue discovery, LLM drafting, Gmail send, or Postmark path was imported.");
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
