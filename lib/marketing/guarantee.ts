// Risk-reversal copy — the SINGLE source of truth for it.
//
// AUDIT NOTE (audit/pre-launch, 2026-06-14): the previous guarantee
//   "if it doesn't pay for itself in your first season, full refund"
// was removed app-wide. Both triggers ("pays for itself", "season") were
// undefined and unenforceable — advertising-law exposure under US FTC §5,
// UK DMCC, AU ACL §18 and the CA Competition Act, and it was even being
// emitted as schema.org FAQ JSON-LD. Until the founder sets a REAL refund
// policy (see docs/AUDIT-FINDINGS.md → FOUNDER DECISIONS, FD for A1), we make
// ONLY claims that are already true in the product: a free trial, no card,
// cancel anytime, and a hard pause (never a surprise bill) at the lead cap.
//
// When the founder decides the final policy, change the wording HERE only and
// every page/JSON-LD that references these constants updates with it.
export const RISK_REVERSAL = {
  /** Compact line for tight CTAs and metadata. */
  short: "14-day free trial, no card. Cancel anytime.",
  /** Fuller statement for FAQ answers and feature blocks. */
  full:
    "Start with 14 days of full Pro — free, no card. After that it's month-to-month: cancel anytime, and at your lead cap we pause rather than bill you by surprise.",
  /** The cap behavior on its own (true today). */
  capLine: "At your cap, drafting pauses — never a surprise bill.",
} as const;
