"use client";

// Pitch review on the Hunt card (Phase 10.3) — the founder-approved UX: "the
// system will post it and the artist can decide if or if not to engage."
// Client component because Edit needs an inline textarea and Draft needs a
// friendly error surface; all decisions still run through the tenant-scoped
// server actions in app/actions/venues.ts.

import { useState, useTransition } from "react";
import { Badge, buttonStyles } from "@/components/ui";
import {
  approveVenuePitch,
  authorizeVenuePitchCopy,
  discardVenuePitch,
  draftVenuePitch,
  editVenuePitch,
  recordManualVenuePitchSend,
  sendVenuePitch,
  skipVenuePitch,
} from "@/app/actions/venues";
import {
  VENUE_PITCH_DISCARD_REASONS,
  type VenuePitchDiscardReason,
} from "@/lib/feedback/owner-controls";
import { SKIP_REASONS, type SkipReason } from "@/lib/venues/feed";

/** The slice of a VenuePitch row the review card renders. */
export type HuntPitch = {
  id: string;
  subject: string;
  body: string;
  status: "PENDING" | "APPROVED";
  jurisdictionMode: string; // "STANDARD" | "CONSENT" | "STRICT"
  language: string;
  editedSubject: string | null;
  editedBody: string | null;
  voiceSampleSavedAt: Date | string | null;
  /** 10.5: set once the pitch sent from the artist's own mailbox. */
  sentAt: Date | string | null;
};

/** "Draft pitch" with an inline error line (LLM hiccups deserve words, not silence). */
export function DraftPitchButton({ venueId }: { venueId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className={`${buttonStyles.primary} px-3.5 py-1.5 text-sm`}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await draftVenuePitch(venueId);
            if (!result.ok) setError(result.error);
          })
        }
      >
        {pending ? "Writing your pitch…" : "Draft pitch"}
      </button>
      {error && <p className="mt-1.5 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}

export function VenuePitchReview({
  pitch,
  /** Jurisdiction note for the card — empty string when mode is STANDARD-no-note. */
  jurisdictionNote,
  /** Compliance close, precomputed server-side — appended on copy, never editable. */
  footer,
  /** 10.5: a sending mailbox is connected — gates "Send now" on STANDARD cards. */
  mailboxConnected = false,
  /** Physical sender identity is mandatory for every outreach handoff. */
  postalAddressReady = false,
}: {
  pitch: HuntPitch;
  jurisdictionNote: string;
  footer: string;
  mailboxConnected?: boolean;
  postalAddressReady?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyPrepared, setCopyPrepared] = useState(false);
  const [saveVoiceExample, setSaveVoiceExample] = useState(false);
  const [voiceExampleSaved, setVoiceExampleSaved] = useState(!!pitch.voiceSampleSavedAt);
  // Optimistic sent flag — the action also flips the venue to PITCHED (it then
  // leaves the hunt feed), but this gives instant feedback on the card.
  const [sentAt, setSentAt] = useState<Date | string | null>(pitch.sentAt);

  const [subject, setSubject] = useState(pitch.editedSubject ?? pitch.subject);
  const [body, setBody] = useState(pitch.editedBody ?? pitch.body);
  const [draftSubject, setDraftSubject] = useState(subject);
  const [draftBody, setDraftBody] = useState(body);
  const hasDraftEdits =
    draftSubject.trim() !== subject.trim() || draftBody.trim() !== body.trim();

  // Consent-first jurisdictions and languages without complete deterministic
  // semantic validation are manual-review handoffs — never auto-send.
  const consentFirst = pitch.jurisdictionMode !== "STANDARD";
  const manualReviewLanguage = pitch.language.trim().toLowerCase() !== "en";
  const handoff = consentFirst || manualReviewLanguage;
  const canSend = !handoff && pitch.status === "APPROVED" && mailboxConnected && !sentAt;
  const sentLabel = sentAt
    ? new Date(sentAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const run = (action: () => Promise<{ ok: boolean } | { ok: false; error: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (!result.ok) setError("error" in result ? result.error : "Something went sideways — try again");
    });

  const copyPitch = async () => {
    if (!postalAddressReady) {
      return {
        ok: false as const,
        error: "Add your business mailing address in Settings before copying this pitch",
      };
    }
    // Copying is preparation, not proof of send or a compliance decision.
    // Re-check suppression immediately before facilitating the handoff.
    const result = await authorizeVenuePitchCopy(pitch.id);
    if (!result.ok) return result;
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}${footer}`);
    setCopied(true);
    setCopyPrepared(true);
    setTimeout(() => setCopied(false), 2000);
    return result;
  };

  return (
    <div className="mt-4 border-t border-ink-stage/10 pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-ink-stage/50">
          Draft pitch
        </p>
        {sentAt ? (
          <Badge tone="teal">Sent</Badge>
        ) : (
          pitch.status === "APPROVED" && <Badge tone="cyan">Ready to send</Badge>
        )}
      </div>

      {editing ? (
        <div className="mt-2 space-y-2">
          <input
            value={draftSubject}
            onChange={(e) => setDraftSubject(e.target.value)}
            maxLength={120}
            aria-label="Pitch subject"
            className="w-full rounded-xl border border-ink-stage/15 bg-cream/60 px-3 py-1.5 text-sm font-bold text-ink-stage focus:outline-none focus:ring-2 focus:ring-brand-cyan"
          />
          <textarea
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
            rows={8}
            maxLength={4000}
            aria-label="Pitch body"
            className="w-full rounded-xl border border-ink-stage/15 bg-cream/60 px-3 py-2 text-sm text-ink-stage focus:outline-none focus:ring-2 focus:ring-brand-cyan"
          />
          {hasDraftEdits && !voiceExampleSaved && (
            <div className="rounded-xl bg-cream/60 px-3 py-2.5">
              <label className="flex items-start gap-2 text-sm font-semibold text-ink-stage/80">
                <input
                  type="checkbox"
                  checked={saveVoiceExample}
                  onChange={(event) => setSaveVoiceExample(event.target.checked)}
                  disabled={pending}
                  className="mt-0.5 size-4 accent-brand-cyan"
                />
                Save this edit as a voice example
              </label>
              <p className="ml-6 mt-1 text-xs text-ink-stage/50">
                Optional. Editing this pitch alone won&apos;t change future writing.
              </p>
            </div>
          )}
          {voiceExampleSaved && (
            <p className="text-xs font-semibold text-ink-stage/55">
              A voice example from this pitch has already been saved.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              className={`${buttonStyles.primary} px-3.5 py-1.5 text-sm`}
              onClick={() =>
                run(async () => {
                  const result = await editVenuePitch(
                    pitch.id,
                    draftSubject,
                    draftBody,
                    saveVoiceExample,
                  );
                  if (result.ok) {
                    setSubject(draftSubject.trim());
                    setBody(draftBody.trim());
                    if (
                      "voiceExampleSaved" in result &&
                      result.voiceExampleSaved
                    ) {
                      setVoiceExampleSaved(true);
                    }
                    setSaveVoiceExample(false);
                    setEditing(false);
                  }
                  return result;
                })
              }
            >
              Save
            </button>
            <button
              type="button"
              disabled={pending}
              className={`${buttonStyles.secondaryOnLight} px-3.5 py-1.5 text-sm`}
              onClick={() => {
                setDraftSubject(subject);
                setDraftBody(body);
                setSaveVoiceExample(false);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm font-bold text-ink-stage">{subject}</p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink-stage/80">{body}</p>
        </>
      )}

      {jurisdictionNote && (
        <p className="mt-2.5 flex items-start gap-2 text-xs text-ink-stage/75">
          <span aria-hidden className="mt-1.5 size-1 flex-none bg-neon-orange" />
          {jurisdictionNote}
        </p>
      )}

      {sentAt && sentLabel && (
        <p className="mt-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-stage/45">
          Sent {sentLabel} {handoff ? "by you" : "from your mailbox"}
        </p>
      )}

      {!sentAt && pitch.status === "APPROVED" && (
        <p className="mt-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-stage/45">
          {handoff ? (
            !postalAddressReady ? (
              <>
                <a
                  href="/dashboard/settings#business-mailing-address"
                  className="text-brand-cyan hover:opacity-80"
                >
                  Add your business mailing address
                </a>{" "}
                before copying or sending
              </>
            ) : consentFirst ? (
              "Only send if you have consent or another lawful basis — copying it manually is not compliance"
            ) : (
              "Review every line, then copy and send it yourself"
            )
          ) : mailboxConnected ? (
            "Sends from your own inbox — venues hear from you"
          ) : (
            <>
              <a
                href="/dashboard/settings#connections"
                className="text-brand-cyan hover:opacity-80"
              >
                Connect your mailbox
              </a>{" "}
              to send
            </>
          )}
        </p>
      )}

      {!editing && !sentAt && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {pitch.status === "PENDING" && (
            <>
              <button
                type="button"
                disabled={pending}
                className={`${buttonStyles.primary} min-h-11 w-full px-3.5 py-1.5 text-sm sm:min-h-0 sm:w-auto`}
                onClick={() => run(() => approveVenuePitch(pitch.id))}
              >
                Approve
              </button>
              <button
                type="button"
                disabled={pending}
                className={`${buttonStyles.secondaryOnLight} min-h-11 flex-1 px-3.5 py-1.5 text-sm sm:min-h-0 sm:flex-none`}
                onClick={() => {
                  setDraftSubject(subject);
                  setDraftBody(body);
                  setEditing(true);
                }}
              >
                Edit
              </button>
            </>
          )}
          {/* Auto-send is English + STANDARD only. Consent-first and other
              language drafts remain review/copy handoffs. */}
          {canSend && (
            <button
              type="button"
              disabled={pending}
              className={`${buttonStyles.primary} min-h-11 w-full px-3.5 py-1.5 text-sm sm:min-h-0 sm:w-auto`}
              onClick={() =>
                run(async () => {
                  const result = await sendVenuePitch(pitch.id);
                  if (result.ok) setSentAt(new Date());
                  return result;
                })
              }
            >
              {pending ? "Sending…" : "Send now"}
            </button>
          )}
          {handoff && pitch.status === "APPROVED" && (
            <>
              <button
                type="button"
                disabled={pending || !postalAddressReady}
                className={`${buttonStyles.secondaryOnLight} px-3.5 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-45`}
                onClick={() => run(copyPitch)}
              >
                {copied ? "Copied" : "Copy pitch"}
              </button>
              {copyPrepared && (
                <button
                  type="button"
                  disabled={pending || !postalAddressReady}
                  className={`${buttonStyles.primary} px-3.5 py-1.5 text-sm`}
                  onClick={() =>
                    run(async () => {
                      const result = await recordManualVenuePitchSend(
                        pitch.id,
                        consentFirst,
                      );
                      if (result.ok) setSentAt(new Date());
                      return result;
                    })
                  }
                >
                  {consentFirst
                    ? "I had a lawful basis and sent it"
                    : "I reviewed and sent it"}
                </button>
              )}
            </>
          )}
          <details className="relative">
            <summary
              className={`${buttonStyles.secondaryOnLight} inline-block cursor-pointer list-none px-3.5 py-1.5 text-sm [&::-webkit-details-marker]:hidden`}
              title="Discard this wording but keep the venue available"
            >
              Discard draft
            </summary>
            <div className="absolute right-0 top-full z-20 mt-2 w-60 rounded-2xl border border-ink-stage/10 bg-white p-2 shadow-[0_16px_40px_rgba(0,0,0,0.25)]">
              <p className="px-2 pb-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-stage/45">
                What needs fixing?
              </p>
              {(Object.keys(VENUE_PITCH_DISCARD_REASONS) as VenuePitchDiscardReason[]).map(
                (reason) => (
                  <button
                    key={reason}
                    type="button"
                    disabled={pending}
                    className="w-full rounded-xl px-2 py-1.5 text-left text-sm font-semibold text-ink-stage/80 transition-colors hover:bg-cream disabled:opacity-50"
                    onClick={() => run(() => discardVenuePitch(pitch.id, reason))}
                  >
                    {VENUE_PITCH_DISCARD_REASONS[reason]}
                  </button>
                ),
              )}
            </div>
          </details>
          <details className="relative">
            <summary
              className={`${buttonStyles.secondaryOnLight} inline-block cursor-pointer list-none px-3.5 py-1.5 text-sm [&::-webkit-details-marker]:hidden`}
              title="Remove this venue and record why it missed"
            >
              Not a fit
            </summary>
            <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-2xl border border-ink-stage/10 bg-white p-2 shadow-[0_16px_40px_rgba(0,0,0,0.25)]">
              <p className="px-2 pb-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-stage/45">
                What missed?
              </p>
              {(Object.keys(SKIP_REASONS) as SkipReason[]).map((reason) => (
                <button
                  key={reason}
                  type="button"
                  disabled={pending}
                  className="w-full rounded-xl px-2 py-1.5 text-left text-sm font-semibold text-ink-stage/80 transition-colors hover:bg-cream disabled:opacity-50"
                  onClick={() => run(() => skipVenuePitch(pitch.id, reason))}
                >
                  {SKIP_REASONS[reason]}
                </button>
              ))}
            </div>
          </details>
        </div>
      )}

      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
