import { db } from "@/lib/db";
import { pushToBusiness } from "@/lib/push";
import { generateDraft } from "@/lib/agent/drafter";
import { checkAvailability, isoDay } from "@/lib/agent/availability";
import type { DraftRequest } from "@/lib/agent/types";

/**
 * Load everything the drafter needs for a lead, generate, persist as PENDING
 * Draft, and move the lead to DRAFTED. Called fire-and-forget from the webhook
 * (persistent server) and by the sequence engine.
 */
export async function generateDraftForLead(leadId: string, sequenceStep = 0): Promise<void> {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: {
      business: { include: { packages: { where: { active: true } }, performers: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!lead || lead.status === "SPAM" || lead.status === "BOOKED" || lead.status === "DEAD") return;
  if (lead.optedOut) return;

  // Dedupe: never stack a second PENDING draft on the same lead. Guards against
  // webhook redelivery, overlapping cron ticks, and retries all racing here.
  const existingPending = await db.draft.findFirst({
    where: { leadId, status: "PENDING" },
    select: { id: true },
  });
  if (existingPending) return;

  const eventDate = lead.eventDate ? isoDay(lead.eventDate) : null;
  // Only the gigs on the event day matter — range-filter instead of loading a
  // business's entire history on every inbound lead / sequence tick.
  const gigs =
    eventDate && lead.eventDate
      ? await db.gig.findMany({
          where: {
            businessId: lead.businessId,
            date: {
              gte: new Date(`${eventDate}T00:00:00Z`),
              lt: new Date(`${eventDate}T23:59:59.999Z`),
            },
          },
        })
      : [];

  const req: DraftRequest = {
    business: {
      id: lead.business.id,
      name: lead.business.name,
      ownerName: lead.business.ownerName,
      performerKind: lead.business.performerKind,
      country: lead.business.country,
      voiceSamples: lead.business.voiceSamples,
      websiteUrl: lead.business.websiteUrl,
      bookingLinkUrl: lead.business.bookingLinkUrl,
    },
    packages: lead.business.packages.map((p) => ({
      name: p.name,
      description: p.description,
      priceMin: p.priceMin,
      priceMax: p.priceMax,
      eventTypes: p.eventTypes,
    })),
    lead: {
      source: lead.source,
      subject: lead.rawSubject,
      clientName: lead.clientName,
      clientEmail: lead.clientEmail,
      eventType: lead.eventType,
      eventDate,
      venue: lead.venue,
      guestCount: lead.guestCount,
      budgetHint: lead.budgetHint,
      message:
        lead.messages.filter((m) => m.direction === "INBOUND").at(-1)?.body ?? lead.rawBody,
    },
    availability: checkAvailability(eventDate, gigs, lead.business.performers),
    thread: lead.messages.map((m) => ({ direction: m.direction, body: m.body })),
    sequenceStep,
  };

  const result = await generateDraft(req);

  const [draft] = await db.$transaction([
    db.draft.create({
      data: {
        leadId: lead.id,
        subject: result.subject,
        body: result.body,
        isFollowUp: sequenceStep > 0,
        sequenceStep: sequenceStep > 0 ? sequenceStep : null,
        // Drafts go stale: after the event date, or after 14 days.
        expiresAt: lead.eventDate ?? new Date(Date.now() + 14 * 24 * 3600 * 1000),
      },
    }),
    ...(lead.status === "NEW"
      ? [db.lead.update({ where: { id: lead.id }, data: { status: "DRAFTED" } })]
      : []),
  ]);

  // One-tap approve from the phone — the core loop.
  void pushToBusiness(lead.businessId, {
    title: `Reply ready: ${lead.clientName ?? "new lead"}`,
    body: result.subject,
    url: `/dashboard/leads/${lead.id}`,
  }).catch(() => null);
  void draft;
}
