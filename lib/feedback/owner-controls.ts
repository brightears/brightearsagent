import { stripToneNote, toneNoteOf, withToneNote } from "@/lib/voice/tone-note";

/**
 * Small, stable reason codes for owner decisions. Labels stay human; the codes
 * stay useful for quality reviews without treating a free-text complaint as a
 * reliable metric.
 */
export const DRAFT_REJECTION_REASONS = {
  WRONG_DETAILS: "The details are wrong",
  WRONG_TONE: "It doesn’t sound like me",
  TOO_GENERIC: "It’s too generic",
  HANDLE_MYSELF: "I’ll reply myself",
  NOT_READY: "I’m not ready to reply",
} as const;

export type DraftRejectionReason = keyof typeof DRAFT_REJECTION_REASONS;

export function isDraftRejectionReason(value: string): value is DraftRejectionReason {
  return Object.prototype.hasOwnProperty.call(DRAFT_REJECTION_REASONS, value);
}

export const VENUE_PITCH_DISCARD_REASONS = {
  WRONG_DETAILS: "The details are wrong",
  WRONG_TONE: "It doesn’t sound like me",
  TOO_GENERIC: "It’s too generic",
  WRONG_APPROACH: "Try a different angle",
  HANDLE_MYSELF: "I’ll write this one",
} as const;

export type VenuePitchDiscardReason = keyof typeof VENUE_PITCH_DISCARD_REASONS;

export function isVenuePitchDiscardReason(value: string): value is VenuePitchDiscardReason {
  return Object.prototype.hasOwnProperty.call(VENUE_PITCH_DISCARD_REASONS, value);
}

const MAX_EXAMPLE_CHARS = 1_600;
const MAX_SAMPLES_CHARS = 16_000;

export type VoiceExampleKind = "reply" | "venue pitch";

/**
 * Append one explicitly saved edit without letting repeated approvals grow the
 * voice prompt forever. The onboarding tone marker always remains the final
 * line, where the existing voice editor expects it.
 *
 * Existing samples are never deleted to make room. At the total cap, the edit
 * is truncated to the remaining space (or ignored when no useful room remains).
 */
export function appendVoiceExample(
  current: string | null | undefined,
  example: { kind: VoiceExampleKind; subject: string; body: string },
): string | null {
  const tone = toneNoteOf(current);
  const existing = stripToneNote(current).trim();
  const subject = example.subject.replace(/[\x00-\x1F\x7F]+/g, " ").trim().slice(0, 160);
  const body = example.body.replace(/\r\n?/g, "\n").trim();
  const formatted = [
    `Saved ${example.kind} example`,
    subject ? `Subject: ${subject}` : "",
    body,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_EXAMPLE_CHARS)
    .trimEnd();

  if (!formatted) return current ?? null;

  const separator = existing ? "\n\n---\n" : "";
  const toneSuffix = tone ? `\n\n[Tone: ${tone}]` : "";
  const room = MAX_SAMPLES_CHARS - existing.length - separator.length - toneSuffix.length;
  // A tiny, chopped fragment is worse guidance than no example at all.
  if (room < 120) return current ?? null;

  const appended = `${existing}${separator}${formatted.slice(0, room).trimEnd()}`;
  return withToneNote(appended, tone) || null;
}
