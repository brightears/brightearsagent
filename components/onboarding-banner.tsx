import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";

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
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-brand-cyan/40 bg-linear-to-r from-brand-cyan-soft/70 to-soft-lavender/30 px-4 py-3">
      <span className="text-xl" aria-hidden>
        🪄
      </span>
      <p className="min-w-48 flex-1 text-sm text-deep-teal">
        <span className="font-semibold">Almost there —</span> we still need {missing} before
        replies can sound like you.
      </p>
      <Link
        href="/onboarding"
        className="rounded-xl bg-brand-cyan px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Resume setup →
      </Link>
    </div>
  );
}
