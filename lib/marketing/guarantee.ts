// Risk-reversal copy — the SINGLE source of truth for it.
//
// POLICY (FINAL founder decision, 2026-06-14, research-backed): a **14-day,
// no-card FREE TRIAL** of full Pro, then month-to-month, cancel anytime — and
// NO money-back guarantee. An earlier pass had flipped this to "subscribe to
// activate + 30-day money-back guarantee"; the founder REVERSED that after
// best-practice research: the product's value is setup-gated, so letting an
// owner FEEL the agent work before paying activates far better than charging
// first, and offering both a free trial AND a money-back guarantee is redundant.
// The old unenforceable "pays for itself in your first season" claim STAYS
// removed for legal reasons (FTC §5 / UK DMCC / AU ACL §18 / CA Competition
// Act). Cancellation/billing terms live in /terms (there is no money-back page).
// Every page + schema.org JSON-LD references THESE constants, so the wording
// lives in one place. The cap-pause line is independently true.
//
// DISPLAYED COPY — "no card" omitted ON PURPOSE (founder, 2026-06-16): the
// trial mechanism is still card-free (the POLICY above is unchanged), but the
// founder does not want "no card" / "no credit card" said in any marketing or
// CTA — it read as jargon to the performer audience. CTAs say "Start free" and
// the fine print says "14-day free trial · cancel anytime". Do NOT re-add "no
// card" to these strings or any visible copy.
export const RISK_REVERSAL = {
  /** Compact line for tight CTAs and metadata. */
  short: "14-day free trial. Cancel anytime.",
  /** Fuller statement for FAQ answers and feature blocks. */
  full:
    "Start with 14 days of full Pro — free. Month-to-month after that: cancel anytime, and at your plan's cap we pause rather than bill you by surprise.",
  /** The cap behavior on its own (true today). */
  capLine: "At your cap we pause — never a surprise bill.",
} as const;
