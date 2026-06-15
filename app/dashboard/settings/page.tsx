import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { Card, Badge, buttonStyles, Kicker, PageHeader } from "@/components/ui";
import { SettingsForm, CopyButton } from "@/components/settings-form";
import { PushToggle } from "@/components/push-toggle";
import { MailboxCard, type MailboxState } from "@/components/mailbox-card";
import { isConfigured as isMailboxConfigured } from "@/lib/oauth/google";
import { startCheckout, openBillingPortal, billingState } from "@/app/actions/billing";
import { PLAN_LEAD_CAPS, meterState, type MeterState } from "@/lib/billing/metering";
import { RISK_REVERSAL } from "@/lib/marketing/guarantee";

export const dynamic = "force-dynamic";

// ADR-003 tier recut: every plan is the complete assistant — blurbs gate
// capacity/autonomy (leads, performers, autopilot, team), never capability.
const PLAN_CARDS = [
  { plan: "STARTER" as const, price: "$25", blurb: `Hunts venues for you + answers leads · ${PLAN_LEAD_CAPS.STARTER} leads/mo · 1 performer` },
  { plan: "PRO" as const, price: "$79", blurb: `Same engine, more headroom · ${PLAN_LEAD_CAPS.PRO} leads/mo · auto-send autopilot` },
  { plan: "STUDIO" as const, price: "$149", blurb: `Same engine for the roster · ${PLAN_LEAD_CAPS.STUDIO} leads/mo · multi-performer · team` },
];

// Section titles use the editorial Kicker system (docs/DESIGN.md v2.1 rule 2)
// — mono ALL-CAPS tracked labels, cyan square prefix, no emoji ever (rule 1).

async function BillingCard({ meter }: { meter: MeterState }) {
  const state = await billingState();
  const pct = meter.cap > 0 ? Math.min(100, Math.round((meter.used / meter.cap) * 100)) : 100;
  // Badge: a paid plan shows the plan name; an active trial shows the countdown;
  // an ended trial (unsubscribed) shows "Trial ended".
  const badgeTone = state.subscribed || state.trialActive ? "teal" : "peach";
  const badgeLabel = state.subscribed
    ? state.plan
    : state.trialActive
      ? `Free trial · ${state.trialDaysLeft} day${state.trialDaysLeft === 1 ? "" : "s"} left`
      : "Trial ended";
  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2>
          <Kicker onLight>Plan &amp; billing</Kicker>
        </h2>
        <Badge tone={badgeTone}>{badgeLabel}</Badge>
      </div>

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
            {state.subscribed || state.trialActive ? (
              <>
                <span className="font-semibold text-[#7a4100]">Lead cap reached</span> — new leads
                still arrive, but drafting is paused until you upgrade. No surprise bill, ever.
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
            Settings &rarr; Manage billing; no charge after you cancel. {RISK_REVERSAL.capLine}
          </p>
        </div>
      )}
    </Card>
  );
}

// "Your sending mailbox" (Phase 10.5) — resolves the connection state server-
// side. If OAuth isn't enabled on this environment (no client secret — local),
// the card shows a muted note instead of a dead Connect button.
async function MailboxSection({
  businessId,
  mailbox,
  reason,
}: {
  businessId: string;
  mailbox: string | null;
  reason: string | null;
}) {
  let state: MailboxState;
  if (!isMailboxConfigured()) {
    state = { kind: "unconfigured" };
  } else {
    const conn = await db.mailboxConnection.findUnique({
      where: { businessId },
      select: { email: true, status: true, lastError: true },
    });
    if (!conn || conn.status === "REVOKED") {
      state = { kind: "disconnected" };
    } else if (conn.status === "ERROR") {
      state = { kind: "error", email: conn.email, lastError: conn.lastError };
    } else {
      state = { kind: "connected", email: conn.email };
    }
  }
  return <MailboxCard state={state} mailbox={mailbox} reason={reason} />;
}

export default async function SettingsPage({
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
  // At-cap / usage surfaced in-app (audit C3), not only via push.
  const meter = await meterState(business.id, business.plan, new Date(), business.trialEndsAt);

  return (
    <main className="flex-1 bg-ink-stage">
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <PageHeader
        title="Settings"
        subtitle="Your business, your voice, your devices — everything the AI office needs to sound like you."
      />

      <div className="space-y-6">
        {/* Post-checkout confirmation (audit C3): billing.ts redirects here with
            ?billing=success|cancelled, but nothing consumed it before. */}
        {billing === "success" && (
          <div className="rounded-2xl bg-brand-cyan-soft px-5 py-4 text-sm font-medium text-ink-stage">
            You&apos;re subscribed — your agent is live. Manage your plan anytime below.
          </div>
        )}
        {billing === "cancelled" && (
          <div className="rounded-2xl border border-cream/15 bg-ink-raised px-5 py-4 text-sm text-cream/80">
            Checkout cancelled — no charge was made. You can pick a plan whenever you&apos;re ready.
          </div>
        )}
        <BillingCard meter={meter} />
        <Card className="p-6">
          <h2 className="mb-5">
            <Kicker onLight>Business profile</Kicker>
          </h2>
          <SettingsForm
            business={{
              name: business.name,
              ownerName: business.ownerName,
              replyToEmail: business.replyToEmail,
              timezone: business.timezone,
              country: business.country,
              websiteUrl: business.websiteUrl,
              bookingLinkUrl: business.bookingLinkUrl,
              voiceSamples: business.voiceSamples,
              performerKind: business.performerKind,
            }}
          />
        </Card>

        <Card className="p-6">
          <h2 className="mb-4">
            <Kicker onLight>Your lead address</Kicker>
          </h2>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            {/* Cyan-soft pill, ink text (~12:1) — the interface accent. */}
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

        <MailboxSection businessId={business.id} mailbox={mailbox} reason={reason} />

        <Card className="p-6">
          <h2 className="mb-2">
            <Kicker onLight>Notifications</Kicker>
          </h2>
          <p className="text-sm text-ink-stage/60 mb-4">
            Get a ping the moment a reply is ready, so you can approve it from your phone — even
            from the booth.
          </p>
          <PushToggle />
        </Card>
      </div>
      </div>
    </main>
  );
}
