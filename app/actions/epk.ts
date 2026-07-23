"use server";

import { headers } from "next/headers";
import { EPK_FORM_SENDER, processInbound } from "@/lib/inbound/pipeline";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/report-error";

export type EpkInquiryState = { ok: boolean; error?: string } | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * The EPK "Check availability" form (P12.5) — the loop closes on itself: a
 * booker lands on the pitch's one-pager, asks about a date, and the inquiry
 * enters THIS tenant's own inbound pipeline as a synthetic form notification
 * (system sender + labeled fields = the exact shape the fallback parser
 * classifies as WEBSITE_FORM). Spam triage, metering, drafting, and the
 * owner's ping all come free — an EPK inquiry is answered by the same agent
 * that sent the pitch.
 *
 * PUBLIC surface (no auth): slug-scoped, validated, honeypot-guarded. The
 * honeypot returns a fake success — bots get nothing to learn from.
 */
export async function submitEpkInquiry(
  slug: string,
  _prev: EpkInquiryState,
  formData: FormData,
): Promise<EpkInquiryState> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return { ok: false, error: "Something went wrong." };

  const field = (name: string, cap = 300) => {
    const v = formData.get(name);
    return typeof v === "string" ? v.trim().slice(0, cap) : "";
  };

  // Honeypot: real people never fill a field they can't see.
  if (field("website")) return { ok: true };

  // 14.2: each submission costs an LLM parse + triage — cap per IP+slug.
  const ip = clientIp({ headers: await headers() });
  const rl = rateLimit(`epk-inquiry:${slug}:${ip}`, 5, 10 * 60 * 1000);
  if (!rl.ok) {
    return { ok: false, error: "Too many messages just now — try again in a few minutes." };
  }

  const name = field("name", 120);
  const email = field("email", 200);
  const eventType = field("eventType", 80);
  const eventDate = field("eventDate", 20);
  const message = field("message", 2000);

  if (!name) return { ok: false, error: "Please add your name." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Please add a valid email address." };
  if (!message && !eventDate) {
    return { ok: false, error: "Tell us a little about your event — a date or a few words." };
  }

  const textBody = [
    "New availability inquiry via your page:",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    eventType && `Event type: ${eventType}`,
    eventDate && `Event date: ${eventDate}`,
    message && `Message: ${message}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const result = await processInbound({
      // System sender → WEBSITE_FORM. The pipeline recognizes this sender and
      // refuses to auto-send the first reply (attacker-supplied address —
      // manual approve only, see lib/inbound/pipeline.ts).
      from: EPK_FORM_SENDER,
      fromName: "Availability form",
      to: `leads@${slug}.in.brightears.io`,
      subject: `Availability inquiry${eventType ? ` — ${eventType}` : ""}${name ? ` from ${name}` : ""}`,
      textBody,
      receivedAt: new Date().toISOString(),
    });
    if (result.outcome === "no_tenant") return { ok: false, error: "Something went wrong." };
    return { ok: true };
  } catch (err) {
    void reportError(err, { kind: "epk-inquiry", slug });
    return { ok: false, error: "Something went wrong — please try again." };
  }
}
