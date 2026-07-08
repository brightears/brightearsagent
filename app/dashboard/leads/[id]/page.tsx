import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { Badge, Card, EmptyState, LEAD_STATUS_META, PageHeader, StatPill } from "@/components/ui";
import { DraftReview } from "@/components/draft-review";
import { PushPrompt } from "@/components/push-prompt";
import { LeadOutcomeControls } from "@/components/lead-outcome-controls";
import { holdScheduledSend } from "@/app/actions/drafts";
import { computeQuote } from "@/lib/quote/compute";
import { isoDay } from "@/lib/agent/availability";
import type { LeadSource } from "@/app/generated/prisma/enums";

export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<LeadSource, string> = {
  WEBSITE_FORM: "Website form",
  PLAIN_EMAIL: "Email",
  THE_KNOT: "The Knot",
  WEDDINGWIRE: "WeddingWire",
  BARK: "Bark",
  VENUE_OUTREACH: "Venue reply (the Hunt)",
  GIGSALAD: "GigSalad",
  THUMBTACK: "Thumbtack",
  OTHER: "Other",
};

// Reply-on-platform inboxes (P9.8): sources that hide the client's email —
// the reply kit deep-links the owner to where the paste goes. Deep link only,
// never send (CLAUDE.md rule 4).
const PLATFORM_INBOXES: Partial<Record<LeadSource, string>> = {
  GIGSALAD: "https://www.gigsalad.com/members/messages",
};

// All dates render in the business timezone (CLAUDE.md rule 9).
function fmtEventDate(d: Date | null, tz: string) {
  if (!d) return "date TBD";
  return d.toLocaleDateString("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtTimestamp(d: Date, tz: string) {
  return d.toLocaleString("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const business = await getCurrentBusiness();

  const [lead, activePackages] = await Promise.all([
    db.lead.findFirst({
      where: { id, businessId: business.id },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        drafts: { where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    db.package.findMany({
      where: { businessId: business.id, active: true },
      select: { name: true, description: true, priceMin: true, priceMax: true, eventTypes: true },
    }),
  ]);
  if (!lead) notFound();

  // 11.1 fee capture prefill: the same grounded quote engine that prices the
  // PDF — package match, else the sweet spot/floor. Never per-night (a
  // residency total is theirs to type), never invented.
  const quote = computeQuote({
    currency: business.currency,
    feeFloor: business.feeFloor,
    feeSweetSpot: business.feeSweetSpot,
    residencyRate: business.residencyRate,
    residencyRateUnit: business.residencyRateUnit,
    oneOffHours: business.oneOffHours,
    packages: activePackages,
    eventType: lead.eventType,
  });
  const suggestedFeeMinor =
    quote && !quote.perNight ? (quote.typicalAmount ?? quote.minAmount) : null;

  const pendingDraft = lead.drafts[0];
  const tz = business.timezone;
  const status = LEAD_STATUS_META[lead.status];
  // BOOKED/DEAD/SPAM are terminal; for anything else with no pending draft (the
  // DraftReview panel carries its own outcome buttons), surface standalone
  // booked/dead controls so the outcome is always recordable (audit C1).
  const terminal = lead.status === "BOOKED" || lead.status === "DEAD" || lead.status === "SPAM";

  const subtitle = [lead.eventType ?? "event", fmtEventDate(lead.eventDate, tz), lead.venue]
    .filter(Boolean)
    .join(" · ");

  // Roster availability (P13.3): with a real roster and a known date, show
  // WHO is free — the owner-facing face of the same per-performer logic the
  // drafter's availability engine uses. Client-facing copy never names names.
  const activePerformers = await db.performer.findMany({
    where: { businessId: business.id, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  let rosterDay: { name: string; gigTitle: string | null }[] = [];
  // A gig booked on the date with NO performer assigned means SOMEONE is busy
  // but we don't know who — showing everyone "free" would contradict the
  // drafter's availability engine (P15 review). Surface it as its own line.
  let unassignedGigThatDay = 0;
  if (activePerformers.length >= 2 && lead.eventDate) {
    const day = isoDay(lead.eventDate);
    const dayGigs = await db.gig.findMany({
      where: {
        businessId: business.id,
        date: { gte: new Date(`${day}T00:00:00Z`), lt: new Date(`${day}T23:59:59.999Z`) },
      },
      select: { performerId: true, title: true },
    });
    unassignedGigThatDay = dayGigs.filter((g) => g.performerId === null).length;
    rosterDay = activePerformers.map((perf) => ({
      name: perf.name,
      gigTitle: dayGigs.find((g) => g.performerId === perf.id)?.title ?? null,
    }));
  }

  // Contact confidence (P10.5): a reply address that never appears in the
  // source material (not the sender, not in the body) may be LLM-mistyped —
  // flag it so the owner checks before the reply goes out. Auto-send already
  // refuses these (clientEmailGrounded in the pipeline).
  const clientEmailLower = lead.clientEmail?.toLowerCase();
  const verifyAddress =
    !!clientEmailLower &&
    !lead.messages.some(
      (m) => m.direction === "INBOUND" && m.fromEmail?.toLowerCase() === clientEmailLower,
    ) &&
    !lead.rawBody.toLowerCase().includes(clientEmailLower);

  return (
    // Ink canvas page (docs/DESIGN.md v2); content constrained inside so the
    // ink runs edge-to-edge under the dashboard chrome.
    <main className="flex-1 bg-ink-stage">
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <Link
        href="/dashboard"
        className="mb-4 inline-block text-sm font-semibold text-cream/60 hover:text-brand-cyan transition-colors"
      >
        ← Back to pipeline
      </Link>

      <PageHeader
        rings
        title={lead.clientName ?? "Unknown lead"}
        subtitle={subtitle}
        stats={
          <>
            <StatPill>{SOURCE_LABELS[lead.source]}</StatPill>
            <Badge tone={status.badgeTone}>{status.label}</Badge>
            {lead.guestCount != null && <StatPill>{lead.guestCount} guests</StatPill>}
            {lead.clientEmail && <StatPill>{lead.clientEmail}</StatPill>}
            {verifyAddress && <StatPill>Verify this address before sending</StatPill>}
            {lead.clientPhone && <StatPill>{lead.clientPhone}</StatPill>}
          </>
        }
      />

      <div className="space-y-6">
        {/* Documents — generate the artist's PDF quote / press kit for this lead. */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-cream/10 bg-ink-raised px-4 py-3">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-cream/50">
            Documents
          </span>
          <a
            href={`/api/quote/${lead.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-brand-cyan hover:opacity-80 transition-opacity"
          >
            Generate quote (PDF)
          </a>
          <a
            href={`/epk/${business.slug}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-brand-cyan hover:opacity-80 transition-opacity"
          >
            Press kit (PDF)
          </a>
          {/* Gig brief (P11.3): booked leads only — the one-pager for the day. */}
          {lead.status === "BOOKED" && (
            <a
              href={`/api/gig-brief/${lead.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-brand-cyan hover:opacity-80 transition-opacity"
            >
              Gig brief (PDF)
            </a>
          )}
        </div>

        {/* Roster on the date (P13.3) — owner-only; the drafter says "we're
            covered" to clients without ever leaking who or what. */}
        {rosterDay.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-2xl border border-cream/10 bg-ink-raised px-4 py-3">
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-cream/50">
              Roster · {fmtEventDate(lead.eventDate, tz)}
            </span>
            {rosterDay.map((r) => (
              <span key={r.name} className="text-sm text-cream/80">
                <span className="font-semibold text-cream-bright">{r.name}</span>
                {r.gigTitle
                  ? ` — booked (${r.gigTitle})`
                  : unassignedGigThatDay > 0
                    ? " — free, but check below"
                    : " — free"}
              </span>
            ))}
            {unassignedGigThatDay > 0 && (
              <span className="w-full text-xs text-neon-orange">
                {unassignedGigThatDay} gig{unassignedGigThatDay === 1 ? "" : "s"} booked this day with
                no performer assigned — assign {unassignedGigThatDay === 1 ? "it" : "them"} on the
                calendar so availability is exact.
              </span>
            )}
          </div>
        )}

        {lead.spamReason && (
          /* Orange-soft alert card — opaque fill so it reads on the ink canvas;
             deep-amber #7a4100 lead-in on #ffdfba (~7:1, the checked pairing). */
          <div className="rounded-2xl bg-[#ffdfba] px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
            <p className="text-sm leading-relaxed text-ink-stage/80">
              <span className="font-semibold text-[#7a4100]">Filtered as spam for you</span> —{" "}
              {lead.spamReason}
            </p>
          </div>
        )}

        <section className="space-y-3">
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-cream/60">
            Conversation
          </h2>
          {lead.messages.length === 0 ? (
            <Card>
              <EmptyState
                compact
                title="No messages yet"
                hint="The conversation with this lead will live here."
              />
            </Card>
          ) : (
            <ul className="space-y-4">
              {lead.messages.map((m) => {
                const outbound = m.direction === "OUTBOUND";
                return (
                  <li key={m.id} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-prose ${outbound ? "text-right" : "text-left"}`}>
                      {/* Inbound = white card left (ink text); outbound = your
                          replies in the interface voice: cyan-soft text on an
                          ink-raised bubble (#b6eaff on #201f2b, ~11:1). */}
                      <div
                        className={`rounded-2xl p-4 text-left shadow-[0_12px_30px_rgba(0,0,0,0.35)] ${
                          outbound ? "bg-ink-raised border border-brand-cyan/25" : "bg-white"
                        }`}
                      >
                        {m.subject && (
                          <p
                            className={`text-sm font-semibold mb-1 ${
                              outbound ? "text-brand-cyan-soft" : "text-ink-stage"
                            }`}
                          >
                            {m.subject}
                          </p>
                        )}
                        <p
                          className={`text-sm whitespace-pre-wrap leading-relaxed ${
                            outbound ? "text-brand-cyan-soft/90" : "text-ink-stage/90"
                          }`}
                        >
                          {m.body}
                        </p>
                      </div>
                      <p className="mt-1 px-1 text-[11px] text-cream/65">
                        {outbound ? "You" : (lead.clientName ?? "Them")} ·{" "}
                        {fmtTimestamp(m.createdAt, tz)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {pendingDraft && (
          <section>
            {/* "Sending soon" holding state (P10.4): this draft goes out on
                its own when the buffer elapses — say so, and hand the owner
                the brake. Approve below still sends instantly. */}
            {pendingDraft.scheduledSendAt && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-cyan/40 bg-ink-raised px-4 py-3">
                <p className="text-sm text-cream/85">
                  <span className="font-bold text-cream-bright">Sending soon.</span> This reply
                  goes out on its own around {fmtTimestamp(pendingDraft.scheduledSendAt, tz)} —
                  approve it to send now, or hold it to review later.
                </p>
                <form
                  action={async () => {
                    "use server";
                    await holdScheduledSend(pendingDraft.id);
                  }}
                >
                  <button
                    type="submit"
                    className="rounded-full border-[1.5px] border-cream/30 px-4 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-cream/80 transition-colors hover:border-brand-cyan hover:text-brand-cyan"
                  >
                    Hold it
                  </button>
                </form>
              </div>
            )}
            {/* First-value ask (P4.2): the artist is looking at a ready draft —
                THE moment enabling the ping is obviously worth it. */}
            <PushPrompt />
            <DraftReview
              draftId={pendingDraft.id}
              leadId={lead.id}
              subject={pendingDraft.subject}
              body={pendingDraft.body}
              canAttachPressKit={business.epkEnabled}
              canAttachQuote={business.feeFloor != null || business.residencyRate != null}
              suggestPressKit={pendingDraft.wantsProfile}
              suggestQuote={pendingDraft.wantsQuote}
              autoAttachProfile={business.autoAttachProfile}
              autoAttachQuote={business.autoAttachQuote}
              platform={
                lead.clientEmail
                  ? null
                  : {
                      name: SOURCE_LABELS[lead.source],
                      inboxUrl: PLATFORM_INBOXES[lead.source] ?? null,
                    }
              }
              feeCurrency={business.currency}
              suggestedFeeMinor={suggestedFeeMinor}
            />
          </section>
        )}

        {!pendingDraft && !terminal && (
          <section>
            <LeadOutcomeControls
              leadId={lead.id}
              feeCurrency={business.currency}
              suggestedFeeMinor={suggestedFeeMinor}
            />
          </section>
        )}
      </div>
      </div>
    </main>
  );
}
