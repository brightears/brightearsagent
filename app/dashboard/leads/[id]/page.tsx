import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { Badge, Card, EmptyState, LEAD_STATUS_META, PageHeader, StatPill } from "@/components/ui";
import { DraftReview } from "@/components/draft-review";
import type { LeadSource } from "@/app/generated/prisma/enums";

export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<LeadSource, string> = {
  WEBSITE_FORM: "Website form",
  PLAIN_EMAIL: "Email",
  THE_KNOT: "The Knot",
  WEDDINGWIRE: "WeddingWire",
  BARK: "Bark",
  GIGSALAD: "GigSalad",
  THUMBTACK: "Thumbtack",
  OTHER: "Other",
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

  const lead = await db.lead.findFirst({
    where: { id, businessId: business.id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      drafts: { where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!lead) notFound();

  const pendingDraft = lead.drafts[0];
  const tz = business.timezone;
  const status = LEAD_STATUS_META[lead.status];

  const subtitle = [lead.eventType ?? "event", fmtEventDate(lead.eventDate, tz), lead.venue]
    .filter(Boolean)
    .join(" · ");

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
            {lead.clientPhone && <StatPill>{lead.clientPhone}</StatPill>}
          </>
        }
      />

      <div className="space-y-6">
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
                      <p className="mt-1 px-1 text-[11px] text-cream/50">
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
            <DraftReview
              draftId={pendingDraft.id}
              leadId={lead.id}
              subject={pendingDraft.subject}
              body={pendingDraft.body}
            />
          </section>
        )}
      </div>
      </div>
    </main>
  );
}
