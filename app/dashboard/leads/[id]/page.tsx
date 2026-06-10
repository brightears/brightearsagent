import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { Badge, Card } from "@/components/ui";
import { DraftReview } from "@/components/draft-review";
import type { LeadSource, LeadStatus } from "@/app/generated/prisma/enums";

export const dynamic = "force-dynamic";

type BadgeTone = "cyan" | "teal" | "lavender" | "peach" | "gray";

const STATUS_META: Record<LeadStatus, { label: string; tone: BadgeTone }> = {
  NEW: { label: "New", tone: "cyan" },
  SPAM: { label: "Spam", tone: "gray" },
  DRAFTED: { label: "Reply ready", tone: "lavender" },
  REPLIED: { label: "Replied", tone: "cyan" },
  IN_SEQUENCE: { label: "Following up", tone: "peach" },
  ENGAGED: { label: "Talking", tone: "lavender" },
  BOOKED: { label: "Booked 🎉", tone: "teal" },
  DEAD: { label: "Gone quiet", tone: "gray" },
};

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
  const status = STATUS_META[lead.status];

  const meta = [
    lead.eventType ?? "event",
    fmtEventDate(lead.eventDate, tz),
    lead.venue,
    lead.guestCount != null ? `${lead.guestCount} guests` : null,
  ].filter(Boolean);

  const contact = [lead.clientEmail, lead.clientPhone].filter(Boolean);

  return (
    <main className="flex-1 px-6 py-8 max-w-4xl mx-auto w-full space-y-6">
      <Link
        href="/dashboard"
        className="inline-block text-sm text-ink/60 hover:text-brand-cyan transition-colors"
      >
        ← Back to pipeline
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-deep-teal">{lead.clientName ?? "Unknown lead"}</h1>
          <Badge tone={status.tone}>{status.label}</Badge>
          <Badge tone="gray">{SOURCE_LABELS[lead.source]}</Badge>
        </div>
        <p className="text-sm text-ink/70">{meta.join(" · ")}</p>
        {contact.length > 0 && <p className="text-sm text-ink/50">{contact.join(" · ")}</p>}
        {lead.spamReason && (
          <p className="rounded-xl bg-warm-peach/40 border border-warm-peach px-3 py-2 text-sm text-ink">
            <span className="font-semibold">Filtered as spam:</span> {lead.spamReason}
          </p>
        )}
      </header>

      <section className="space-y-3">
        <h2 className="font-bold text-deep-teal">Conversation</h2>
        {lead.messages.length === 0 && (
          <Card className="p-4">
            <p className="text-sm text-ink/50">No messages yet.</p>
          </Card>
        )}
        <ul className="space-y-3">
          {lead.messages.map((m) => (
            <li
              key={m.id}
              className={`flex ${m.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                  m.direction === "OUTBOUND"
                    ? "bg-brand-cyan-soft"
                    : "bg-white border border-off-white"
                }`}
              >
                {m.subject && <p className="text-sm font-semibold text-deep-teal mb-1">{m.subject}</p>}
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.body}</p>
                <p className="mt-2 text-xs text-ink/40">
                  {m.direction === "OUTBOUND" ? "You" : (lead.clientName ?? "Them")} ·{" "}
                  {fmtTimestamp(m.createdAt, tz)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {pendingDraft && (
        <section>
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="font-bold text-deep-teal">Reply ready for review</h2>
              <Badge tone="lavender">Pending</Badge>
            </div>
            <DraftReview
              draftId={pendingDraft.id}
              leadId={lead.id}
              subject={pendingDraft.subject}
              body={pendingDraft.body}
            />
          </Card>
        </section>
      )}
    </main>
  );
}
