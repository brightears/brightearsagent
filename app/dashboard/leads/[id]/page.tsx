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
    <main className="flex-1 px-6 py-8 max-w-4xl mx-auto w-full">
      <Link
        href="/dashboard"
        className="mb-4 inline-block text-sm font-semibold text-ink/60 hover:text-brand-cyan transition-colors"
      >
        ← Back to pipeline
      </Link>

      <PageHeader
        title={lead.clientName ?? "Unknown lead"}
        subtitle={subtitle}
        stats={
          <>
            <StatPill>📬 {SOURCE_LABELS[lead.source]}</StatPill>
            <Badge tone={status.badgeTone}>{status.label}</Badge>
            {lead.guestCount != null && <StatPill>👥 {lead.guestCount} guests</StatPill>}
            {lead.clientEmail && <StatPill>✉️ {lead.clientEmail}</StatPill>}
            {lead.clientPhone && <StatPill>📞 {lead.clientPhone}</StatPill>}
          </>
        }
      />

      <div className="space-y-6">
        {lead.spamReason && (
          <div className="rounded-2xl border border-warm-peach/70 bg-warm-peach/25 px-4 py-3 shadow-sm">
            <p className="flex items-start gap-2.5 text-sm leading-relaxed text-ink">
              <span className="text-lg" aria-hidden>
                🛡️
              </span>
              <span>
                <span className="font-semibold text-deep-teal">Filtered as spam for you</span> —{" "}
                {lead.spamReason}
              </span>
            </p>
          </div>
        )}

        <section className="space-y-3">
          <h2 className="font-bold text-deep-teal">Conversation</h2>
          {lead.messages.length === 0 ? (
            <Card>
              <EmptyState
                emoji="💌"
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
                      <div
                        className={`rounded-2xl p-4 text-left shadow-sm ${
                          outbound ? "bg-brand-cyan-soft/40" : "bg-white border border-off-white"
                        }`}
                      >
                        {m.subject && (
                          <p className="text-sm font-semibold text-deep-teal mb-1">{m.subject}</p>
                        )}
                        <p className="text-sm whitespace-pre-wrap leading-relaxed text-ink/90">
                          {m.body}
                        </p>
                      </div>
                      <p className="mt-1 px-1 text-[11px] text-ink/40">
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
    </main>
  );
}
