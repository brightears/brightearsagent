// Voice-samples tone marker. Onboarding (app/actions/onboarding.ts
// saveVoiceSamples) appends an internal "\n\n[Tone: Fun & casual]" marker to
// Business.voiceSamples to remember the tone chips the owner picked. It is an
// INTERNAL marker, not prose the owner should see or edit — both the onboarding
// wizard and the Control Room voice card strip it for display and re-attach it
// on save, so the structured tone preference survives a manual edit instead of
// leaking into the textarea (or being silently dropped). The LLM reads
// voiceSamples verbatim (lib/agent/voice.ts, lib/agent/venue-pitch.ts), so the
// marker stays appended in storage on purpose.

const TONE_NOTE_RE = /\n\n\[Tone: [^\]]*\]\s*$/;

/** Strip the trailing internal "[Tone: …]" marker for display/editing. */
export function stripToneNote(samples: string | null | undefined): string {
  return (samples ?? "").replace(TONE_NOTE_RE, "");
}

/** The tone string inside the trailing marker (e.g. "Fun & casual"), or null. */
export function toneNoteOf(samples: string | null | undefined): string | null {
  const m = (samples ?? "").match(/\[Tone: ([^\]]*)\]\s*$/);
  return m ? m[1] : null;
}

/**
 * Re-attach the stored tone marker to freshly-edited samples. `edited` is what
 * the owner typed; `tone` is the tone to keep. Any trailing marker is stripped
 * from `edited` first, so a user who happens to type a "[Tone: …]"-shaped line
 * can never override or duplicate the real onboarding tone — the stored tone
 * always wins. No-op when there's no tone or the edited text is blank.
 */
export function withToneNote(edited: string, tone: string | null): string {
  const base = stripToneNote(edited);
  if (!tone || !base.trim()) return base;
  return `${base}\n\n[Tone: ${tone}]`;
}
