"use client";

// "Your writing voice" — the voice-samples editor (Control Room "Voice &
// profile" section). Pasted past replies teach the agent the owner's tone; it
// uses them for BOTH inbound replies and venue pitches, which is why voice
// sits with the profile/ammunition rather than buried in business identity.
//
// Its own writer (updateVoice) — one section, one action, so saving here can
// never clobber a column another section owns. On-brand per docs/DESIGN.md
// v2.1: cream-tinted input on a white card, cyan focus ring, mono Kicker, no
// emoji ever.

import { useActionState } from "react";
import { updateVoice } from "@/app/actions/settings";
import { Card, Kicker, buttonStyles } from "@/components/ui";
import { stripToneNote } from "@/lib/voice/tone-note";

const inputCls =
  "w-full rounded-xl border border-cream bg-cream/40 px-3 py-2 text-sm text-ink-stage placeholder:text-ink-stage/35 focus:outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30 transition-colors";

export function VoiceCard({ voiceSamples }: { voiceSamples: string | null }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { ok: boolean; error?: string } | null, formData: FormData) =>
      updateVoice(formData),
    null,
  );

  return (
    <Card className="p-6">
      <h3 className="mb-2">
        <Kicker onLight>Your writing voice</Kicker>
      </h3>
      <p className="mb-4 text-sm text-ink-stage/60">
        Paste 2-3 replies you&apos;ve actually sent. The agent matches your tone in every reply and
        pitch — clients and venues never know it wasn&apos;t you typing.
      </p>
      <form action={formAction} className="space-y-4">
        <textarea
          id="voiceSamples"
          name="voiceSamples"
          rows={6}
          placeholder="Hey! Thanks so much for reaching out — congrats on the wedding! I'd love to be part of your day…"
          defaultValue={stripToneNote(voiceSamples)}
          className={`${inputCls} font-mono text-xs leading-relaxed`}
        />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className={buttonStyles.primary}>
            {pending ? "Saving…" : "Save voice"}
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
    </Card>
  );
}
