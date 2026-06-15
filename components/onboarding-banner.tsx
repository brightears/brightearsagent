import Link from "next/link";
import { getCurrentBusiness } from "@/lib/tenant";
import { getSetupStatus } from "@/lib/onboarding-status";
import { buttonStyles } from "@/components/ui";
import { GradientBlob, HaloRing, StickerChip } from "@/components/collage";

/**
 * "Resume setup" nudge on the dashboard. Onboarding is considered incomplete
 * while the business has no packages OR no voice samples — the two things the
 * drafter can't work without. Renders nothing once both exist.
 *
 * v2 (docs/DESIGN.md): a cream poster band floating on the ink — ink sticker
 * chip (setup is interface work, not a celebration) + the cyan primary CTA.
 */
export async function OnboardingBanner() {
  const business = await getCurrentBusiness().catch(() => null);
  if (!business) return null;

  const { needsPackages, needsVoice, incomplete } = await getSetupStatus(business);
  if (!incomplete) return null;

  const missing =
    needsPackages && needsVoice
      ? "your packages and your voice"
      : needsPackages
        ? "your packages"
        : "your voice samples";

  return (
    <div className="relative mb-6">
      <GradientBlob tone="cyan" className="-bottom-5 -left-4 h-20 w-40" />
      <div className="relative flex flex-wrap items-center gap-4 overflow-hidden rounded-3xl bg-cream px-6 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
        <HaloRing width={150} height={54} tilt={-10} className="-right-9 -top-4" />
        <StickerChip tone="ink" rotate={-3} className="relative shrink-0">
          Soundcheck pending
        </StickerChip>
        <p className="relative min-w-48 flex-1 text-sm text-ink-stage/75">
          <span className="font-bold text-ink-stage">Almost there —</span> once we have {missing}, the
          Hunt starts finding venues that fit you and the assistant can reply in your voice.
        </p>
        <Link href="/onboarding" className={`relative ${buttonStyles.primary} text-sm`}>
          Resume setup →
        </Link>
      </div>
    </div>
  );
}
