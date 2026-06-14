// Risk-reversal copy — the SINGLE source of truth for it.
//
// POLICY (founder decision, 2026-06-14): NO free trial. The risk-reversal is a
// **30-day money-back guarantee** — pay up front, full refund within 30 days,
// no questions asked. This replaced the earlier unenforceable "pays for itself
// in your first season" wording (FTC §5 / UK DMCC / AU ACL §18 / CA Competition
// Act exposure). The promise is honored operationally (Stripe refund) and stated
// in /refund-policy; every page + schema.org JSON-LD references THESE constants,
// so the wording lives in one place. The cap-pause line is independently true.
export const RISK_REVERSAL = {
  /** Compact line for tight CTAs and metadata. */
  short: "30-day money-back guarantee.",
  /** Fuller statement for FAQ answers and feature blocks. */
  full:
    "Try Bright Ears risk-free: if it's not for you, email us within 30 days for a full refund — no questions asked. Month-to-month after that, cancel anytime, and at your plan's cap we pause rather than bill you by surprise.",
  /** The cap behavior on its own (true today). */
  capLine: "At your cap we pause — never a surprise bill.",
} as const;
