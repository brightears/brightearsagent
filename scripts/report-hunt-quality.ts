// Read-only beta scorecard for the proactive Hunt.
//
//   npm run quality:hunt
//   DEV_TENANT_SLUG=my-act npm run quality:hunt
//   npm run quality:hunt -- --days=60
//
// This script only reads Business/Venue/VenuePitch rows. It imports no
// discovery, drafting or send action and cannot contact a venue.
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

function daysArg(): number {
  const raw = process.argv.find((arg) => arg.startsWith("--days="))?.split("=")[1];
  const parsed = raw ? Number.parseInt(raw, 10) : 30;
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 365 ? parsed : 30;
}

async function main() {
  const { db } = await import("../lib/db");
  const {
    computeHuntQuality,
    renderHuntQualityText,
  } = await import("../lib/reports/hunt-quality");

  const slug = process.env.DEV_TENANT_SLUG?.trim();
  const business = slug
    ? await db.business.findUnique({
        where: { slug },
        select: { id: true, slug: true, name: true },
      })
    : null;
  if (slug && !business) {
    throw new Error(`Tenant "${slug}" not found`);
  }

  const summary = await computeHuntQuality({
    ...(business ? { businessId: business.id } : {}),
    windowDays: daysArg(),
  });
  console.log(
    business
      ? `Read-only Hunt quality for ${business.name} (${business.slug})`
      : "Read-only Hunt quality across all tenants",
  );
  console.log(renderHuntQualityText(summary));

  const reasons = Object.entries(summary.skipReasons).sort((a, b) => b[1] - a[1]);
  if (reasons.length) {
    console.log("\nOwner miss reasons:");
    for (const [reason, count] of reasons) console.log(`• ${reason}: ${count}`);
  }
  console.log("\nSafety: read-only report; no discovery, draft or send path imported.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
