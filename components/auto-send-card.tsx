"use client";

// "Auto-send" — the Pro+ autonomy gate (Control Room → Connections).
// Starter approves every send; Pro/Studio may let the agent send replies on its
// own, but only from sources the owner ticks here. GigSalad is never offered
// (ToS: draft + deep-link only, CLAUDE.md rule 4) and the enforcement also
// re-checks the plan at send time (lib/inbound/auto-send.ts).
//
// On Starter the card is an honest upsell, not a dead control: it explains what
// auto-send is and links to Plan & billing. Design LAW: cream inputs, cyan
// focus, mono Kicker, no emoji.

import { useActionState } from "react";
import { updateAutoSendSources } from "@/app/actions/settings";
import { Card, Kicker, buttonStyles } from "@/components/ui";
import type { LeadSource } from "@/app/generated/prisma/enums";

// Eligible auto-send sources + labels (GigSalad intentionally absent — never
// auto-sendable). Mirrors lib/inbound/auto-send.ts's eligibility.
const SOURCE_LABELS: { value: LeadSource; label: string }[] = [
  { value: "WEBSITE_FORM", label: "Your website form" },
  { value: "PLAIN_EMAIL", label: "Plain email" },
  { value: "THE_KNOT", label: "The Knot" },
  { value: "WEDDINGWIRE", label: "WeddingWire" },
  { value: "BARK", label: "Bark" },
  { value: "THUMBTACK", label: "Thumbtack" },
  { value: "OTHER", label: "Other sources" },
];

export function AutoSendCard({
  enabled,
  trusted,
}: {
  /** The plan grants auto-send (Pro/Studio/Trial). */
  enabled: boolean;
  /** Sources the owner has already trusted. */
  trusted: LeadSource[];
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { ok: boolean; error?: string } | null, formData: FormData) =>
      updateAutoSendSources(formData),
    null,
  );
  const trustedSet = new Set(trusted);

  return (
    <Card className="p-6">
      <h3 className="mb-2">
        <Kicker onLight>Auto-send</Kicker>
      </h3>
      {!enabled ? (
        <>
          <p className="text-sm text-ink-stage/60">
            On your plan you approve every reply before it sends. Upgrade to let the agent send
            replies on its own — from the sources you trust, in your voice, with your real
            availability — so you never miss the speed-to-reply race.
          </p>
          <a href="#billing" className={`${buttonStyles.secondaryOnLight} mt-4 inline-block`}>
            See Plan &amp; billing
          </a>
        </>
      ) : (
        <>
          <p className="mb-4 text-sm text-ink-stage/60">
            Pick the sources you trust enough to reply <span className="font-semibold text-ink-stage/80">without</span>{" "}
            your approval. The agent still drafts in your voice from your rate card — it just sends
            straight away for these. Everything else keeps waiting for your tap.
          </p>
          <form action={formAction} className="space-y-4">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {SOURCE_LABELS.map((s) => (
                <label key={s.value} className="flex items-center gap-2.5 text-sm text-ink-stage/80">
                  <input
                    type="checkbox"
                    name="autoSendSources"
                    value={s.value}
                    defaultChecked={trustedSet.has(s.value)}
                    className="size-4 accent-brand-cyan"
                  />
                  {s.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-ink-stage/45">
              GigSalad is never auto-sent — its rules require a personal reply, so those always wait
              for you.
            </p>
            <div className="flex items-center gap-3">
              <button type="submit" disabled={pending} className={buttonStyles.primary}>
                {pending ? "Saving…" : "Save auto-send"}
              </button>
              {state?.ok && (
                <span className="rounded-full bg-brand-cyan-soft px-3 py-1 text-sm font-semibold text-ink-stage">
                  Saved
                </span>
              )}
              {state && !state.ok && (
                <span className="text-sm font-medium text-red-600">{state.error}</span>
              )}
            </div>
          </form>
        </>
      )}
    </Card>
  );
}
