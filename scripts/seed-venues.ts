// Dev utility (Phase 10.2): run the stub discovery provider through ingest for
// the dev tenant so the opportunity feed (10.4) has scored venue rows to
// render. Idempotent — rerunning produces no duplicates (the ingest planner's
// guarantee). Usage: npx tsx scripts/seed-venues.ts
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

const SLUG = process.env.DEV_TENANT_SLUG ?? "demo-dj-co";

// Fixture metros the stub has data for. Nashville is deliberately OUTSIDE the
// demo profile's service cities so the feed shows the geo caution path too.
const METROS = [
  { city: "Manchester", country: "GB" },
  { city: "Nashville", country: "US" },
];

async function main() {
  const { db } = await import("../lib/db");
  const { StubDiscoveryProvider } = await import("../lib/discovery/provider");
  const { ingestSignals } = await import("../lib/discovery/ingest");

  const business = await db.business.findUnique({ where: { slug: SLUG } });
  if (!business) {
    console.error(`Tenant "${SLUG}" not found — set DEV_TENANT_SLUG or create the demo tenant first.`);
    process.exit(1);
  }

  // Scoring needs a matching profile; backfill a demo one if 10.1 fields are empty.
  if (business.serviceCities.length === 0 || business.genres.length === 0) {
    await db.business.update({
      where: { id: business.id },
      data: {
        genres: business.genres.length ? business.genres : ["open format", "house", "disco"],
        eventTypes: business.eventTypes.length ? business.eventTypes : ["weddings", "corporate", "club nights"],
        serviceCities: business.serviceCities.length ? business.serviceCities : ["Manchester", "Leeds"],
      },
    });
    console.log(`Backfilled empty matching profile on "${SLUG}" with demo values.`);
  }

  const provider = new StubDiscoveryProvider(); // always the stub — this is a demo seed
  const now = new Date();
  for (const metro of METROS) {
    const raw = await provider.searchVenueSignals(metro, { now });
    const plan = await ingestSignals(business.id, metro, raw, now);
    console.log(
      `${metro.city}: ${raw.length} raw signals → ${plan.creates.length} created, ${plan.updates.length} updated, ${plan.skipped.length} skipped`,
    );
    for (const s of plan.skipped) console.log(`  skipped ${s.venueName}: ${s.reason}`);
  }

  const venues = await db.venue.findMany({
    where: { businessId: business.id },
    orderBy: { fitScore: "desc" },
    include: { signals: { select: { type: true } } },
  });
  console.log(`\n${venues.length} venue rows for "${SLUG}":`);
  for (const v of venues) {
    console.log(
      `  [${String(v.fitScore).padStart(3)}] ${v.name} — ${v.kind}, ${v.city} ${v.country} ` +
        `(${v.signals.length} signal${v.signals.length === 1 ? "" : "s"}, ${v.status})`,
    );
    for (const r of v.fitReasons) console.log(`        + ${r}`);
    if (v.caution) console.log(`        ! ${v.caution}`);
    if (v.bookingEmail) console.log(`        @ ${v.bookingEmail} (${v.contactSource ?? "unknown source"})`);
  }
}

main().then(() => process.exit(0));
