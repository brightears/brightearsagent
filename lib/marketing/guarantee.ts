// Risk-reversal copy — the SINGLE source of truth for it.
//
// POLICY (founder decision 2026-06-16): there is NO free trial. You SUBSCRIBE to
// activate — Starter/Pro/Studio, month-to-month, cancel anytime; at your plan's
// cap we PAUSE rather than surprise-bill. Selected, exact-email beta invites
// receive a separate 30-day Starter entitlement with no Stripe subscription;
// this is shown only inside that tester's authenticated onboarding/settings,
// never in public marketing. The backend keeps ordinary signups paused until
// they subscribe. The old unenforceable "pays for itself in your
// first season" claim STAYS removed for legal reasons (FTC §5 / UK DMCC / AU ACL
// §18 / CA Competition Act). Cancellation/billing terms live in /terms.
// Every page + schema.org JSON-LD references THESE constants, so the wording
// lives in one place. The cap-pause line is independently true.
//
// PUBLIC DISPLAYED COPY: never say "free trial" or "no card"; the primary CTA
// remains "Get started". The authenticated invited-beta status card is the
// deliberate exception: it must state that no payment method was collected and
// there is no automatic renewal so the tester understands the billing boundary.
export const RISK_REVERSAL = {
  /** Compact line for tight CTAs and metadata. */
  short: "Subscribe to activate. Cancel anytime.",
  /** Fuller statement for FAQ answers and feature blocks. */
  full:
    "Subscribe to activate — month-to-month, cancel anytime. At your plan's cap we pause rather than bill you by surprise.",
  /** The cap behavior on its own (true today). */
  capLine: "At your cap we pause — never a surprise bill.",
} as const;
