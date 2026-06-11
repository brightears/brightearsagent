import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { OnboardingBanner } from "@/components/onboarding-banner";
import {
  Card,
  EmptyState,
  LEAD_STATUS_META,
  PageHeader,
  StatPill,
  buttonStyles,
} from "@/components/ui";
import type { LeadStatus } from "@/app/generated/prisma/enums";

export const dynamic = "force-dynamic";

// Which statuses appear as pipeline columns, in order. Labels + colors come
// from LEAD_STATUS_META (the single source of truth in components/ui.tsx).
const COLUMN_STATUSES = [
  "NEW",
  "DRAFTED",
  "REPLIED",
  "IN_SEQUENCE",
  "ENGAGED",
  "BOOKED",
  "DEAD",
] as const satisfies readonly LeadStatus[];

// Readable header text per LEAD_STATUS_META accent — soft tints need dark text.
const ACCENT_TEXT: Record<string, string> = {
  "bg-brand-cyan": "text-white",
  "bg-soft-lavender": "text-white",
  "bg-brand-cyan-soft": "text-deep-teal",
  "bg-warm-peach": "text-ink",
  "bg-deep-teal": "text-white",
  "bg-off-white": "text-ink/70",
};

// Friendly per-column empty copy (docs/DESIGN.md: never a bare dash).
const COLUMN_EMPTY: Record<(typeof COLUMN_STATUSES)[number], { emoji: string; line: string }> = {
  NEW: { emoji: "📥", line: "Quiet right now" },
  DRAFTED: { emoji: "✍️", line: "No drafts waiting" },
  REPLIED: { emoji: "📤", line: "Nothing in flight" },
  IN_SEQUENCE: { emoji: "🔁", line: "No nudges running" },
  ENGAGED: { emoji: "💬", line: "No one talking yet" },
  BOOKED: { emoji: "🎉", line: "Your next yes lands here" },
  DEAD: { emoji: "🌙", line: "Nobody's gone quiet" },
};

function fmtDate(d: Date | null) {
  if (!d) return "date TBD";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function Dashboard() {
  const tenant = await getCurrentBusiness();
  const [leads, spamCount] = await Promise.all([
    db.lead.findMany({
      where: { businessId: tenant.id, status: { not: "SPAM" } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        clientName: true,
        eventType: true,
        eventDate: true,
        venue: true,
        status: true,
        bookedAt: true,
      },
    }),
    db.lead.count({ where: { businessId: tenant.id, status: "SPAM" } }),
  ]);
  const business = { ...tenant, leads };

  // "Booked this month" from the rows already fetched — month boundary in the
  // business's timezone (CLAUDE.md rule 9: all date logic in tenant timezone).
  const monthOf = (d: Date) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: tenant.timezone,
      year: "numeric",
      month: "2-digit",
    }).format(d);
  const thisMonth = monthOf(new Date());
  const bookedThisMonth = leads.filter(
    (l) => l.status === "BOOKED" && l.bookedAt && monthOf(l.bookedAt) === thisMonth
  ).length;

  return (
    <main className="flex-1 px-6 py-8 max-w-7xl mx-auto w-full">
      <PageHeader
        title={business.name}
        subtitle="Your lead pipeline"
        stats={
          <>
            <StatPill tone="teal">{business.leads.length} active</StatPill>
            <StatPill>{spamCount} spam filtered for you</StatPill>
            {bookedThisMonth > 0 && <StatPill>🎉 {bookedThisMonth} booked this month</StatPill>}
          </>
        }
      />

      <OnboardingBanner />

      {business.leads.length === 0 ? (
        <Card className="mx-auto max-w-xl px-6 py-8">
          <EmptyState
            emoji="💌"
            title="No leads yet"
            hint="Connect your leads — your forwarding test will land here."
            cta={
              <Link href="/onboarding" className={`inline-block ${buttonStyles.primary}`}>
                Connect your leads
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMN_STATUSES.map((status) => {
            const meta = LEAD_STATUS_META[status];
            const columnLeads = business.leads.filter((l) => l.status === status);
            return (
              <section
                key={status}
                className="rounded-2xl bg-white shadow-sm border border-off-white overflow-hidden"
              >
                <h2
                  className={`flex items-center justify-between rounded-t-2xl px-4 py-2.5 text-sm font-semibold ${meta.accent} ${ACCENT_TEXT[meta.accent] ?? "text-white"}`}
                >
                  <span>{meta.label}</span>
                  <span className="text-xs font-bold opacity-75">{columnLeads.length}</span>
                </h2>
                <ul className="p-3 space-y-2.5 min-h-16">
                  {columnLeads.map((lead) => (
                    <li key={lead.id}>
                      <Link
                        href={`/dashboard/leads/${lead.id}`}
                        className="block rounded-xl border border-off-white bg-white p-3 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-brand-cyan/40 hover:shadow-md"
                      >
                        <p className="text-sm font-semibold text-ink">
                          {lead.clientName ?? "Unknown"}
                        </p>
                        <p className="mt-0.5 text-xs text-ink/60">
                          {lead.eventType ?? "event"} · {fmtDate(lead.eventDate)}
                        </p>
                        {lead.venue && <p className="mt-0.5 text-xs text-ink/40">{lead.venue}</p>}
                      </Link>
                    </li>
                  ))}
                  {columnLeads.length === 0 && (
                    <li>
                      <EmptyState
                        compact
                        emoji={COLUMN_EMPTY[status].emoji}
                        title={COLUMN_EMPTY[status].line}
                      />
                    </li>
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
