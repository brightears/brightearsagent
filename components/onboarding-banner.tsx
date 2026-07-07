import Link from "next/link";
import { getCurrentBusiness } from "@/lib/tenant";
import { getSetupStatus } from "@/lib/onboarding-status";
import { buttonStyles } from "@/components/ui";
import { GradientBlob, HaloRing, StickerChip } from "@/components/collage";

/**
 * "Resume setup" nudge on the dashboard. Onboarding is considered incomplete
 * while the profile essentials (sound/style, one-liner, fee floor) or the
 * voice are missing — the things the drafter and the Hunt actually feed on
 * (lib/onboarding-status.ts). Renders nothing once both exist, so a finished
 * wizard never sees this again.
 *
 * v2 (docs/DESIGN.md): a cream poster band floating on the ink — ink sticker
 * chip (setup is interface work, not a celebration) + the cyan primary CTA.
 */
export async function OnboardingBanner() {
  const business = await getCurrentBusiness().catch(() => null);
  if (!business) return null;

  const { needsProfile, needsVoice, incomplete } = getSetupStatus(business);
  if (!incomplete) return null;

  const missing =
    needsProfile && needsVoice
      ? "who you are and how you sound"
      : needsProfile
        ? "who you are (your sound, one-liner and rate floor)"
        : "how you sound";

  return (
    <div className="relative mb-6">
      <GradientBlob tone="cyan" className="-bottom-5 -left-4 h-20 w-40" />
      <div className="relative flex flex-wrap items-center gap-4 overflow-hidden rounded-3xl bg-cream px-6 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
        <HaloRing width={150} height={54} tilt={-10} className="-right-9 -top-4" />
        <StickerChip tone="ink" rotate={-3} className="relative shrink-0">
          Soundcheck pending
        </StickerChip>
        <p className="relative min-w-48 flex-1 text-sm text-ink-stage/75">
          <span className="font-bold text-ink-stage">Almost there —</span> once we know {missing},
          replies sound like you and the Hunt knows exactly what to look for.
        </p>
        <Link href="/onboarding" className={`relative ${buttonStyles.primary} text-sm`}>
          Resume setup →
        </Link>
      </div>
    </div>
  );
}
