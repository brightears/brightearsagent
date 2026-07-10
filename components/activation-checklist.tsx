import Link from "next/link";
import { db } from "@/lib/db";
import { getSetupStatus } from "@/lib/onboarding-status";
import { buttonStyles, CheckMark } from "@/components/ui";
import { GradientBlob, HaloRing, StickerChip } from "@/components/collage";

/**
 * ONE activation surface for the first-run dashboard (audit 2026-07: a fresh
 * user faced four competing callouts — resume-setup, choose-a-plan, no-leads
 * welcome, finish-your-profile). This checklist replaces the pile: the four
 * things between a new artist and a working agent, in order, with exactly one
 * primary CTA (the first open item). Renders nothing once the agent is live.
 *
 * Visual: the cream poster band the OnboardingBanner used (ink sticker chip —
 * setup is interface work, not a celebration; cyan primary CTA).
 */
export async function ActivationChecklist({
  business,
  subscribed,
}: {
  business: {
    id: string;
    genres: string[];
    headline: string | null;
    feeFloor: number | null;
    voiceSamples?: string | null;
    voiceGreeting?: string | null;
    voiceSignoff?: string | null;
    serviceCities: string[];
  };
  subscribed: boolean;
}) {
  const setup = getSetupStatus(business);
  // Any lead EVER (spam included) proves the forwarding pipe works — that's
  // the same signal the step-5 live verifier uses.
  const leadCount = await db.lead.count({ where: { businessId: business.id } });

  // Order = the artist's real journey (founder 2026-07): profile → where to
  // hunt → subscribe (turns the Hunt ON) → then the OPTIONAL reactive inbox.
  // Connecting an inbox is the "also", never a gate on the agent hunting.
  const items: {
    label: string;
    detail: string;
    done: boolean;
    href: string;
    cta: string;
    optional?: boolean;
  }[] = [
    {
      label: "Tell us who you are & how you sound",
      detail: "Your sound, one-liner, rate floor and voice — what every reply and pitch is built from.",
      done: !setup.incomplete,
      href: "/onboarding",
      cta: "Resume setup",
    },
    {
      label: "Set your home city",
      detail: "Where the agent hunts for venues first.",
      done: business.serviceCities.length > 0,
      href: setup.incomplete ? "/onboarding" : "/dashboard/settings#hunt",
      cta: "Set your city",
    },
    {
      label: "Choose your plan",
      detail: "Subscribe to activate — the agent starts hunting venues and drafting pitches in your voice from that moment.",
      done: subscribed,
      href: "/dashboard/settings#billing",
      cta: "Choose your plan",
    },
    {
      label: "Connect your inbox (optional)",
      detail: "Already getting inquiries from The Knot, your site or word of mouth? Forward them here and the agent answers those in your voice too.",
      done: leadCount > 0,
      href: "/onboarding",
      cta: "Connect inbox",
      optional: true,
    },
  ];

  // "Going live" = the three CORE steps. The optional inbox connect never holds
  // the checklist open, and the loud CTA is always the first incomplete core step.
  const core = items.filter((i) => !i.optional);
  const coreDone = core.filter((i) => i.done).length;
  if (coreDone === core.length) return null;
  const primary = core.find((i) => !i.done)!;

  return (
    <div className="relative mb-6">
      <GradientBlob tone="cyan" className="-bottom-5 -left-4 h-20 w-40" />
      <div className="relative overflow-hidden rounded-3xl bg-cream px-6 py-5 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
        <HaloRing width={150} height={54} tilt={-10} className="-right-9 -top-4" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <StickerChip tone="ink" rotate={-3} className="shrink-0">
            Going live — {coreDone} of {core.length}
          </StickerChip>
          <Link href={primary.href} className={`${buttonStyles.primary} text-sm`}>
            {primary.cta} →
          </Link>
        </div>

        <ul className="relative mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {items.map((item, i) => (
            <li key={item.label} className="flex items-start gap-2.5">
              {item.done ? (
                <CheckMark className="mt-0.5 size-4 flex-none text-brand-cyan" />
              ) : (
                <span
                  aria-hidden
                  className="mt-0.5 flex size-4 flex-none items-center justify-center rounded-full border-[1.5px] border-ink-stage/30 font-mono text-[9px] font-bold text-ink-stage/50"
                >
                  {i + 1}
                </span>
              )}
              <div className="min-w-0">
                <p
                  className={`text-sm font-bold leading-tight ${
                    item.done ? "text-ink-stage/45 line-through decoration-ink-stage/25" : "text-ink-stage"
                  }`}
                >
                  {item.done || item === primary ? (
                    item.label
                  ) : (
                    <Link href={item.href} className="hover:text-brand-cyan transition-colors">
                      {item.label}
                    </Link>
                  )}
                  <span className="sr-only">{item.done ? " — done" : " — to do"}</span>
                </p>
                {!item.done && (
                  <p className="mt-0.5 text-xs leading-snug text-ink-stage/55">{item.detail}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
