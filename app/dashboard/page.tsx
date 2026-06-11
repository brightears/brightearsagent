import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { OnboardingBanner } from "@/components/onboarding-banner";
import {
  EmptyState,
  LEAD_STATUS_META,
  PageHeader,
  StatPill,
  buttonStyles,
  type EmptyStateMark,
} from "@/components/ui";
import { GradientBlob, StickerChip } from "@/components/collage";
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

// Readable header text paired with each v2 LEAD_STATUS_META accent — soft
// tints (and the magenta→orange BOOKED gradient) need ink text, never white.
const ACCENT_TEXT: Record<string, string> = {
  "bg-brand-cyan": "text-ink-stage",
  "bg-brand-cyan-soft": "text-ink-stage",
  "bg-[#ffd6ec]": "text-[#9c0f63]",
  "bg-[#ffdfba]": "text-[#7a4100]",
  "bg-gradient-to-r from-neon-magenta to-neon-orange": "text-ink-stage",
  "bg-cream/40": "text-ink-stage/70",
};

// Friendly per-column empty copy (docs/DESIGN.md: never a bare dash).
// Marks are geometric CollageMarks — no emoji in chrome (v2.1 LAW rule 1).
const COLUMN_EMPTY: Record<(typeof COLUMN_STATUSES)[number], { mark: EmptyStateMark; line: string }> = {
  NEW: { mark: "inbox", line: "Quiet right now" },
  DRAFTED: { mark: "draft", line: "No drafts waiting" },
  REPLIED: { mark: "inbox", line: "Nothing in flight" },
  IN_SEQUENCE: { mark: "calendar", line: "No nudges running" },
  ENGAGED: { mark: "inbox", line: "No one talking yet" },
  BOOKED: { mark: "report", line: "Your next yes lands here" },
  DEAD: { mark: "none", line: "Nobody's gone quiet" },
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
        title="Your pipeline"
        accent="pipeline"
        subtitle={business.name}
        rings
        stats={
          <>
            <StatPill tone="teal">{business.leads.length} active</StatPill>
            <StatPill>{spamCount} spam filtered for you</StatPill>
            {bookedThisMonth > 0 && (
              <StickerChip tone="magenta" rotate={-2}>
                {bookedThisMonth} booked this month
              </StickerChip>
            )}
          </>
        }
      />

      <OnboardingBanner />

      {business.leads.length === 0 ? (
        // Whole-pipeline welcome: a cream poster floating on the ink, sticker
        // chip on the corner (empty-state art may use the show voice).
        <div className="relative mx-auto max-w-xl">
          <GradientBlob tone="show" className="-bottom-8 -right-6 h-32 w-52" />
          <div className="relative">
            <EmptyState
              mark="inbox"
              title="No leads yet"
              hint="Connect your leads — your forwarding test will land here."
              cta={
                <Link href="/onboarding" className={`inline-block ${buttonStyles.primary}`}>
                  Connect your leads
                </Link>
              }
            />
            <StickerChip tone="magenta" rotate={6} className="absolute -top-2.5 right-8">
              You&apos;ll hear the ping
            </StickerChip>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {COLUMN_STATUSES.map((status) => {
            const meta = LEAD_STATUS_META[status];
            const columnLeads = business.leads.filter((l) => l.status === status);
            return (
              // White data card on the ink stage — never tilted (app rule).
              <section
                key={status}
                className="overflow-hidden rounded-3xl border border-cream/10 bg-white shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
              >
                <h2
                  className={`flex items-center justify-between px-4 py-2.5 text-sm ${
                    status === "BOOKED" ? "font-extrabold" : "font-semibold"
                  } ${meta.accent} ${ACCENT_TEXT[meta.accent] ?? "text-ink-stage"}`}
                >
                  <span>{meta.label}</span>
                  <span className="text-xs font-bold opacity-75">{columnLeads.length}</span>
                </h2>
                <ul className="p-3 space-y-2.5 min-h-16">
                  {columnLeads.map((lead) => (
                    <li key={lead.id}>
                      <Link
                        href={`/dashboard/leads/${lead.id}`}
                        className="block rounded-2xl border border-ink-stage/10 bg-white p-3 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-brand-cyan hover:shadow-[0_10px_24px_rgba(0,187,228,0.2)]"
                      >
                        <p className="text-sm font-semibold text-ink-stage">
                          {lead.clientName ?? "Unknown"}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-stage/60">
                          {lead.eventType ?? "event"} · {fmtDate(lead.eventDate)}
                        </p>
                        {lead.venue && (
                          <p className="mt-0.5 text-xs text-ink-stage/45">{lead.venue}</p>
                        )}
                      </Link>
                    </li>
                  ))}
                  {columnLeads.length === 0 && (
                    <li>
                      <EmptyState
                        compact
                        mark={COLUMN_EMPTY[status].mark}
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
