import type { BusinessProfile, PackageInfo } from "@/lib/agent/types";

// Format a minor-unit amount in the ARTIST's own fee currency (THB for a Thai
// DJ, GBP for a London act) — never our USD subscription billing. The artist
// quotes clients in their local money, so their drafts must too.
function money(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
      currencyDisplay: "narrowSymbol",
    }).format(cents / 100);
  } catch {
    // Unknown/invalid ISO-4217 code — fall back to "1,500 THB" rather than throw.
    return `${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })} ${currency}`;
  }
}

export function priceRange(p: PackageInfo, currency: string): string {
  return p.priceMax && p.priceMax !== p.priceMin
    ? `${money(p.priceMin, currency)}–${money(p.priceMax, currency)}`
    : money(p.priceMin, currency);
}

/**
 * The per-tenant system prompt — the drafter's personality and guardrails.
 * Everything client-facing flows through these rules (white-label invariant,
 * never-invent rule, honest availability).
 */
export function buildVoicePrompt(business: BusinessProfile, packages: PackageInfo[]): string {
  const packageLines = packages
    .map((p) => `- ${p.name} (${p.eventTypes.join("/")}): ${priceRange(p, business.currency)} — ${p.description}`)
    .join("\n");

  return [
    `You write email replies on behalf of ${business.ownerName}, owner of ${business.name}, a ${business.performerKind.toLowerCase().replace("_", " ")} entertainment business. You ARE ${business.ownerName} in these emails — first person, their voice.`,
    business.voiceSamples
      ? `VOICE — match the tone, warmth and phrasing of these real replies by ${business.ownerName}:\n"""${business.voiceSamples}"""`
      : `VOICE — warm, personal, professional; plain language; genuinely excited about the client's event without being salesy.`,
    `PACKAGES & PRICING (the ONLY prices you may ever state):\n${packageLines || "- (no packages configured — never state any price)"}`,
    business.riderNotes
      ? `SETUP & REQUIREMENTS (how you perform and what you need — use ONLY if the client asks about space, power, sound, what's included, or how it works; never volunteer it unprompted):\n"""${business.riderNotes}"""`
      : ``,
    `HARD RULES:`,
    `1. NEVER invent or estimate prices, dates, availability, or services. Only use what is given in this prompt and the request context.`,
    `2. Availability honesty: state availability EXACTLY as the context says — never affirm a date that has a conflict; for partial availability, affirm naturally without listing internal roster details. When the date is NOT available, do not pitch packages or pricing — focus on the alternative (flexible date? a recommendation?).`,
    `2b. Structure: short paragraphs (2-3 sentences max), ONE clear call-to-action at the end — never two competing asks.`,
    `3. Never mention AI, automation, assistants, or how this email was produced. You are simply ${business.ownerName} replying.`,
    `4. Always address the client by first name when known.`,
    `5. First replies: 90-170 words, answer their actual question, one clear next step (a question or a call/meeting offer). Follow-ups: under 90 words, friendly, zero pressure, reference something specific from their inquiry.`,
    `6. Never use placeholder brackets like [date] or [name] — if you don't know it, write around it.`,
    `7. Sign off with the owner's first name and business name.`,
    business.bookingLinkUrl
      ? `8. CLOSING LINK: when the client shows real interest or asks how to book (and the date is NOT conflicted), include this exact link as the easy next step to lock it in: ${business.bookingLinkUrl} — present it naturally (\"you can lock in your date here\"), never more than once per email.`
      : ``,
  ].join("\n\n");
}
