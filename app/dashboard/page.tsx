import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { ActivationChecklist } from "@/components/activation-checklist";
import { ReceiptsStrip } from "@/components/receipts-strip";
import { NeedsYou } from "@/components/needs-you";
import { InstallPrompt } from "@/components/install-prompt";
import { getSetupStatus } from "@/lib/onboarding-status";
import {
  EmptyState,
  LEAD_STATUS_META,
  PageHeader,
  StatPill,
  buttonStyles,
} from "@/components/ui";
import { GradientBlob, StickerChip } from "@/components/collage";
import { HUNT_CAP, HuntSection } from "@/components/hunt-feed";
import { AtCapBanner } from "@/components/at-cap-banner";
import { InPlaySection } from "@/components/in-play";
import { profileStrength } from "@/lib/profile/strength";
import { IN_PLAY_STATUSES } from "@/lib/venues/feed";
import { meterState, monthStart } from "@/lib/billing/metering";
import { formatReplyTime, medianReplyMinutes } from "@/lib/reports/results";
import type { LeadStatus, VenueStatus } from "@/app/generated/prisma/enums";

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

// Friendly per-column empty copy (docs/DESIGN.md: never a bare dash) —
// rendered as compact mono sticker-speak lines (v2.1: typography, no icons).
const COLUMN_EMPTY: Record<(typeof COLUMN_STATUSES)[number], string> = {
  NEW: "Quiet right now",
  DRAFTED: "No drafts waiting",
  REPLIED: "Nothing in flight",
  IN_SEQUENCE: "No nudges running",
  ENGAGED: "No one talking yet",
  BOOKED: "Your next yes lands here",
  DEAD: "Nobody's gone quiet",
};

function fmtDate(d: Date | null) {
  if (!d) return "date TBD";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Whole hours between a timestamp and the page's render clock. */
function hoursSince(d: Date, now: Date) {
  return Math.floor((now.getTime() - d.getTime()) / 3600_000);
}

// Hunt-feed statuses: the proactive cards still awaiting action. Everything
// from PITCHED onward lives in the reply/pipeline flow, not the rail.
const HUNT_STATUSES = [
  "DISCOVERED",
  "QUALIFIED",
  "PITCH_DRAFTED",
] as const satisfies readonly VenueStatus[];

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ hunt?: string | string[] }>;
}) {
  const huntExpanded = (await searchParams).hunt === "all";
  const tenant = await getCurrentBusiness();
  const now = new Date();
  const [leads, spamCount, huntVenues, huntCount, inPlayVenues, activePackages, gigs, mailbox, repliedThisMonth] = await Promise.all([
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
        updatedAt: true, // aging chip: DRAFTED-at time proxy (P4.3)
      },
    }),
    db.lead.count({ where: { businessId: tenant.id, status: "SPAM" } }),
    db.venue.findMany({
      where: {
        businessId: tenant.id,
        status: { in: [...HUNT_STATUSES] },
        // 10.2c: the default feed shows HOT + WARM; SEED (relationship
        // planting, no urgency) lives behind the ?hunt=all expansion.
        ...(huntExpanded ? {} : { temperature: { in: ["HOT", "WARM"] } }),
      },
      // Temperature buckets first (enum declaration order: HOT < WARM < SEED),
      // fitScore desc within each bucket.
      orderBy: [{ temperature: "asc" }, { fitScore: "desc" }],
      ...(huntExpanded ? {} : { take: HUNT_CAP }),
      select: {
        id: true,
        name: true,
        city: true,
        country: true,
        kind: true,
        status: true,
        temperature: true,
        timingScore: true,
        entertainmentEvidence: true,
        linkedinUrl: true,
        fitScore: true,
        fitReasons: true,
        caution: true,
        lastSignalAt: true,
        bookingEmail: true,
        contactSource: true,
        // Travel Mode: the window's city, when this venue is a travel find —
        // drives the "Travel · {city}" tag on the card.
        travelWindow: { select: { city: true } },
        // The live pitch for the review surface (10.3) — at most one PENDING
        // or parked APPROVED per venue (action-level dedupe guarantee).
        pitches: {
          where: { status: { in: ["PENDING", "APPROVED"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            subject: true,
            body: true,
            status: true,
            jurisdictionMode: true,
            editedSubject: true,
            editedBody: true,
            sentAt: true,
          },
        },
      },
    }),
    db.venue.count({
      where: { businessId: tenant.id, status: { in: [...HUNT_STATUSES] } },
    }),
    // Post-send "In play" tracking surface (audit C2): venues a pitch was sent
    // to, which leave the Hunt feed but need a home so the owner can track the
    // reply by hand. PITCHED first, then most-recently-pitched.
    db.venue.findMany({
      where: { businessId: tenant.id, status: { in: [...IN_PLAY_STATUSES] } },
      orderBy: [{ pitchedAt: "desc" }],
      select: {
        id: true,
        name: true,
        city: true,
        country: true,
        kind: true,
        status: true,
        pitchedAt: true,
        // Travel Mode: window city for the "Travel · {city}" tag (in play too).
        travelWindow: { select: { city: true } },
      },
    }),
    db.package.count({ where: { businessId: tenant.id, active: true } }),
    db.gig.count({ where: { businessId: tenant.id } }),
    // 10.5: is a sending mailbox connected? Drives the "Send now" vs "connect"
    // hint on approved-pitch cards (the action re-checks server-side anyway).
    db.mailboxConnection.findUnique({
      where: { businessId: tenant.id },
      select: { status: true },
    }),
    // 10.7: the speed stopwatch — leads first-replied this month, for the
    // median pill in the header. Shown only when the data exists.
    db.lead.findMany({
      where: { businessId: tenant.id, firstReplyAt: { gte: monthStart(now) } },
      select: { createdAt: true, firstReplyAt: true },
    }),
  ]);
  const business = { ...tenant, leads };
  // First-run dashboard shows ONE next action (audit C4): while setup is
  // incomplete the ActivationChecklist is the single CTA, so the no-leads
  // welcome drops its competing "Connect your leads" button and points at the
  // checklist; once setup is done the checklist hides and the welcome owns it.
  const setup = getSetupStatus(tenant);

  // Venue rows → feed-card shape: the live pitch rides along (PENDING/APPROVED
  // only — the query filtered, so the cast on status is honest). Travel Mode:
  // flatten the window into travelCity for the "Travel · {city}" tag.
  const huntCards = huntVenues.map(({ pitches, travelWindow, ...venue }) => ({
    ...venue,
    travelCity: travelWindow?.city ?? null,
    pitch: pitches[0]
      ? { ...pitches[0], status: pitches[0].status as "PENDING" | "APPROVED" }
      : null,
  }));
  const homeCity = tenant.serviceCities[0] ?? "";
  const mailboxConnected = mailbox?.status === "CONNECTED";

  // The hunting license — gates the Draft-pitch button (re-checked server-side
  // in app/actions/venues.ts; this copy only drives honest UI).
  const strength = profileStrength(tenant, { activePackages, gigs });

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

  // Agent-paused surface (audit C3): show it in-app, not just via push.
  // meterState reads an UNSUBSCRIBED tenant as overCap (isAgentPaused); a paid
  // plan is overCap only when used > cap. Subscribed & under-cap → no banner.
  const meter = await meterState(tenant.id, tenant.plan, now, tenant.trialEndsAt);
  const subscribed = !!tenant.stripeSubscriptionId;
  const medianReply = medianReplyMinutes(repliedThisMonth);

  // A2HS eligibility (P9.6): only after the first approval — either half of
  // the product — so the install ask lands right after the loop proved itself.
  const [approvedDraft, approvedPitch] = await Promise.all([
    db.draft.findFirst({
      where: { lead: { businessId: tenant.id }, status: { in: ["APPROVED", "EDITED"] } },
      select: { id: true },
    }),
    db.venuePitch.findFirst({
      where: { businessId: tenant.id, status: { in: ["APPROVED", "SENDING", "SENT"] } },
      select: { id: true },
    }),
  ]);
  const approvedOnce = !!(approvedDraft || approvedPitch);

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
            {/* The stopwatch (P10.7): speed-to-lead is the product's core
                promise — show the receipt, but only when data exists. */}
            {medianReply !== null && (
              <StatPill>median first reply {formatReplyTime(medianReply)}</StatPill>
            )}
            {/* The pill is a door (P10.6): the filter earns trust by being
                inspectable — tap through to see what it caught and why. */}
            <Link href="/dashboard/spam" className="transition-opacity hover:opacity-80">
              <StatPill>{spamCount} spam filtered for you →</StatPill>
            </Link>
            {bookedThisMonth > 0 && (
              <StickerChip tone="magenta" rotate={-2}>
                {bookedThisMonth} booked this month
              </StickerChip>
            )}
          </>
        }
      />

      {/* The Today queue first (P9.4): what needs a tap, before anything
          else — the 30-seconds-a-day habit surface. Hidden when clear. */}
      <NeedsYou businessId={tenant.id} now={now} />

      {/* Install ask (P9.6) — phones only, after first approval, once. */}
      <InstallPrompt eligible={approvedOnce} />

      {/* Receipts (P8.7): what the agent did in the last 24h, in plain
          words — proof of work before any stats. Hidden on quiet days. */}
      <ReceiptsStrip businessId={tenant.id} now={now} />

      {/* ONE activation surface (audit C4, recut 2026-07): profile+voice, home
          city, leads, plan — in order, one primary CTA. Hidden once live. */}
      <ActivationChecklist business={tenant} subscribed={subscribed} />

      {/* Agent paused (audit C3) — for SUBSCRIBED tenants over their cap. The
          unsubscribed case is the checklist's "Choose your plan" item; showing
          both would rebuild the banner pile the checklist replaced. */}
      {subscribed && (
        <AtCapBanner
          used={meter.used}
          cap={meter.cap}
          overCap={meter.overCap}
          subscribed={subscribed}
        />
      )}

      {/* The Hunt (ADR-004: ONE home feed) — the proactive half, above the
          pipeline. Brand-new tenants (zero leads AND zero venues) keep the
          whole-pipeline welcome primary; the Hunt moves below it then. */}
      {!(business.leads.length === 0 && huntCount === 0) && (
        <HuntSection
          venues={huntCards}
          totalCount={huntCount}
          expanded={huntExpanded}
          canPitch={strength.canPitch}
          profilePercent={strength.percent}
          businessName={tenant.name}
          homeCity={homeCity}
          mailboxConnected={mailboxConnected}
          subscribed={subscribed}
        />
      )}

      {/* In play (audit C2): venues a pitch was sent to leave the Hunt feed —
          this section gives them a home so the owner can track the reply by
          hand. Only shown once at least one pitch has gone out. */}
      {inPlayVenues.length > 0 && (
        <InPlaySection
          venues={inPlayVenues.map(({ travelWindow, ...v }) => ({
            ...v,
            travelCity: travelWindow?.city ?? null,
          }))}
        />
      )}

      {business.leads.length === 0 ? (
        // Whole-pipeline welcome: a cream poster floating on the ink, sticker
        // chip on the corner (empty-state art may use the show voice).
        <div className="relative mx-auto max-w-xl">
          <GradientBlob tone="show" className="-bottom-8 -right-6 h-32 w-52" />
          <div className="relative">
            <EmptyState
              kicker="The inbox is listening"
              title="No inquiries yet."
              accent="yet."
              hint={
                setup.incomplete
                  ? "Finish your setup above — then your forwarding test will land here."
                  : "Connect your leads — your forwarding test will land here."
              }
              cta={
                setup.incomplete ? undefined : (
                  <Link href="/onboarding" className={`inline-block ${buttonStyles.primary}`}>
                    Connect your leads
                  </Link>
                )
              }
            />
            <StickerChip tone="magenta" rotate={6} className="absolute -top-2.5 right-8">
              You&apos;ll hear the ping
            </StickerChip>
          </div>
          {/* Brand-new tenant: the Hunt sits below the welcome (no double-shout). */}
          {huntCount === 0 && (
            <div className="mt-10">
              <HuntSection
                venues={huntCards}
                totalCount={huntCount}
                expanded={huntExpanded}
                canPitch={strength.canPitch}
                profilePercent={strength.percent}
                businessName={tenant.name}
                homeCity={homeCity}
                mailboxConnected={mailboxConnected}
                subscribed={subscribed}
              />
            </div>
          )}
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
                        {/* Aging nudge (P4.3): a reply that's sat ≥4h is a gig
                            leaking away — the median-response stat the weekly
                            report sells depends on these getting tapped. */}
                        {status === "DRAFTED" && hoursSince(lead.updatedAt, now) >= 4 && (
                          <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-neon-orange">
                            waiting {hoursSince(lead.updatedAt, now)}h
                          </p>
                        )}
                      </Link>
                    </li>
                  ))}
                  {columnLeads.length === 0 && (
                    <li>
                      <EmptyState compact title={COLUMN_EMPTY[status]} />
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
