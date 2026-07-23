import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyOptoutToken } from "@/lib/optout";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

// Styled, on-brand confirmation page (audit C4-NF). White-label invariant: this
// is a client-facing surface, so it shows the TENANT'S business name only —
// never "AI" or "Bright Ears". Falls back to a generic message when the lead
// can't be resolved (preserves the no-enumeration behavior below).
// `formHtml` (already-escaped markup) renders below the message — the GET
// confirm step uses it for the POST form.
function page(title: string, message: string, status: number, formHtml = "") {
  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<meta name="robots" content="noindex"><title>${esc(title)}</title></head>` +
      `<body style="margin:0;background:#17161f;color:#e8e4dc;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">` +
      `<main style="max-width:460px;margin:0 auto;padding:88px 24px;text-align:center">` +
      `<h1 style="font-size:22px;font-weight:800;letter-spacing:-0.01em;margin:0 0 12px">${esc(title)}</h1>` +
      `<p style="font-size:15px;line-height:1.6;color:#b8b4ac;margin:0">${esc(message)}</p>` +
      formHtml +
      `</main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

/**
 * GET is READ-ONLY by design: mail scanners and link-prefetchers (Outlook
 * SafeLinks, corporate gateways) follow every footer link — a state-changing
 * GET let them silently unsubscribe live leads. The GET renders a confirm
 * page whose form POSTs back here; only the POST mutates.
 */
export async function GET(req: NextRequest) {
  if (!rateLimit(`optout:${clientIp(req)}`, 30, 60_000).ok) {
    return page("Too many requests", "Please wait a moment and open the link again.", 429);
  }

  const leadId = req.nextUrl.searchParams.get("lead") ?? "";
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!leadId || !verifyOptoutToken(leadId, token)) {
    return page("Invalid link", "This unsubscribe link is no longer valid.", 400);
  }

  // Read-only lookup for the (white-label) business name. Unknown lead with a
  // valid token still shows the confirm page (no enumeration).
  const lead = await db.lead
    .findUnique({ where: { id: leadId }, select: { business: { select: { name: true } } } })
    .catch(() => null);
  const from = lead ? ` from ${lead.business.name}` : "";

  return page(
    "Unsubscribe?",
    `Confirm below and you won't receive any more messages${from} about this inquiry.`,
    200,
    `<form method="post" action="/api/optout" style="margin-top:28px">` +
      `<input type="hidden" name="lead" value="${esc(leadId)}">` +
      `<input type="hidden" name="token" value="${esc(token)}">` +
      `<button type="submit" style="background:#e8e4dc;color:#17161f;border:0;border-radius:8px;` +
      `padding:12px 28px;font-size:15px;font-weight:700;cursor:pointer">Unsubscribe</button>` +
      `</form>`,
  );
}

export async function POST(req: NextRequest) {
  if (!rateLimit(`optout:${clientIp(req)}`, 30, 60_000).ok) {
    return page("Too many requests", "Please wait a moment and try again.", 429);
  }

  let leadId = "";
  let token = "";
  try {
    const form = await req.formData();
    leadId = String(form.get("lead") ?? "");
    token = String(form.get("token") ?? "");
  } catch {
    return page("Invalid link", "This unsubscribe link is no longer valid.", 400);
  }
  if (!leadId || !verifyOptoutToken(leadId, token)) {
    return page("Invalid link", "This unsubscribe link is no longer valid.", 400);
  }

  // Opt out + stop sequences, capturing the (white-label) business name for the
  // confirmation. Unknown lead id with a valid-shaped token still shows success
  // (no enumeration).
  const businessName = await db
    .$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({
        where: { id: leadId },
        select: { business: { select: { name: true } } },
      });
      if (!lead) return null;
      await tx.lead.update({
        where: { id: leadId },
        data: { optedOut: true, status: "DEAD", deadAt: new Date() },
      });
      await tx.sequenceRun.updateMany({
        where: { leadId, stoppedAt: null },
        data: { stoppedAt: new Date(), stopReason: "opted_out" },
      });
      return lead.business.name;
    })
    .catch(() => null);

  const from = businessName ? ` from ${businessName}` : "";
  return page(
    "You're unsubscribed",
    `You won't receive any more messages${from} about this inquiry.`,
    200,
  );
}
