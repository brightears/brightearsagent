"use client";

// "Your writing voice" — the voice editor (Control Room "Voice & profile"
// section). Pasted past replies teach the agent the owner's tone; a few
// structured signals (greeting / sign-off / emoji / go-to phrases) pin down what
// a single sample may not. It feeds BOTH inbound replies and venue pitches,
// which is why voice sits with the profile rather than business identity.
//
// Its own writer (updateVoice) — one section, one action, so saving here can
// never clobber a column another section owns. On-brand per docs/DESIGN.md
// v2.1: cream-tinted input on a white card, cyan focus ring, mono Kicker, no
// emoji ever in the UI chrome.

import { useActionState } from "react";
import { updateVoice } from "@/app/actions/settings";
import { Card, Kicker, buttonStyles } from "@/components/ui";
import { stripToneNote } from "@/lib/voice/tone-note";

const inputCls =
  "w-full rounded-xl border border-cream bg-cream/40 px-3 py-2 text-base sm:text-sm text-ink-stage placeholder:text-ink-stage/35 focus:outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30 transition-colors";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-ink-stage/60 mb-1";
const hintCls = "mt-1 text-xs text-ink-stage/45";

export type VoiceFields = {
  voiceSamples: string | null;
  voiceGreeting: string | null;
  voiceSignoff: string | null;
  voiceUsesEmoji: boolean | null;
  voicePhrases: string | null;
};

export function VoiceCard({ voice }: { voice: VoiceFields }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { ok: boolean; error?: string } | null, formData: FormData) =>
      updateVoice(formData),
    null,
  );

  const emojiDefault =
    voice.voiceUsesEmoji === false ? "never" : voice.voiceUsesEmoji === true ? "sometimes" : "";

  return (
    <Card className="p-6">
      <h3 className="mb-2">
        <Kicker onLight>Your writing voice</Kicker>
      </h3>
      <p className="mb-4 text-sm text-ink-stage/60">
        Paste 2-3 replies you&apos;ve actually sent, then answer a couple of quick questions. The agent
        matches your tone in every reply and pitch — clients and venues never know it wasn&apos;t you.
      </p>
      <form action={formAction} className="space-y-5">
        <div>
          <label htmlFor="voiceSamples" className={labelCls}>Replies you&apos;ve sent</label>
          <textarea
            id="voiceSamples"
            name="voiceSamples"
            rows={6}
            placeholder="Hey! Thanks so much for reaching out — congrats on the wedding! I'd love to be part of your day…"
            defaultValue={stripToneNote(voice.voiceSamples)}
            className={`${inputCls} font-mono text-xs leading-relaxed`}
          />
          <p className={hintCls}>Separate different replies with a blank line. More variety = a sharper match.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="voiceGreeting" className={labelCls}>How you open</label>
            <input
              id="voiceGreeting"
              name="voiceGreeting"
              placeholder="Hey [name]! / Hi [name],"
              defaultValue={voice.voiceGreeting ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="voiceSignoff" className={labelCls}>How you sign off</label>
            <input
              id="voiceSignoff"
              name="voiceSignoff"
              placeholder="Cheers, Sam / Talk soon —"
              defaultValue={voice.voiceSignoff ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="voiceUsesEmoji" className={labelCls}>Emojis</label>
            <select
              id="voiceUsesEmoji"
              name="voiceUsesEmoji"
              defaultValue={emojiDefault}
              className={inputCls}
            >
              <option value="">No preference</option>
              <option value="never">Never</option>
              <option value="sometimes">Now &amp; then</option>
            </select>
          </div>
          <div>
            <label htmlFor="voicePhrases" className={labelCls}>Words you lean on</label>
            <input
              id="voicePhrases"
              name="voicePhrases"
              placeholder="let's lock it in, stoked, no worries"
              defaultValue={voice.voicePhrases ?? ""}
              className={inputCls}
            />
          </div>
        </div>

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
