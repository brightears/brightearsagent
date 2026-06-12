// Jurisdiction rules engine for cold venue outreach (ADR-004 Decision 4).
// PURE — no DB, no env, no clock. Rules are keyed on the RECIPIENT's country
// (the venue's), never the sender's. Fail-closed: anything we haven't
// researched is treated as consent-required.
//
// Modes:
//   STANDARD — cold B2B email is lawful with sender identity + a working
//              opt-out. The agent may queue the send (10.5) after approval.
//   CONSENT  — cold email needs prior consent. The agent may DRAFT but never
//              auto-send; the card becomes a handoff (artist copies the pitch
//              and sends it personally, owning the judgment call).
//   STRICT   — treated exactly like CONSENT in behavior; kept distinct so the
//              UI can cite the right regime and future rules can diverge.

export type JurisdictionMode = "STANDARD" | "CONSENT" | "STRICT";

export type Jurisdiction = {
  mode: JurisdictionMode;
  /** One plain-language line the review card can show the artist. */
  note: string;
};

// Maintained map — every entry cites its rule class. Extend deliberately;
// unknown countries fall through to CONSENT (fail-closed), never STANDARD.
const RULES: Record<string, Jurisdiction> = {
  // CAN-SPAM (US): opt-out regime — identity + opt-out line required.
  US: { mode: "STANDARD", note: "" },
  // PECR/UK GDPR (GB): B2B email to corporate subscribers is opt-out based —
  // identity + opt-out required.
  GB: { mode: "STANDARD", note: "" },
  // Thailand PDPA: legitimate-interest B2B outreach with identity + opt-out.
  TH: { mode: "STANDARD", note: "" },
  // New Zealand UEMA: business-relevant address, identity + unsubscribe.
  NZ: { mode: "STANDARD", note: "" },
  // Ireland ePrivacy Regs: B2B email opt-out based (unlike DE), identity + opt-out.
  IE: { mode: "STANDARD", note: "" },
  // Singapore Spam Control Act: opt-out regime for B2B, identity + unsubscribe.
  SG: { mode: "STANDARD", note: "" },
  // Australia Spam Act 2003: inferred consent applies to conspicuously
  // published business contacts relevant to the message — STANDARD, but with
  // a conservative footer and this note on the card.
  AU: {
    mode: "STANDARD",
    note: "Australia: lawful via the venue's published booking contact — keep it strictly relevant to their business.",
  },
  // Canada CASL: cold commercial email requires consent (implied consent for
  // published business addresses is narrow and risky — CAD $10M penalties).
  // Agent drafts; the artist copies and sends personally.
  CA: {
    mode: "CONSENT",
    note: "Canada: agents can't auto-send here (CASL) — copy the pitch and send it yourself.",
  },
  // Germany UWG §7: any commercial email without prior express consent is an
  // unzumutbare Belästigung, B2B included. Treat like CONSENT.
  DE: {
    mode: "STRICT",
    note: "Germany: cold email needs prior consent (UWG) — copy the pitch and send it yourself.",
  },
  // Austria TKG §174: same consent-first regime as Germany.
  AT: {
    mode: "STRICT",
    note: "Austria: cold email needs prior consent — copy the pitch and send it yourself.",
  },
};

const UNKNOWN: Jurisdiction = {
  mode: "CONSENT",
  note: "We don't know this country's cold-email rules — copy the pitch and send it yourself.",
};

export function jurisdictionFor(countryISO2: string): Jurisdiction {
  return RULES[countryISO2.trim().toUpperCase()] ?? UNKNOWN;
}

/**
 * The compliance close appended to an approved pitch — at approval/send time,
 * NEVER stored in the editable body (the owner reviews clean copy; the footer
 * can't be edited away — same pattern as app/actions/drafts.ts).
 *
 * This is personal 1:1 B2B correspondence, so the opt-out is a human sentence,
 * not a newsletter unsubscribe link. Identity line = real business name + city.
 */
export function pitchFooter(opts: {
  mode: JurisdictionMode;
  businessName: string;
  /** The artist's home base — first service city is a fine input. */
  city: string;
  venueName: string;
}): string {
  const identity = opts.city ? `${opts.businessName} · ${opts.city}` : opts.businessName;
  // CONSENT/STRICT pitches are sent personally by the artist — the close stays
  // human but makes the no-follow-up promise explicit (consent-first regimes).
  const optOut =
    opts.mode === "STANDARD"
      ? `If this isn't relevant for ${opts.venueName}, just reply and tell me — I won't write again.`
      : `If this isn't relevant for ${opts.venueName}, tell me and that's the last you'll hear from me — promise.`;
  return ["", "—", identity, optOut].join("\n");
}
