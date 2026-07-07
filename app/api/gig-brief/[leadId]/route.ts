import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { extractGigBrief } from "@/lib/agent/gig-brief-extract";
import { renderGigBriefPdf, type GigBriefData } from "@/lib/pdf/gig-brief";
import { formatMinor } from "@/lib/quote/fee";
import { titleCaseEvent } from "@/lib/quote/compute";

// Gig-brief PDF (P11.3) — owner-only, tenant-scoped, BOOKED leads only. The
// grounded core (parsed facts + the calendar entry) always renders; the
// thread-extraction pass adds requests/logistics and degrades to empty
// sections on any LLM hiccup — the brief never fails because of it.

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await ctx.params;

  let business;
  try {
    business = await getCurrentBusiness();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const lead = await db.lead.findFirst({
    where: { id: leadId, businessId: business.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!lead) return new Response("Not found", { status: 404 });
  if (lead.status !== "BOOKED") {
    return new Response("The gig brief is available once this lead is booked.", { status: 422 });
  }

  const gig = await db.gig.findUnique({
    where: { leadId },
    include: { performer: { select: { name: true } } },
  });

  let extracted: Awaited<ReturnType<typeof extractGigBrief>> = {
    setTimes: null,
    specialRequests: [],
    practicalNotes: [],
  };
  if (lead.messages.length > 0) {
    try {
      extracted = await extractGigBrief({
        businessId: business.id,
        thread: lead.messages.map((m) => ({ direction: m.direction, body: m.body })),
      });
    } catch {
      // Extraction is a bonus — the grounded core still renders.
    }
  }

  const now = new Date();
  const eventDate = gig?.date ?? lead.eventDate;
  const data: GigBriefData = {
    artistName: business.name,
    performerLabel: gig?.performer?.name ?? null,
    clientName: lead.clientName,
    clientEmail: lead.clientEmail,
    clientPhone: lead.clientPhone,
    eventType: lead.eventType ? titleCaseEvent(lead.eventType) : null,
    eventDateLabel: eventDate
      ? new Intl.DateTimeFormat("en-GB", {
          timeZone: business.timezone,
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(eventDate)
      : null,
    venue: gig?.venue ?? lead.venue,
    guestCount: lead.guestCount,
    // The calendar entry's times win (owner-entered); the thread fills gaps.
    setTimes: gig?.startTime
      ? `${gig.startTime}${gig.endTime ? `–${gig.endTime}` : ""}`
      : extracted.setTimes,
    feeLabel: gig?.value ? formatMinor(gig.value, business.currency) : null,
    specialRequests: extracted.specialRequests,
    practicalNotes: extracted.practicalNotes,
    briefRef: `GB-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${lead.id.slice(-4).toUpperCase()}`,
    issuedLabel: new Intl.DateTimeFormat("en-GB", {
      timeZone: business.timezone,
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(now),
  };

  const pdf = await renderGigBriefPdf(data);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="gig-brief-${leadId.slice(-6)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
