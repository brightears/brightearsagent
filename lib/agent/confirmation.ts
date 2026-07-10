import { db } from "@/lib/db";
import { notifyBusiness } from "@/lib/notify";
import { formatMinor } from "@/lib/quote/fee";

/**
 * Booking-confirmation draft (P11.2): created the moment a lead is marked
 * BOOKED. Deliberately DETERMINISTIC — a confirmation is a contractual
 * email; the details (date, venue, fee, booking link) must be the real ones,
 * so there is no LLM in this path, just the artist's saved greeting/signoff
 * around grounded facts. The owner approves it like any draft; it is the one
 * draft sendDraftReply allows on a BOOKED lead (isConfirmation carve-out),
 * it never starts a follow-up sequence, and wantsQuote pre-arms the quote
 * PDF attachment (the written record of the fee).
 */
export async function draftBookingConfirmation(
  leadId: string,
  feeMinor: number | null,
): Promise<string | null> {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: { business: true },
  });
  if (!lead || !lead.clientEmail || lead.optedOut) return null;

  // Dedupe like every other draft path — never stack PENDING drafts.
  const existing = await db.draft.findFirst({
    where: { leadId, status: "PENDING" },
    select: { id: true },
  });
  if (existing) return null;

  const b = lead.business;
  const firstName = (lead.clientName ?? "").trim().split(/\s+/)[0] || "there";
  const greeting = (b.voiceGreeting ?? "Hi [name],").replace(/\[name\]/gi, firstName);
  const signoff = b.voiceSignoff ?? "Best regards,";

  const when = lead.eventDate
    ? lead.eventDate.toLocaleDateString("en-US", {
        timeZone: b.timezone,
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const what = [lead.eventType, when ? `on ${when}` : null, lead.venue ? `at ${lead.venue}` : null]
    .filter(Boolean)
    .join(" ");

  const body = [
    greeting,
    "",
    `Wonderful news — consider the date locked in${what ? ` for your ${what}` : ""}. We're thrilled to be part of it.`,
    ...(feeMinor ? ["", `As agreed, the fee is ${formatMinor(feeMinor, b.currency)}.`] : []),
    ...(b.bookingLinkUrl
      ? ["", `To make everything official, you can complete the booking here: ${b.bookingLinkUrl}`]
      : []),
    "",
    "If any detail changes — timings, address, special requests — just reply to this email and we'll take care of it.",
    "",
    signoff,
    b.name,
  ].join("\n");

  const draft = await db.draft.create({
    data: {
      leadId,
      subject: `Booked${when ? ` — ${when}` : ""}: ${lead.eventType ?? "your event"} confirmation`,
      body,
      isConfirmation: true,
      // Pre-arm the quote PDF ONLY when no fee was captured (P15 review): the
      // quote engine prices from packages/floor, which can DIFFER from the
      // agreed fee stated in the body — attaching both would put two
      // contradictory numbers in one email. A captured fee IS the record.
      wantsQuote: feeMinor == null,
      expiresAt: new Date(Date.now() + 14 * 24 * 3600 * 1000),
    },
  });

  void notifyBusiness(b, {
    title: `Confirmation ready: ${lead.clientName ?? "your new booking"}`,
    body: "The booking-confirmation email is drafted — one tap sends it.",
    url: `/dashboard/leads/${leadId}`,
    emailBody: `You marked ${lead.clientName ?? "a lead"} as booked — a confirmation email (details, ${b.bookingLinkUrl ? "your booking link, " : ""}quote PDF option) is drafted and waiting for your approval.`,
  }).catch(() => null);

  return draft.id;
}
