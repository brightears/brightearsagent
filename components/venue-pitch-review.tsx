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
  discardVenuePitch,
  draftVenuePitch,
  editVenuePitch,
  sendVenuePitch,
} from "@/app/actions/venues";

/** The slice of a VenuePitch row the review card renders. */
export type HuntPitch = {
  id: string;
  subject: string;
  body: string;
  status: "PENDING" | "APPROVED";
  jurisdictionMode: string; // "STANDARD" | "CONSENT" | "STRICT"
  editedSubject: string | null;
  editedBody: string | null;
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
}: {
  pitch: HuntPitch;
  jurisdictionNote: string;
  footer: string;
  mailboxConnected?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  // Optimistic sent flag — the action also flips the venue to PITCHED (it then
  // leaves the hunt feed), but this gives instant feedback on the card.
  const [sentAt, setSentAt] = useState<Date | string | null>(pitch.sentAt);

  const subject = pitch.editedSubject ?? pitch.subject;
  const body = pitch.editedBody ?? pitch.body;
  const [draftSubject, setDraftSubject] = useState(subject);
  const [draftBody, setDraftBody] = useState(body);

  // Handoff jurisdictions (CONSENT/STRICT) are copy-and-send by law — NEVER a
  // send button (the legal handoff guarantee). STANDARD + connected mailbox =
  // the auto-send path.
  const handoff = pitch.jurisdictionMode !== "STANDARD";
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
    // The handoff pattern (ADR-004): the artist sends personally and owns the
    // judgment — the copied text carries the compliance close.
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}${footer}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              className={`${buttonStyles.primary} px-3.5 py-1.5 text-sm`}
              onClick={() =>
                run(async () => {
                  const result = await editVenuePitch(pitch.id, draftSubject, draftBody);
                  if (result.ok) setEditing(false);
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
          Sent {sentLabel} from your mailbox
        </p>
      )}

      {!sentAt && pitch.status === "APPROVED" && (
        <p className="mt-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-stage/45">
          {handoff ? (
            "Copy it and send it from your own email"
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
                className={`${buttonStyles.primary} px-3.5 py-1.5 text-sm`}
                onClick={() => run(() => approveVenuePitch(pitch.id))}
              >
                Approve
              </button>
              <button
                type="button"
                disabled={pending}
                className={`${buttonStyles.secondaryOnLight} px-3.5 py-1.5 text-sm`}
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
          {/* 10.5: the auto-send path — STANDARD jurisdiction + connected
              mailbox. CONSENT/STRICT never reach here (handoff = Copy only). */}
          {canSend && (
            <button
              type="button"
              disabled={pending}
              className={`${buttonStyles.primary} px-3.5 py-1.5 text-sm`}
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
          {handoff && (
            <button
              type="button"
              className={`${buttonStyles.secondaryOnLight} px-3.5 py-1.5 text-sm`}
              onClick={copyPitch}
            >
              {copied ? "Copied" : "Copy pitch"}
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            className={`${buttonStyles.secondaryOnLight} px-3.5 py-1.5 text-sm`}
            onClick={() => run(() => discardVenuePitch(pitch.id))}
          >
            Discard
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
