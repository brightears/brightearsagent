/**
 * Onboarding is incomplete while the PROFILE ESSENTIALS or the VOICE are
 * missing — the things the drafter and the Hunt actually feed on:
 *
 *  - profile essentials = genres + headline + one-off fee floor, exactly what
 *    the wizard's "Who you are" step requires before it lets you advance
 *    (docs/ONBOARDING-REDESIGN-JUNE-2026.md). The Hunt matches on
 *    Business.genres/serviceCities and the drafter quotes above feeFloor.
 *  - voice = pasted samples OR the structured signals (greeting/sign-off)
 *    a "skip for now" default writes — either is enough to draft with.
 *
 * Packages are deliberately NOT required: the Hunt never reads Package, the
 * redesigned wizard doesn't create one, and packages live on at
 * /dashboard/packages purely to sharpen inbound quoting.
 *
 * Single source of truth for the dashboard first-run and the OnboardingBanner
 * (audit C4: the first-run dashboard shows ONE next action).
 */
export function getSetupStatus(business: {
  genres: string[];
  headline: string | null;
  feeFloor: number | null;
  voiceSamples?: string | null;
  voiceGreeting?: string | null;
  voiceSignoff?: string | null;
}) {
  const needsProfile =
    business.genres.length === 0 || !business.headline?.trim() || !business.feeFloor;
  const needsVoice =
    !business.voiceSamples?.trim() &&
    !business.voiceGreeting?.trim() &&
    !business.voiceSignoff?.trim();
  return { needsProfile, needsVoice, incomplete: needsProfile || needsVoice };
}
