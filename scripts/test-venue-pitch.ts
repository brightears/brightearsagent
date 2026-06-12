// Live smoke (Phase 10.3): generate ONE real venue pitch via OpenRouter for
// the dev tenant's top-scored venue and print it — the founder judges the
// voice. No rows are written besides LlmUsage (the pitch is NOT persisted).
// Usage: npx tsx scripts/test-venue-pitch.ts [--warm | --seed]
//   --warm / --seed: pick the top venue of that temperature instead of the
//   overall top (10.2c — founder judges each template on a real venue).
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

const SLUG = process.env.DEV_TENANT_SLUG ?? "demo-dj-co";
const TEMPERATURE = process.argv.includes("--warm")
  ? "WARM"
  : process.argv.includes("--seed")
    ? "SEED"
    : null;

async function main() {
  const { db } = await import("../lib/db");
  const { generateVenuePitch, epkUrlFor, pitchLanguageFor } = await import(
    "../lib/agent/venue-pitch"
  );
  const { jurisdictionFor, pitchFooter } = await import("../lib/outreach/jurisdiction");

  const business = await db.business.findUnique({ where: { slug: SLUG } });
  if (!business) {
    console.error(`Tenant "${SLUG}" not found — run scripts/seed-venues.ts first.`);
    process.exit(1);
  }

  const venue = await db.venue.findFirst({
    where: {
      businessId: business.id,
      status: { in: ["DISCOVERED", "QUALIFIED"] },
      ...(TEMPERATURE ? { temperature: TEMPERATURE } : {}),
    },
    orderBy: { fitScore: "desc" },
    include: { signals: { orderBy: { observedAt: "desc" }, take: 5 } },
  });
  if (!venue) {
    console.error(
      TEMPERATURE
        ? `No pitchable ${TEMPERATURE} venue — run a scan with --warm first.`
        : "No pitchable venue — run scripts/seed-venues.ts first.",
    );
    process.exit(1);
  }

  const jurisdiction = jurisdictionFor(venue.country);
  const language = pitchLanguageFor(venue.country, business.pitchLanguages);
  console.log(
    `Pitching ${venue.name} (${venue.city}, ${venue.country}) — ${venue.temperature}, fit ${venue.fitScore}, timing ${venue.timingScore ?? "-"}, mode ${jurisdiction.mode}, language ${language}\n`,
  );

  const started = Date.now();
  const pitch = await generateVenuePitch({
    business: {
      id: business.id,
      name: business.name,
      ownerName: business.ownerName,
      performerKind: business.performerKind,
      voiceSamples: business.voiceSamples,
      headline: business.headline,
      bio: business.bio,
      genres: business.genres,
      eventTypes: business.eventTypes,
      serviceCities: business.serviceCities,
      feeFloor: business.feeFloor,
      feeSweetSpot: business.feeSweetSpot,
      reviewQuotes: business.reviewQuotes,
      notableVenues: business.notableVenues,
    },
    venue: {
      name: venue.name,
      city: venue.city,
      country: venue.country,
      kind: venue.kind,
      temperature: venue.temperature,
      signals: venue.signals.map((s) => s.summary),
      entertainmentEvidence: venue.entertainmentEvidence,
      fitReasons: venue.fitReasons,
    },
    epkUrl: epkUrlFor(business.slug),
    language,
  });

  const footer = pitchFooter({
    mode: jurisdiction.mode,
    businessName: business.name,
    city: business.serviceCities[0] ?? "",
    venueName: venue.name,
  });

  console.log(`Model: ${pitch.model} · ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
  console.log(`SUBJECT: ${pitch.subject}\n`);
  console.log(pitch.body);
  console.log("\n--- footer appended at approval/send time ---");
  console.log(footer);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
