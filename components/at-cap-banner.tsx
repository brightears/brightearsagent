// Agent-paused banner (audit C3) — surfaces in the app (not just an optional
// push) so an owner sees the agent is paused and how to switch it on. Pure
// presentation (server component): the caller passes the resolved meter + state.
//
// No free trial (founder 2026-06-16): two paused cases only —
//   - NOT subscribed            → agent paused → "subscribe to switch it on"
//   - PAID plan over the lead cap → drafting paused until next month → "upgrade"
//   - subscribed & under cap     → NOT paused → render nothing.
// The CTA links to /dashboard/settings#billing (the plan cards / portal).

import Link from "next/link";
import { Kicker, buttonStyles } from "@/components/ui";

export type AtCapBannerProps = {
  /** Leads counted this month (non-SPAM). */
  used: number;
  /** This plan's monthly lead cap. */
  cap: number;
  /** meterState().overCap — agent paused (unsubscribed) OR used > cap. */
  overCap: boolean;
  /** A live paid subscription exists (billingState().subscribed). */
  subscribed: boolean;
};

/**
 * Returns the banner, or null when nothing should show. An under-cap paid plan
 * renders nothing — the agent is working.
 */
export function AtCapBanner({ used, cap, overCap, subscribed }: AtCapBannerProps) {
  // Subscribed and under cap → agent live, no banner. (Unsubscribed is always
  // overCap via isAgentPaused, so it always shows the "subscribe" banner.)
  if (subscribed && !overCap) return null;

  const notSubscribed = !subscribed;

  return (
    <section className="mb-8">
      <div className="rounded-3xl border border-[#ffdfba]/40 bg-[#ffdfba] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.25)]">
        <Kicker onLight>{notSubscribed ? "Agent paused" : "Lead cap reached"}</Kicker>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm font-medium text-[#7a4100]">
            {notSubscribed ? (
              <>
                Your agent is paused — your setup is saved, but the Hunt isn&apos;t finding venues
                or drafting outreach, and inbound replies are on hold. New inquiries still arrive and
                nothing is lost. Choose a plan to switch your agent on.
              </>
            ) : (
              <>
                You&apos;ve used{" "}
                <span className="font-bold">
                  {used} of {cap}
                </span>{" "}
                inquiries this month — drafting is paused until next month. Upgrade for
                more. New inquiries still arrive; nothing is lost, and no surprise bill,
                ever.
              </>
            )}
          </p>
          <Link
            href="/dashboard/settings#billing"
            className={`${buttonStyles.primary} flex-none whitespace-nowrap text-center`}
          >
            {notSubscribed ? "Choose a plan" : "Upgrade"}
          </Link>
        </div>
      </div>
    </section>
  );
}
