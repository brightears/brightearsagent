import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { buttonStyles } from "@/components/ui";

/**
 * "Resume setup" nudge on the dashboard. Onboarding is considered incomplete
 * while the business has no packages OR no voice samples — the two things the
 * drafter can't work without. Renders nothing once both exist.
 */
export async function OnboardingBanner() {
  const business = await getCurrentBusiness().catch(() => null);
  if (!business) return null;

  const packageCount = await db.package.count({ where: { businessId: business.id } });
  const needsPackages = packageCount === 0;
  const needsVoice = !business.voiceSamples?.trim();
  if (!needsPackages && !needsVoice) return null;

  const missing =
    needsPackages && needsVoice
      ? "your packages and your voice"
      : needsPackages
        ? "your packages"
        : "your voice samples";

  return (
    <div className="mb-6 flex flex-wrap items-center gap-4 rounded-3xl bg-gradient-to-r from-warm-peach/50 via-soft-lavender/25 to-brand-cyan-soft/40 px-6 py-4">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-xl shadow-sm"
        aria-hidden
      >
        🪄
      </span>
      <p className="min-w-48 flex-1 text-sm text-deep-teal">
        <span className="font-semibold">Almost there —</span> we still need {missing} before
        replies can sound like you.
      </p>
      <Link href="/onboarding" className={`${buttonStyles.primary} text-sm`}>
        Resume setup →
      </Link>
    </div>
  );
}
