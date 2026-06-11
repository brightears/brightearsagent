import { getCurrentBusiness } from "@/lib/tenant";
import { Card, Badge, buttonStyles } from "@/components/ui";
import { SettingsForm, CopyButton } from "@/components/settings-form";
import { PushToggle } from "@/components/push-toggle";
import { startCheckout, openBillingPortal, billingState } from "@/app/actions/billing";
import { PLAN_LEAD_CAPS } from "@/lib/billing/metering";

export const dynamic = "force-dynamic";

const PLAN_CARDS = [
  { plan: "STARTER" as const, price: "$25", blurb: `${PLAN_LEAD_CAPS.STARTER} leads/mo · 1 performer` },
  { plan: "PRO" as const, price: "$79", blurb: `${PLAN_LEAD_CAPS.PRO} leads/mo · follow-up sequences · weekly report` },
  { plan: "STUDIO" as const, price: "$149", blurb: `${PLAN_LEAD_CAPS.STUDIO} leads/mo · multiple performers · team` },
];

async function BillingCard() {
  const state = await billingState();
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-deep-teal">Plan & billing</h2>
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
          <p className="text-sm text-ink/60 mb-4">
            {state.trialDaysLeft !== null && state.trialDaysLeft > 0
              ? "Pick a plan to keep replies flowing after your trial."
              : "Your trial has ended — new inquiries are saved but replies are paused until you subscribe."}
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            {PLAN_CARDS.map((p) => (
              <form key={p.plan} action={startCheckout.bind(null, p.plan)} className="border border-off-white rounded-xl p-4 flex flex-col gap-2">
                <div className="font-bold text-deep-teal">{p.plan.charAt(0) + p.plan.slice(1).toLowerCase()}</div>
                <div className="text-2xl font-bold">{p.price}<span className="text-sm font-normal text-ink/50">/mo</span></div>
                <div className="text-xs text-ink/60 flex-1">{p.blurb}</div>
                <button className={p.plan === "PRO" ? buttonStyles.primary : buttonStyles.secondary}>Choose</button>
              </form>
            ))}
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
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-deep-teal">Settings</h1>
        <p className="text-sm text-ink/60">
          Your business, your voice, your devices — everything the AI office needs to sound like you.
        </p>
      </header>

      <div className="space-y-6">
        <BillingCard />
        <Card className="p-6">
          <h2 className="text-lg font-bold text-deep-teal mb-4">Business profile</h2>
          <SettingsForm
            business={{
              name: business.name,
              ownerName: business.ownerName,
              replyToEmail: business.replyToEmail,
              timezone: business.timezone,
              country: business.country,
              websiteUrl: business.websiteUrl,
              voiceSamples: business.voiceSamples,
              performerKind: business.performerKind,
            }}
          />
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-bold text-deep-teal mb-2">Your lead address</h2>
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <code className="font-mono text-sm bg-brand-cyan-soft text-deep-teal rounded-xl px-3 py-2 select-all break-all">
              {leadAddress}
            </code>
            <CopyButton text={leadAddress} />
          </div>
          <p className="text-sm text-ink/60">
            Forward your inquiry email (and The Knot, WeddingWire, Bark notifications) to this
            address — every lead lands in your pipeline with a reply drafted and waiting.
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-bold text-deep-teal mb-2">Notifications</h2>
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
