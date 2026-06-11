import type { ReactNode } from "react";
import { getCurrentBusiness } from "@/lib/tenant";
import { Card, Badge, buttonStyles, PageHeader } from "@/components/ui";
import { SettingsForm, CopyButton } from "@/components/settings-form";
import { PushToggle } from "@/components/push-toggle";
import { startCheckout, openBillingPortal, billingState } from "@/app/actions/billing";
import { PLAN_LEAD_CAPS } from "@/lib/billing/metering";

export const dynamic = "force-dynamic";

// ADR-003 tier recut: every plan is the complete assistant — blurbs gate
// capacity/autonomy (leads, performers, autopilot, team), never capability.
const PLAN_CARDS = [
  { plan: "STARTER" as const, price: "$25", blurb: `${PLAN_LEAD_CAPS.STARTER} leads/mo · 1 performer · full follow-up engine` },
  { plan: "PRO" as const, price: "$79", blurb: `${PLAN_LEAD_CAPS.PRO} leads/mo · auto-send autopilot` },
  { plan: "STUDIO" as const, price: "$149", blurb: `${PLAN_LEAD_CAPS.STUDIO} leads/mo · multi-performer · team` },
];

/** Emoji-accented section title — small tinted tile + heading, marketing-page energy. */
function SectionTitle({
  emoji,
  tint,
  className = "",
  children,
}: {
  emoji: string;
  tint: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <h2 className={`flex items-center gap-2.5 text-lg font-bold text-deep-teal ${className}`}>
      <span
        aria-hidden
        className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl text-base ${tint}`}
      >
        {emoji}
      </span>
      {children}
    </h2>
  );
}

async function BillingCard() {
  const state = await billingState();
  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SectionTitle emoji="💳" tint="bg-brand-cyan-soft">
          Plan &amp; billing
        </SectionTitle>
        <Badge tone={state.subscribed ? "teal" : "peach"}>
          {state.subscribed ? state.plan : state.trialDaysLeft !== null && state.trialDaysLeft > 0 ? `Trial · ${state.trialDaysLeft} days left` : "Trial ended"}
        </Badge>
      </div>
      {!state.enabled ? (
        <p className="text-sm text-ink/60">Billing isn&apos;t configured in this environment yet.</p>
      ) : state.subscribed ? (
        <form action={openBillingPortal}>
          <p className="text-sm text-ink/60 mb-3">
            Manage your payment method, change plans, or cancel — no emails, no hoops.
          </p>
          <button className={buttonStyles.secondary}>Manage billing</button>
        </form>
      ) : (
        <div>
          <p className="text-sm text-ink/60 mb-5">
            {state.trialDaysLeft !== null && state.trialDaysLeft > 0
              ? "Pick a plan to keep replies flowing after your trial."
              : "Your trial has ended — new inquiries are saved but replies are paused until you subscribe."}
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            {PLAN_CARDS.map((p) => {
              const popular = p.plan === "PRO";
              return (
                <form
                  key={p.plan}
                  action={startCheckout.bind(null, p.plan)}
                  className={`relative flex flex-col gap-2 rounded-2xl bg-white p-5 ${
                    popular
                      ? "border border-transparent ring-2 ring-brand-cyan shadow-md"
                      : "border border-off-white"
                  }`}
                >
                  {popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <Badge tone="teal">Most popular</Badge>
                    </div>
                  )}
                  <div className="font-bold text-deep-teal">{p.plan.charAt(0) + p.plan.slice(1).toLowerCase()}</div>
                  <div className="text-3xl font-extrabold text-deep-teal">
                    {p.price}
                    <span className="text-sm font-normal text-ink/50">/mo</span>
                  </div>
                  <div className="text-xs text-ink/60 flex-1">{p.blurb}</div>
                  <button className={popular ? buttonStyles.primary : buttonStyles.secondary}>Choose</button>
                </form>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

export default async function SettingsPage() {
  const business = await getCurrentBusiness();
  const leadAddress = `leads@${business.slug}.in.brightears.io`;

  return (
    <main className="flex-1 px-6 py-8 max-w-4xl mx-auto w-full">
      <PageHeader
        title="Settings"
        subtitle="Your business, your voice, your devices — everything the AI office needs to sound like you."
      />

      <div className="space-y-6">
        <BillingCard />
        <Card className="p-6">
          <SectionTitle emoji="🏢" tint="bg-soft-lavender" className="mb-5">
            Business profile
          </SectionTitle>
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
          <SectionTitle emoji="📬" tint="bg-warm-peach" className="mb-4">
            Your lead address
          </SectionTitle>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="inline-flex max-w-full items-center rounded-full bg-brand-cyan-soft/30 px-4 py-2">
              <code className="select-all break-all font-mono text-sm font-semibold text-deep-teal">
                {leadAddress}
              </code>
            </span>
            <CopyButton text={leadAddress} />
          </div>
          <p className="text-sm text-ink/60">
            Forward your inquiry email (and The Knot, WeddingWire, Bark notifications) to this
            address — every lead lands in your pipeline with a reply drafted and waiting.
          </p>
        </Card>

        <Card className="p-6">
          <SectionTitle emoji="🔔" tint="bg-brand-cyan-soft" className="mb-2">
            Notifications
          </SectionTitle>
          <p className="text-sm text-ink/60 mb-4">
            Get a ping the moment a reply is ready, so you can approve it from your phone — even
            from the booth.
          </p>
          <PushToggle />
        </Card>
      </div>
    </main>
  );
}
