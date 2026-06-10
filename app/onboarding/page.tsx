import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { OnboardingWizard } from "@/components/onboarding-wizard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Get set up — Bright Ears",
  description: "Five quick steps and every inquiry you get starts answering itself.",
};

export default async function OnboardingPage() {
  const business = await getCurrentBusiness();

  const packages = await db.package.findMany({
    where: { businessId: business.id, active: true },
    orderBy: { name: "asc" },
    select: { name: true, priceMin: true, priceMax: true, eventTypes: true },
  });

  // Resume heuristic: step-1 fields always hold values (signup defaults), so
  // packages + voice samples are the real progress signals. Jump past what's done.
  const hasVoice = Boolean(business.voiceSamples?.trim());
  const initialStep = packages.length === 0 ? 0 : hasVoice ? 3 : 2;

  return (
    <OnboardingWizard
      initialStep={initialStep}
      business={{
        slug: business.slug,
        name: business.name,
        ownerName: business.ownerName,
        performerKind: business.performerKind,
        country: business.country,
        timezone: business.timezone,
        websiteUrl: business.websiteUrl,
        voiceSamples: business.voiceSamples,
      }}
      existingPackages={packages.map((p) => ({
        name: p.name,
        priceMinDollars: p.priceMin / 100,
        priceMaxDollars: p.priceMax === null ? null : p.priceMax / 100,
        eventTypes: p.eventTypes,
      }))}
    />
  );
}
