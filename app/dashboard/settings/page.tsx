import { getCurrentBusiness } from "@/lib/tenant";
import { Card } from "@/components/ui";
import { SettingsForm, CopyButton } from "@/components/settings-form";
import { PushToggle } from "@/components/push-toggle";

export const dynamic = "force-dynamic";

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
