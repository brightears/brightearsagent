// The Control Room (Phase 2b) — one cockpit for everything the AI office needs
// to sound like you and hunt for you. Replaces the old split Profile + Settings
// pages: five anchored sections (Identity · Voice & profile · Where you hunt ·
// Connections · Plan & billing) tracked by a sticky rail (components/
// control-room-nav.tsx). Each section has ONE writer action so saving one can
// never clobber another's columns (see app/actions/{settings,profile,travel}.ts).
//
// Canonical URL stays /dashboard/settings (billing redirects, OAuth callbacks,
// at-cap banners and push notifications all deep-link here); /dashboard/profile
// now redirects to #profile. Design LAW (docs/DESIGN.md v2.1): ink canvas,
// white/cream cards, cyan = interface, mono kickers, NO emoji ever.
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { uploadsEnabled } from "@/lib/uploads/r2";
import { Card, Badge, buttonStyles, Kicker, PageHeader, StatPill } from "@/components/ui";
import { StickerChip } from "@/components/collage";
import { SettingsForm, CopyButton } from "@/components/settings-form";
import { VoiceCard } from "@/components/voice-card";
import { ProfileForm } from "@/components/profile-form";
import { TravelWindowsCard, type TravelWindowRow } from "@/components/travel-windows-card";
import { PushToggle } from "@/components/push-toggle";
import { MailboxCard, type MailboxState } from "@/components/mailbox-card";
import { AutoSendCard } from "@/components/auto-send-card";
import { AttachmentAutonomyCard } from "@/components/attachment-autonomy-card";
import { ControlRoomNav, type ControlRoomSection } from "@/components/control-room-nav";
import { RosterCard } from "@/components/roster-card";
import { isConfigured as isMailboxConfigured } from "@/lib/oauth/google";
import { startCheckout, openBillingPortal, openPlanChange, billingState } from "@/app/actions/billing";
import { PLAN_LEAD_CAPS, meterState, type MeterState } from "@/lib/billing/metering";
import { planFeatures } from "@/lib/billing/plan-features";
import { profileStrength } from "@/lib/profile/strength";
import { RISK_REVERSAL } from "@/lib/marketing/guarantee";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

type BillingState = Awaited<ReturnType<typeof billingState>>;

const SECTIONS: ControlRoomSection[] = [
  { id: "identity", label: "Identity" },
  { id: "profile", label: "Voice & profile" },
  { id: "hunt", label: "Where you hunt" },
  { id: "roster", label: "Roster" },
  { id: "cadence", label: "Cadence" },
  { id: "connections", label: "Connections" },
  { id: "billing", label: "Plan & billing" },
];

// ADR-003 tier recut: every plan is the complete assistant — blurbs gate
// capacity/autonomy (inquiries, autonomy, cities), never capability. Every
// claim here is enforced via lib/billing/plan-features.ts; multi-performer/
// team claims return only when the roster ships (P13).
const PLAN_CARDS = [
  { plan: "STARTER" as const, price: "$25", blurb: `Hunts venues + answers inquiries · ${PLAN_LEAD_CAPS.STARTER} inquiries/mo · you approve every send` },
  { plan: "PRO" as const, price: "$79", blurb: `Same engine, working harder · ${PLAN_LEAD_CAPS.PRO} inquiries/mo · auto-send autopilot · hunts 3 cities` },
  { plan: "STUDIO" as const, price: "$149", blurb: `Same engine at full stretch · ${PLAN_LEAD_CAPS.STUDIO} inquiries/mo · auto-send · hunts all your cities · roster of performers` },
];

/** Ladder position for upgrade-vs-switch button labels. */
const PLAN_RANK = { STARTER: 0, PRO: 1, STUDIO: 2 } as const;

/** A Control Room section: ink-canvas heading + intro, then its card(s). */
function Section({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 lg:scroll-mt-8">
      <div className="mb-5">
        <h2 className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight text-cream-bright">
          <span aria-hidden className="size-1.5 flex-none bg-brand-cyan" />
          {title}
        </h2>
        {intro && <p className="mt-1.5 max-w-xl text-sm text-cream/50">{intro}</p>}
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

/** Profile strength + hunting-license meter (moved here from the old profile page). */
function StrengthMeter({
  percent,
  missing,
  canPitch,
  epkUrl,
}: {
  percent: number;
  missing: string[];
  canPitch: boolean;
  epkUrl: string;
}) {
  return (
    <div className="rounded-3xl bg-ink-raised border border-cream/10 px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-cream/70">
          Profile strength {percent}%
        </span>
        {canPitch ? (
          <StickerChip tone="magenta" rotate={-2}>
            Hunting license: active
          </StickerChip>
        ) : (
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cream/65">
            Hunting license: not yet
          </span>
        )}
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink-stage">
        <div
          className="h-full rounded-full bg-gradient-to-r from-neon-magenta to-neon-orange transition-[width] duration-500"
          style={{ width: `${Math.max(percent, 2)}%` }}
        />
      </div>
      {missing.length > 0 ? (
        <ul className="mt-4 space-y-1.5">
          {missing.slice(0, 5).map((hint) => {
            // serviceCities is edited in the #hunt section, not in the profile
            // form below this meter — point the owner there so the to-do isn't a
            // dead end (the field moved out of the profile in Phase 2b).
            const isCities = hint.toLowerCase().includes("cities you serve");
            return (
              <li key={hint} className="flex items-start gap-2 text-sm text-cream/55">
                <span aria-hidden className="mt-2 size-1 flex-none bg-neon-magenta" />
                <span>
                  {hint}
                  {isCities && (
                    <>
                      {" "}
                      <a href="#hunt" className="font-semibold text-brand-cyan hover:opacity-80">
                        Set them in Where you hunt &rarr;
                      </a>
                    </>
                  )}
                </span>
              </li>
            );
          })}
          {missing.length > 5 && (
            <li className="text-xs text-cream/35">…and {missing.length - 5} more once those land.</li>
          )}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-cream/55">
          Fully loaded. Every pitch goes out with the whole arsenal behind it.
        </p>
      )}
      <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <a
          href={epkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-brand-cyan hover:opacity-80 transition-opacity"
        >
          View your press kit &rarr;
        </a>
        <a
          href={`${epkUrl}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-brand-cyan hover:opacity-80 transition-opacity"
        >
          Download PDF &darr;
        </a>
      </p>
    </div>
  );
}

function BillingCard({ meter, state }: { meter: MeterState; state: BillingState }) {
  const pct = meter.cap > 0 ? Math.min(100, Math.round((meter.used / meter.cap) * 100)) : 100;
  return (
    <Card className="p-6">
      {/* In-app usage meter + at-cap notice (audit C3): the at-cap state used to
          surface only via an optional push; show it here so an owner with push
          off still sees that drafting paused and how to fix it. */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-xs text-ink-stage/60">
          <span>Inquiries this month</span>
          <span className="font-mono font-semibold text-ink-stage/75">
            {meter.used} / {meter.cap}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-stage/10">
          <div
            className={`h-full rounded-full ${meter.overCap ? "bg-[#c2410c]" : "bg-brand-cyan"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {meter.overCap && state.subscribed && (
          <p className="mt-3 rounded-xl bg-[#ffdfba] px-3 py-2 text-sm text-ink-stage/80">
            <span className="font-semibold text-[#7a4100]">Lead cap reached</span> — new leads still
            arrive, but drafting is paused until you upgrade. No surprise bill, ever.
          </p>
        )}
      </div>
      {!state.enabled ? (
        <p className="text-sm text-ink-stage/60">Billing isn&apos;t configured in this environment yet.</p>
      ) : state.subscribed ? (
        // The ladder stays visible after subscribing (audit 2026-07): upgrades
        // are the only revenue-expansion path, and "how hard the AI works" is
        // the axis — turning the machine up should always be one tap away.
        <div>
          <p className="text-sm text-ink-stage/60 mb-5">
            Turn the machine up or down anytime — plan switches prorate automatically and apply on
            one confirm. Payment method, invoices and cancelling live under Manage billing.
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            {PLAN_CARDS.map((p) => {
              const current = p.plan === state.plan;
              const upgrade =
                state.plan in PLAN_RANK &&
                PLAN_RANK[p.plan] > PLAN_RANK[state.plan as keyof typeof PLAN_RANK];
              return (
                <form
                  key={p.plan}
                  action={current ? openBillingPortal : openPlanChange.bind(null, p.plan)}
                  className={`relative flex flex-col gap-2 rounded-2xl bg-cream p-5 ${
                    current ? "ring-2 ring-brand-cyan" : ""
                  }`}
                >
                  {current && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <Badge tone="cyan">Your plan</Badge>
                    </div>
                  )}
                  <div className="font-bold text-ink-stage">
                    {p.plan.charAt(0) + p.plan.slice(1).toLowerCase()}
                  </div>
                  <div className="text-3xl font-extrabold tracking-tight text-ink-stage">
                    {p.price}
                    <span className="text-sm font-normal text-ink-stage/50">/mo</span>
                  </div>
                  <div className="text-xs text-ink-stage/60 flex-1">{p.blurb}</div>
                  <button
                    className={
                      current
                        ? buttonStyles.secondaryOnLight
                        : upgrade
                          ? buttonStyles.primary
                          : buttonStyles.secondaryOnLight
                    }
                  >
                    {current ? "Manage billing" : upgrade ? "Upgrade" : "Switch"}
                  </button>
                </form>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-ink-stage/60 mb-5">
            Your agent is paused — choose a plan to switch it on. Your setup is saved and new
            inquiries still arrive; the moment you subscribe it starts replying in your voice and
            hunting venues for you.
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            {PLAN_CARDS.map((p) => {
              const popular = p.plan === "PRO";
              return (
                // Plan cards = cream poster panels; Pro wears the magenta show ring.
                <form
                  key={p.plan}
                  action={startCheckout.bind(null, p.plan)}
                  className={`relative flex flex-col gap-2 rounded-2xl bg-cream p-5 ${
                    popular
                      ? "ring-2 ring-neon-magenta shadow-[0_10px_30px_rgba(255,45,174,0.2)]"
                      : ""
                  }`}
                >
                  {popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <Badge tone="teal">Most popular</Badge>
                    </div>
                  )}
                  <div className="font-bold text-ink-stage">{p.plan.charAt(0) + p.plan.slice(1).toLowerCase()}</div>
                  <div className="text-3xl font-extrabold tracking-tight text-ink-stage">
                    {p.price}
                    <span className="text-sm font-normal text-ink-stage/50">/mo</span>
                  </div>
                  <div className="text-xs text-ink-stage/60 flex-1">{p.blurb}</div>
                  <button className={popular ? buttonStyles.primary : buttonStyles.secondaryOnLight}>Choose</button>
                </form>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-ink-stage/60">
            Month-to-month. Renews automatically each month until you cancel. Cancel anytime in
            Plan &amp; billing &rarr; Manage billing; no charge after you cancel. {RISK_REVERSAL.capLine}
          </p>
        </div>
      )}
    </Card>
  );
}

/** Short, mono plan label for the header status readout. */
function planLabel(state: BillingState): string {
  return state.subscribed ? state.plan : "Not subscribed";
}

export default async function ControlRoomPage({
  searchParams,
}: {
  searchParams: Promise<{
    mailbox?: string | string[];
    reason?: string | string[];
    billing?: string | string[];
  }>;
}) {
  const sp = await searchParams;
  const mailbox = Array.isArray(sp.mailbox) ? sp.mailbox[0] : sp.mailbox ?? null;
  const reason = Array.isArray(sp.reason) ? sp.reason[0] : sp.reason ?? null;
  const billing = Array.isArray(sp.billing) ? sp.billing[0] : sp.billing ?? null;

  const business = await getCurrentBusiness();
  const leadAddress = `leads@${business.slug}.in.brightears.io`;

  // One pass of the reads the cockpit needs: usage meter, billing state, the
  // profile-strength inputs, the live travel windows, and the mailbox state.
  const [meter, billingSt, activePackages, gigs, travelWindows, mailboxConn, sequenceTemplate, performers] = await Promise.all([
    meterState(business.id, business.plan, new Date(), business.trialEndsAt),
    billingState(),
    db.package.count({ where: { businessId: business.id, active: true } }),
    db.gig.count({ where: { businessId: business.id } }),
    db.travelWindow.findMany({
      where: { businessId: business.id, status: "ACTIVE" },
      orderBy: { startDate: "asc" },
      select: {
        id: true,
        city: true,
        country: true,
        startDate: true,
        endDate: true,
        radiusKm: true,
        roleTags: true,
        status: true,
      },
    }),
    isMailboxConfigured()
      ? db.mailboxConnection.findUnique({
          where: { businessId: business.id },
          select: { email: true, status: true, lastError: true },
        })
      : Promise.resolve(null),
    // Cadence card (P6.15): the tenant's real follow-up day-offsets.
    db.sequenceTemplate.findFirst({
      where: { businessId: business.id, active: true },
      select: { stepsDays: true },
    }),
    // P13 roster: every performer, active first (history is kept, not deleted).
    db.performer.findMany({
      where: { businessId: business.id },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
  ]);

  const strength = profileStrength(business, { activePackages, gigs });

  // Travel windows are date-only (UTC midnight) — serialize to YYYY-MM-DD.
  const isoDate = (d: Date) => d.toISOString().slice(0, 10);
  const travelWindowRows: TravelWindowRow[] = travelWindows.map((w) => ({
    ...w,
    startDate: isoDate(w.startDate),
    endDate: isoDate(w.endDate),
  }));

  // Resolve the mailbox card state from the single connection read above.
  let mailboxState: MailboxState;
  if (!isMailboxConfigured()) {
    mailboxState = { kind: "unconfigured" };
  } else if (!mailboxConn || mailboxConn.status === "REVOKED") {
    mailboxState = { kind: "disconnected" };
  } else if (mailboxConn.status === "ERROR") {
    mailboxState = { kind: "error", email: mailboxConn.email, lastError: mailboxConn.lastError };
  } else {
    mailboxState = { kind: "connected", email: mailboxConn.email };
  }
  const mailboxLive = mailboxState.kind === "connected";
  // Only show the mailbox status pill when OAuth is actually provisioned —
  // otherwise "Mailbox off" reads as the owner's fault on an env that simply
  // doesn't have sending configured (the card itself says "not enabled here").
  const mailboxConfigured = mailboxState.kind !== "unconfigured";

  return (
    <main className="flex-1 bg-ink-stage">
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <PageHeader
          title="Control room"
          accent="room"
          subtitle="Everything the AI office needs to sound like you and hunt for you — in one place."
          stats={
            <>
              <StatPill tone={strength.canPitch ? "teal" : "white"}>
                Profile {strength.percent}%
              </StatPill>
              <StatPill>{planLabel(billingSt)}</StatPill>
              {mailboxConfigured && (
                <StatPill tone={mailboxLive ? "teal" : "white"}>
                  {mailboxLive ? "Mailbox live" : "Mailbox off"}
                </StatPill>
              )}
            </>
          }
        />

        {/* Post-checkout confirmation (audit C3): billing.ts redirects here with
            ?billing=success|cancelled — surfaced at the top so it's seen on land.
            "Live" only when the webhook has actually flipped the plan; until
            then the honest state is "finalizing" (Stripe's webhook usually
            lands within seconds, but the URL param alone proves nothing). */}
        {billing === "success" &&
          (billingSt.subscribed ? (
            <div className="mb-6 rounded-2xl bg-brand-cyan-soft px-5 py-4 text-sm font-medium text-ink-stage">
              You&apos;re subscribed — your agent is live. Manage your plan anytime in Plan &amp; billing below.
            </div>
          ) : (
            <div className="mb-6 rounded-2xl bg-brand-cyan-soft px-5 py-4 text-sm font-medium text-ink-stage">
              Payment received — finalizing your subscription. Your agent switches on the moment
              it&apos;s confirmed (usually under a minute); refresh to see it live.
            </div>
          ))}
        {billing === "cancelled" && (
          <div className="mb-6 rounded-2xl border border-cream/15 bg-ink-raised px-5 py-4 text-sm text-cream/80">
            Checkout cancelled — no charge was made. You can pick a plan whenever you&apos;re ready.
          </div>
        )}

        <div className="lg:grid lg:grid-cols-[176px_1fr] lg:gap-12">
          <ControlRoomNav sections={SECTIONS} />

          <div className="min-w-0 space-y-14">
            <Section
              id="identity"
              title="Identity"
              intro="Who your clients see on every reply, and the basics the office runs on."
            >
              <Card className="p-6">
                <SettingsForm
                  business={{
                    name: business.name,
                    ownerName: business.ownerName,
                    replyToEmail: business.replyToEmail,
                    timezone: business.timezone,
                    country: business.country,
                    websiteUrl: business.websiteUrl,
                    bookingLinkUrl: business.bookingLinkUrl,
                    performerKind: business.performerKind,
                  }}
                />
              </Card>
            </Section>

            <Section
              id="profile"
              title="Voice & profile"
              intro="How you sound and what the agent pitches with. Fill the meter to unlock the hunting license."
            >
              <StrengthMeter
                percent={strength.percent}
                missing={strength.missing}
                canPitch={strength.canPitch}
                epkUrl={`/epk/${business.slug}`}
              />
              <VoiceCard
                voice={{
                  voiceSamples: business.voiceSamples,
                  voiceGreeting: business.voiceGreeting,
                  voiceSignoff: business.voiceSignoff,
                  voiceUsesEmoji: business.voiceUsesEmoji,
                  voicePhrases: business.voicePhrases,
                }}
              />
              <ProfileForm
                profile={{
                  headline: business.headline,
                  bio: business.bio,
                  genres: business.genres,
                  eventTypes: business.eventTypes,
                  pitchLanguages: business.pitchLanguages,
                  videoLinks: business.videoLinks,
                  photoUrls: business.photoUrls,
                  socialLinks: business.socialLinks,
                  riderNotes: business.riderNotes,
                  reviewQuotes: business.reviewQuotes,
                  notableVenues: business.notableVenues,
                  insured: business.insured,
                  travelPolicy: business.travelPolicy,
                  feeFloor: business.feeFloor,
                  feeSweetSpot: business.feeSweetSpot,
                  gigTypes: business.gigTypes,
                  acceptsTravel: business.acceptsTravel,
                  residencyRate: business.residencyRate,
                  residencyRateUnit: business.residencyRateUnit,
                  oneOffHours: business.oneOffHours,
                  epkEnabled: business.epkEnabled,
                  currency: business.currency,
                }}
                uploadsEnabled={uploadsEnabled}
              />
            </Section>

            <Section
              id="hunt"
              title="Where you hunt"
              intro="Your home base and any trips. When you travel, the agent hunts guest spots in those cities for those dates."
            >
              <TravelWindowsCard
                serviceCities={business.serviceCities}
                homeRadiusKm={business.homeRadiusKm}
                homeCityCap={planFeatures(business.plan).homeCityCap}
                windows={travelWindowRows}
              />
            </Section>

            <Section
              id="roster"
              title="Roster"
              intro="Who performs under this act — gigs tag a performer, and the agent checks availability per performer before it promises a date."
            >
              <RosterCard
                performers={performers}
                rosterCap={planFeatures(business.plan).rosterCap}
              />
            </Section>

            <Section
              id="cadence"
              title="Cadence"
              intro="How hard the AI works for you — the rhythm it runs on, and the dials each plan turns up."
            >
              <Card className="p-6">
                <h3 className="mb-1 font-bold text-ink-stage">Follow-up rhythm</h3>
                <p className="mb-4 text-sm text-ink-stage/60">
                  After your first reply goes out, the agent nudges quiet prospects on this clock —
                  and stops the moment they answer, book, or opt out. Tuning it yourself is on the
                  roadmap; the defaults are the pattern that books gigs without pestering anyone.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {(sequenceTemplate?.stepsDays ?? [2, 5, 9]).map((day, i) => (
                    <span
                      key={`${day}-${i}`}
                      className="rounded-full border border-cream bg-cream/40 px-3.5 py-1.5 font-mono text-xs font-bold text-ink-stage/75"
                    >
                      Day {day}
                    </span>
                  ))}
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-stage/45">
                    then it closes the loop
                  </span>
                </div>
                <p className="mt-4 text-xs text-ink-stage/50">
                  Hard stops, always: a reply, a booking, or an opt-out ends the sequence instantly.
                </p>
              </Card>
              <Card className="p-6">
                <h3 className="mb-1 font-bold text-ink-stage">The dials, per plan</h3>
                <p className="mb-4 text-sm text-ink-stage/60">
                  Every plan is the complete engine — these are the only things a plan changes.
                  Yours is marked.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="text-left font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-stage/50">
                        <th className="pb-2 pr-4 font-bold">Dial</th>
                        {(["STARTER", "PRO", "STUDIO"] as const).map((p) => (
                          <th
                            key={p}
                            className={`pb-2 pr-4 font-bold ${
                              business.plan === p ? "text-brand-cyan" : ""
                            }`}
                          >
                            {p.charAt(0) + p.slice(1).toLowerCase()}
                            {business.plan === p ? " · yours" : ""}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="text-ink-stage/75">
                      {[
                        {
                          dial: "Inquiries answered / month",
                          values: ["15", "60", "150"] as const,
                        },
                        { dial: "Cities hunted", values: ["1", "3", "All"] as const },
                        {
                          dial: "Auto-send on trusted sources",
                          values: ["—", "Yes", "Yes"] as const,
                        },
                      ].map((row) => (
                        <tr key={row.dial} className="border-t border-cream">
                          <td className="py-2.5 pr-4">{row.dial}</td>
                          {row.values.map((v, i) => {
                            const plan = (["STARTER", "PRO", "STUDIO"] as const)[i];
                            return (
                              <td
                                key={plan}
                                className={`py-2.5 pr-4 font-mono text-xs font-bold ${
                                  business.plan === plan ? "text-brand-cyan" : ""
                                }`}
                              >
                                {v}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 text-xs text-ink-stage/50">
                  The daily scan and the venue-pitch allowance are the same on every plan — and
                  research quality is never a dial.
                </p>
              </Card>
            </Section>

            <Section
              id="connections"
              title="Connections"
              intro="Where leads come in, where pitches go out, and how you get pinged to approve."
            >
              <Card className="p-6">
                <h3 className="mb-4">
                  <Kicker onLight>Your lead address</Kicker>
                </h3>
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span className="inline-flex max-w-full items-center rounded-full bg-brand-cyan-soft px-4 py-2">
                    <code className="select-all break-all font-mono text-sm font-semibold text-ink-stage">
                      {leadAddress}
                    </code>
                  </span>
                  <CopyButton text={leadAddress} />
                </div>
                <p className="text-sm text-ink-stage/60">
                  Forward your inquiry email (and The Knot, WeddingWire, Bark notifications) to this
                  address — every lead lands in your pipeline with a reply drafted and waiting.
                </p>
              </Card>

              <AutoSendCard
                enabled={planFeatures(business.plan).autoSend}
                trusted={business.autoSendSources}
              />

              <AttachmentAutonomyCard
                autoAttachProfile={business.autoAttachProfile}
                autoAttachQuote={business.autoAttachQuote}
              />

              <MailboxCard state={mailboxState} mailbox={mailbox} reason={reason} />

              <Card className="p-6">
                <h3 className="mb-2">
                  <Kicker onLight>Notifications</Kicker>
                </h3>
                <p className="text-sm text-ink-stage/60 mb-4">
                  Get a ping the moment a reply is ready, so you can approve it from your phone — even
                  from the booth.
                </p>
                <PushToggle />
              </Card>
            </Section>

            <Section
              id="billing"
              title="Plan & billing"
              intro={
                <span className="inline-flex flex-wrap items-center gap-2">
                  {RISK_REVERSAL.short}
                </span>
              }
            >
              <BillingCard meter={meter} state={billingSt} />
            </Section>
          </div>
        </div>
      </div>
    </main>
  );
}
