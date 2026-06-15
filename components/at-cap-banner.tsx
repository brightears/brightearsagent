// At-cap / trial-ended banner (audit C3) — the agent-paused state used to
// surface ONLY via an optional push; this banner makes it visible in the app so
// an owner with push off still sees that drafting paused and how to switch it
// back on. Pure presentation (server component, no hooks): the caller computes
// the meter + billing state and passes the already-resolved shape.
//
// Trial model (FINAL founder decision 2026-06-14, lib/billing/metering.ts):
//   - EXPIRED trial, unsubscribed  → agent paused → "trial ended, choose a plan"
//   - PAID plan over the lead cap  → drafting paused until next month → "upgrade"
//   - ACTIVE trial, or under-cap paid → NOT paused → render nothing.
// The CTA links to /dashboard/settings, where the checkout/portal forms live.

import Link from "next/link";
import { Kicker, buttonStyles } from "@/components/ui";

export type AtCapBannerProps = {
  /** Leads counted this month (non-SPAM). */
  used: number;
  /** This plan's monthly lead cap. */
  cap: number;
  /** meterState().overCap — agent paused (expired trial) OR used > cap. */
  overCap: boolean;
  /** A live paid subscription exists (billingState().subscribed). */
  subscribed: boolean;
  /** An active free trial (billingState().trialActive). */
  trialActive: boolean;
};

/**
 * Returns the banner, or null when nothing should show. Two paused cases only:
 * an expired trial (unsubscribed) or a paid plan over its lead cap. An active
 * trial and an under-cap paid plan render nothing — the agent is working.
 */
export function AtCapBanner({ used, cap, overCap, subscribed, trialActive }: AtCapBannerProps) {
  // Active trial → agent is live, never warn. (overCap can't be true here:
  // isAgentPaused is false during an active trial, and used > cap would be a
  // separate alarm we don't raise mid-trial — the trial allowance is full Pro.)
  if (trialActive) return null;
  if (!overCap) return null;

  // Distinguish the two paused reasons. Expired-trial-unsubscribed is the only
  // case where neither subscribed nor trialActive is true.
  const trialEnded = !subscribed;

  return (
    <section className="mb-8">
      <div className="rounded-3xl border border-[#ffdfba]/40 bg-[#ffdfba] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.25)]">
        <Kicker onLight>{trialEnded ? "Trial ended" : "Lead cap reached"}</Kicker>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm font-medium text-[#7a4100]">
            {trialEnded ? (
              <>
                Your free trial has ended — your setup is saved, but the Hunt has
                stopped finding venues and drafting your outreach, and inbound
                replies are paused too. New leads still arrive and nothing is lost.
                Choose a plan to switch your agent back on.
              </>
            ) : (
              <>
                You&apos;ve used{" "}
                <span className="font-bold">
                  {used} of {cap}
                </span>{" "}
                leads this month — drafting is paused until next month. Upgrade for
                more. New leads still arrive; nothing is lost, and no surprise bill,
                ever.
              </>
            )}
          </p>
          <Link
            href="/dashboard/settings#billing"
            className={`${buttonStyles.primary} flex-none whitespace-nowrap text-center`}
          >
            {trialEnded ? "Choose a plan" : "Upgrade"}
          </Link>
        </div>
      </div>
    </section>
  );
}
