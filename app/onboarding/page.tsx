import type { Metadata } from "next";
import { getCurrentBusiness } from "@/lib/tenant";
import { OnboardingWizard } from "@/components/onboarding-wizard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Get set up — Bright Ears",
  description: "Five quick steps and every inquiry you get starts answering itself.",
};

const wholeUnits = (cents: number | null) => (cents === null ? "" : String(cents / 100));

export default async function OnboardingPage() {
  const business = await getCurrentBusiness();

  // Resume heuristic (June 2026): step 2 is now the artist PROFILE, so its
  // completion is what tells us how far the user got — genres + a one-liner +
  // a one-off floor is the "step 2 done" bar (the same fields it requires to
  // advance). Step-1 fields always hold signup defaults, so they're no signal.
  const hasProfile =
    business.genres.length > 0 && Boolean(business.headline?.trim()) && business.feeFloor !== null;
  const hasVoice = Boolean(business.voiceSamples?.trim());
  const initialStep = !hasProfile ? (business.genres.length > 0 ? 1 : 0) : hasVoice ? 3 : 2;

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
      initialProfile={{
        genres: business.genres.join(", "),
        headline: business.headline ?? "",
        bio: business.bio ?? "",
        videoLinks: business.videoLinks.join("\n"),
        socialLinks: business.socialLinks.join("\n"),
        riderNotes: business.riderNotes ?? "",
        gigTypes: business.gigTypes,
        acceptsTravel: business.acceptsTravel,
        feeFloor: wholeUnits(business.feeFloor),
        residencyRate: wholeUnits(business.residencyRate),
      }}
    />
  );
}
