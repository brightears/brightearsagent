import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { isProvisionedBusinessName } from "@/lib/business-name";
import { uploadsEnabled } from "@/lib/uploads/r2";
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
  // Voice counts as done with samples OR the skip-default greeting/sign-off
  // (mirrors lib/onboarding-status.ts). And once there's evidence the user got
  // past the calendar — any calendar entry (they used step 4) or any lead
  // (their forwarding already works, so they reached step 5's live test) —
  // resume to "Connect your leads" instead of replaying the calendar.
  const hasProfile =
    business.genres.length > 0 && Boolean(business.headline?.trim()) && business.feeFloor !== null;
  const hasVoice = Boolean(
    business.voiceSamples?.trim() ||
      business.voiceGreeting?.trim() ||
      business.voiceSignoff?.trim(),
  );
  const [gigCount, leadCount] =
    hasProfile && hasVoice
      ? await Promise.all([
          db.gig.count({ where: { businessId: business.id } }),
          db.lead.count({ where: { businessId: business.id } }),
        ])
      : [0, 0];
  const initialStep = !hasProfile
    ? business.genres.length > 0
      ? 1
      : 0
    : !hasVoice
      ? 2
      : gigCount > 0 || leadCount > 0
        ? 4
        : 3;

  return (
    <OnboardingWizard
      initialStep={initialStep}
      business={{
        slug: business.slug,
        // The provisioning default ("Norbert's Business") is not a stage name —
        // render the field empty (it's required) so the artist types their real
        // one instead of accidentally keeping a placeholder that would become
        // the From name on every client-facing email.
        name: isProvisionedBusinessName(business) ? "" : business.name,
        ownerName: business.ownerName,
        performerKind: business.performerKind,
        country: business.country,
        homeCity: business.serviceCities[0] ?? "",
        timezone: business.timezone,
        websiteUrl: business.websiteUrl,
        voiceSamples: business.voiceSamples,
        voiceGreeting: business.voiceGreeting,
        voiceSignoff: business.voiceSignoff,
        voiceUsesEmoji: business.voiceUsesEmoji,
        voicePhrases: business.voicePhrases,
      }}
      initialProfile={{
        genres: business.genres.join(", "),
        headline: business.headline ?? "",
        bio: business.bio ?? "",
        videoLinks: business.videoLinks.join("\n"),
        socialLinks: business.socialLinks.join("\n"),
        photoUrls: business.photoUrls,
        riderNotes: business.riderNotes ?? "",
        gigTypes: business.gigTypes,
        acceptsTravel: business.acceptsTravel,
        feeFloor: wholeUnits(business.feeFloor),
        residencyRate: wholeUnits(business.residencyRate),
      }}
      uploadsEnabled={uploadsEnabled}
    />
  );
}
