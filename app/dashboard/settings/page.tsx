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
import { Card, Badge, buttonStyles, Kicker, PageHeader, StatPill } from "@/components/ui";
import { StickerChip } from "@/components/collage";
import { SettingsForm, CopyButton } from "@/components/settings-form";
import { VoiceCard } from "@/components/voice-card";
import { ProfileForm } from "@/components/profile-form";
import { TravelWindowsCard, type TravelWindowRow } from "@/components/travel-windows-card";
import { PushToggle } from "@/components/push-toggle";
import { MailboxCard, type MailboxState } from "@/components/mailbox-card";
import { AutoSendCard } from "@/components/auto-send-card";
import { ControlRoomNav, type ControlRoomSection } from "@/components/control-room-nav";
import { isConfigured as isMailboxConfigured } from "@/lib/oauth/google";
import { startCheckout, openBillingPortal, billingState } from "@/app/actions/billing";
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
  { id: "connections", label: "Connections" },
  { id: "billing", label: "Plan & billing" },
];

// ADR-003 tier recut: every plan is the complete assistant — blurbs gate
// capacity/autonomy (leads, performers, autopilot, team), never capability.
const PLAN_CARDS = [
  { plan: "STARTER" as const, price: "$25", blurb: `Hunts venues for you + answers leads · ${PLAN_LEAD_CAPS.STARTER} leads/mo · 1 performer` },
  { plan: "PRO" as const, price: "$79", blurb: `Same engine, more headroom · ${PLAN_LEAD_CAPS.PRO} leads/mo · auto-send autopilot` },
  { plan: "STUDIO" as const, price: "$149", blurb: `Same engine for the roster · ${PLAN_LEAD_CAPS.STUDIO} leads/mo · multi-performer · team` },
];

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
      <p className="mt-4 text-sm">
        <a
          href={epkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-brand-cyan hover:opacity-80 transition-opacity"
        >
          View your press kit &rarr;
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
          <span>Leads this month</span>
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
        {meter.overCap && (
          <p className="mt-3 rounded-xl bg-[#ffdfba] px-3 py-2 text-sm text-ink-stage/80">
            {state.subscribed ? (
              <>
                <span className="font-semibold text-[#7a4100]">Lead cap reached</span> — new leads
                still arrive, but drafting is paused until you upgrade. No surprise bill, ever.
              </>
            ) : state.trialActive ? (
              <>
                <span className="font-semibold text-[#7a4100]">Lead cap reached</span> — new leads
                still arrive, but drafting is paused until you choose a plan below. No surprise
                bill, ever.
              </>
            ) : (
              <>
                <span className="font-semibold text-[#7a4100]">Trial ended</span> — your setup is
                saved and new leads still arrive, but replies and venue pitches resume once you
                choose a plan below.
              </>
            )}
          </p>
        )}
      </div>
      {!state.enabled ? (
        <p className="text-sm text-ink-stage/60">Billing isn&apos;t configured in this environment yet.</p>
      ) : state.subscribed ? (
        <form action={openBillingPortal}>
          <p className="text-sm text-ink-stage/60 mb-3">
            Manage your payment method, change plans, or cancel — no emails, no hoops.
          </p>
          <button className={buttonStyles.secondaryOnLight}>Manage billing</button>
        </form>
      ) : (
        <div>
          <p className="text-sm text-ink-stage/60 mb-5">
            {state.trialActive ? (
              <>
                You&apos;re on the free trial —{" "}
                <span className="font-semibold text-ink-stage/80">
                  {state.trialDaysLeft} day{state.trialDaysLeft === 1 ? "" : "s"} left
                </span>{" "}
                of full Pro. The agent is replying in your voice and finding venues right now. Choose
                a plan to keep it running after your trial ends — no surprise, no interruption.
              </>
            ) : (
              <>
                Your free trial has ended — your setup is saved and new inquiries are still being
                collected. Choose a plan and the agent picks right back up, replying in your voice
                and finding venues for you.
              </>
            )}
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
  if (state.subscribed) return state.plan;
  if (state.trialActive) return `Trial · ${state.trialDaysLeft}d left`;
  return "Trial ended";
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
  const [meter, billingSt, activePackages, gigs, travelWindows, mailboxConn] = await Promise.all([
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
            ?billing=success|cancelled — surfaced at the top so it's seen on land. */}
        {billing === "success" && (
          <div className="mb-6 rounded-2xl bg-brand-cyan-soft px-5 py-4 text-sm font-medium text-ink-stage">
            You&apos;re subscribed — your agent is live. Manage your plan anytime in Plan &amp; billing below.
          </div>
        )}
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
              <VoiceCard voiceSamples={business.voiceSamples} />
              <ProfileForm
                profile={{
                  headline: business.headline,
                  bio: business.bio,
                  genres: business.genres,
                  eventTypes: business.eventTypes,
                  pitchLanguages: business.pitchLanguages,
                  videoLinks: business.videoLinks,
                  photoUrls: business.photoUrls,
                  reviewQuotes: business.reviewQuotes,
                  notableVenues: business.notableVenues,
                  insured: business.insured,
                  travelPolicy: business.travelPolicy,
                  feeFloor: business.feeFloor,
                  feeSweetSpot: business.feeSweetSpot,
                  epkEnabled: business.epkEnabled,
                  currency: business.currency,
                }}
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
                windows={travelWindowRows}
              />
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
