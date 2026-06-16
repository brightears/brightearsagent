// Risk-reversal copy — the SINGLE source of truth for it.
//
// POLICY (founder decision 2026-06-16): there is NO free trial. You SUBSCRIBE to
// activate — Starter/Pro/Studio, month-to-month, cancel anytime; at your plan's
// cap we PAUSE rather than surprise-bill. (Selected artists get a free first
// month via a private Stripe promotion code — this is NEVER mentioned anywhere
// on the site; do NOT reference trials or codes in any visible copy.) The
// backend already enforces no-trial (lib/billing/metering.ts: new tenants are
// paused until they subscribe). The old unenforceable "pays for itself in your
// first season" claim STAYS removed for legal reasons (FTC §5 / UK DMCC / AU ACL
// §18 / CA Competition Act). Cancellation/billing terms live in /terms.
// Every page + schema.org JSON-LD references THESE constants, so the wording
// lives in one place. The cap-pause line is independently true.
//
// DISPLAYED COPY: never say "no card" / "no credit card" anywhere (founder,
// 2026-06-16) — it read as jargon to the performer audience. The primary CTA is
// "Get started". Do NOT re-add "free trial" or "no card" to these strings or any
// visible copy.
export const RISK_REVERSAL = {
  /** Compact line for tight CTAs and metadata. */
  short: "Subscribe to activate. Cancel anytime.",
  /** Fuller statement for FAQ answers and feature blocks. */
  full:
    "Subscribe to activate — month-to-month, cancel anytime. At your plan's cap we pause rather than bill you by surprise.",
  /** The cap behavior on its own (true today). */
  capLine: "At your cap we pause — never a surprise bill.",
} as const;
