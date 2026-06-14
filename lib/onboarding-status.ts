import { db } from "@/lib/db";

/**
 * Onboarding is incomplete while a business has no packages OR no voice samples
 * — the two things the drafter can't work without. Single source of truth for
 * the dashboard empty-state and the OnboardingBanner (audit C4) so the first-run
 * dashboard shows ONE next action, never competing "finish setup" vs "connect
 * your leads" CTAs.
 */
export async function getSetupStatus(business: { id: string; voiceSamples?: string | null }) {
  const packageCount = await db.package.count({ where: { businessId: business.id } });
  const needsPackages = packageCount === 0;
  const needsVoice = !business.voiceSamples?.trim();
  return { needsPackages, needsVoice, incomplete: needsPackages || needsVoice };
}
