"use client";

// Draft review panel — the heart of the approve-from-phone loop.
// Edit the subject/body freely; "Approve & send" persists the final copy.
// An edit changes future voice guidance only through the explicit opt-in.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveDraft,
  rejectDraft,
  markBooked,
  markDead,
  markSentOnPlatform,
} from "@/app/actions/drafts";
import { buttonStyles } from "@/components/ui";
import { StickerChip } from "@/components/collage";
import {
  DRAFT_REJECTION_REASONS,
  type DraftRejectionReason,
} from "@/lib/feedback/owner-controls";
import { parseFeeToMinor } from "@/lib/quote/fee";

// "Mark booked" is the celebration: ghost pill at rest, magenta→orange
// gradient on hover (ink text — white fails contrast on the orange end).
const bookedButtonStyle =
  "rounded-full border-[1.5px] border-ink-stage/30 text-ink-stage/80 font-semibold px-4 py-2 transition-all hover:border-transparent hover:bg-gradient-to-r hover:from-neon-magenta hover:to-neon-orange hover:text-ink-stage disabled:opacity-40";

// Server actions return non-discriminated unions; this wider shape accepts all of them.
type ActionResult = {
  ok: boolean;
  error?: string;
  transport?: "postmark" | "dev";
  confirmationDrafted?: boolean;
};

type Note = { kind: "success" | "error"; text: string };

function RejectDraftMenu({
  busy,
  onReject,
}: {
  busy: boolean;
  onReject: (reason: DraftRejectionReason) => void;
}) {
  return (
    <details>
      <summary
        className={`${buttonStyles.secondaryOnLight} inline-block cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
      >
        Reject
      </summary>
      <div className="mt-2 w-60 rounded-2xl border border-ink-stage/10 bg-white p-2 shadow-[0_16px_40px_rgba(0,0,0,0.25)]">
        <p className="px-2 pb-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-stage/45">
          What needs fixing?
        </p>
        {(Object.keys(DRAFT_REJECTION_REASONS) as DraftRejectionReason[]).map((reason) => (
          <button
            key={reason}
            type="button"
            disabled={busy}
            className="w-full rounded-xl px-2 py-1.5 text-left text-sm font-semibold text-ink-stage/80 transition-colors hover:bg-cream disabled:opacity-50"
            onClick={() => onReject(reason)}
          >
            {DRAFT_REJECTION_REASONS[reason]}
          </button>
        ))}
      </div>
    </details>
  );
}

export function DraftReview({
  draftId,
  leadId,
  subject,
  body,
  canAttachPressKit = false,
  canAttachQuote = false,
  suggestPressKit = false,
  suggestQuote = false,
  autoAttachProfile = false,
  autoAttachQuote = false,
  platform = null,
  feeCurrency = "USD",
  suggestedFeeMinor = null,
}: {
  draftId: string;
  leadId: string;
  subject: string;
  body: string;
  canAttachPressKit?: boolean;
  canAttachQuote?: boolean;
  /** Drafter detected the client asked for a profile / quote. */
  suggestPressKit?: boolean;
  suggestQuote?: boolean;
  /** The artist's auto-attach toggles — pre-tick the box when intent matches. */
  autoAttachProfile?: boolean;
  autoAttachQuote?: boolean;
  /**
   * Reply-on-platform kit (P9.8): set when the lead has no reachable email
   * (GigSalad hides it; ToS = reply on the platform, never send). Swaps
   * "Approve & send" for Copy reply → open the platform → "I sent it there".
   */
  platform?: { name: string; inboxUrl: string | null } | null;
  /** 11.1 fee capture: the artist's currency + a grounded prefill (quote). */
  feeCurrency?: string;
  suggestedFeeMinor?: number | null;
}) {
  const router = useRouter();
  const [editedSubject, setEditedSubject] = useState(subject);
  const [editedBody, setEditedBody] = useState(body);
  const [saveVoiceExample, setSaveVoiceExample] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState<Note | null>(null);
  const [done, setDone] = useState(false);
  // Pre-tick when the artist enabled auto-attach AND the client asked for it.
  const [attachPressKit, setAttachPressKit] = useState(autoAttachProfile && suggestPressKit);
  const [attachQuote, setAttachQuote] = useState(autoAttachQuote && suggestQuote);
  // 11.1 fee capture: revealed by "Mark booked", prefilled from the grounded
  // quote when one exists. Optional - blank still books.
  const [bookingOpen, setBookingOpen] = useState(false);
  const [fee, setFee] = useState(
    suggestedFeeMinor != null ? String(suggestedFeeMinor / 100) : "",
  );

  const busy = isPending || done;
  const subjectChanged = editedSubject.trim() !== subject.trim();
  const bodyChanged = editedBody.trim() !== body.trim();
  const hasEdits = subjectChanged || bodyChanged;

  const edits = () =>
    hasEdits
      ? {
          subject: subjectChanged ? editedSubject : undefined,
          body: bodyChanged ? editedBody : undefined,
          saveVoiceExample,
        }
      : undefined;

  // Show the outcome for a beat, then pull fresh server data (thread + status).
  const succeed = (text: string) => {
    setNote({ kind: "success", text });
    setDone(true);
    setTimeout(() => router.refresh(), 2000);
  };

  const fail = (error?: string) =>
    setNote({ kind: "error", text: error ?? "Something went wrong — try again." });

  const run = (action: () => Promise<ActionResult>, successText: (r: ActionResult) => string) =>
    startTransition(async () => {
      setNote(null);
      const result: ActionResult = await action();
      if (!result.ok) {
        fail(result.error);
        return;
      }
      succeed(successText(result));
    });

  const onApprove = () => {
    run(
      () =>
        approveDraft(draftId, edits(), {
          pressKit: attachPressKit,
          quote: attachQuote,
        }),
      (r) =>
        r.transport === "dev"
          ? "Reply sent via the dev transport — saved to .dev-outbox/ (no real email until Postmark is connected)."
          : "Reply sent — the lead is now in Replied.",
    );
  };

  // Platform kit (P9.8): copy is a browser act, not a server action — the
  // reply leaves through the platform's own composer, we just hand it over.
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedBody);
      setNote({
        kind: "success",
        text: `Copied — paste it into the ${platform?.name} conversation, then tap “I sent it” so follow-through gets recorded.`,
      });
    } catch {
      setNote({
        kind: "error",
        text: "Couldn't reach the clipboard — select the reply text and copy it manually.",
      });
    }
  };

  const onSentOnPlatform = () => {
    run(
      () => markSentOnPlatform(draftId, edits()),
      () => "Recorded — the lead is now in Replied.",
    );
  };

  const onReject = (reason: DraftRejectionReason) =>
    run(
      () => rejectDraft(draftId, reason),
      () => "Draft rejected — it won't be sent.",
    );

  const onBooked = () =>
    run(
      () => markBooked(leadId, parseFeeToMinor(fee) ?? undefined),
      (r) =>
        r.confirmationDrafted
          ? "Marked booked — a confirmation email is drafted for your approval."
          : "Marked booked — follow-ups stopped and the gig is on your calendar.",
    );

  const onDead = () =>
    run(
      () => markDead(leadId),
      () => "Marked dead — all follow-ups stopped.",
    );

  return (
    // Cream poster panel floating on the ink canvas (v2 "Neon Collage") —
    // the envelope holding the draft. Action card: no tilt, no collage clutter.
    <div className="relative overflow-hidden rounded-3xl bg-cream shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
      {/* Envelope flap — solid magenta accent strip with a center point. */}
      <div aria-hidden className="h-2 bg-neon-magenta" />
      <div
        aria-hidden
        className="mx-auto h-0 w-0 border-l-[16px] border-r-[16px] border-t-[10px] border-l-transparent border-r-transparent border-t-neon-magenta"
      />

      <div className="-mt-2.5 flex flex-wrap items-center justify-between gap-2 px-6 pt-4 pb-3">
        <h2 className="text-sm font-extrabold tracking-tight text-ink-stage">
          Reply ready — written in your voice
        </h2>
        <StickerChip tone="magenta" rotate={3}>
          Reply ready
        </StickerChip>
      </div>

      <div className="space-y-4 px-6 pb-6 pt-1">
        <div>
          <label
            htmlFor="draft-subject"
            className="mb-1 block font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-stage/55"
          >
            Subject
          </label>
          <input
            id="draft-subject"
            value={editedSubject}
            onChange={(event) => setEditedSubject(event.target.value)}
            disabled={busy}
            maxLength={160}
            className="w-full rounded-xl border border-ink-stage/15 bg-white px-3 py-2 text-base font-semibold text-ink-stage focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/40 disabled:opacity-60"
          />
        </div>

        <div>
          <label
            htmlFor="draft-body"
            className="mb-1 block font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-stage/55"
          >
            {platform
              ? `Reply — edit freely, then paste it on ${platform.name}`
              : "Reply — edit freely, it sends as you"}
          </label>
          <textarea
            id="draft-body"
            value={editedBody}
            onChange={(e) => setEditedBody(e.target.value)}
            disabled={busy}
            rows={10}
            maxLength={10000}
            className="w-full rounded-xl border border-ink-stage/15 bg-white p-3 text-base sm:text-sm leading-relaxed text-ink-stage focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/40 disabled:opacity-60"
          />
        </div>

        {hasEdits && (
          <div className="rounded-xl bg-white/60 px-3 py-2.5">
            <label className="flex items-start gap-2 text-sm font-semibold text-ink-stage/80">
              <input
                type="checkbox"
                checked={saveVoiceExample}
                onChange={(event) => setSaveVoiceExample(event.target.checked)}
                disabled={busy}
                className="mt-0.5 size-4 accent-brand-cyan"
              />
              Save this edit as a voice example
            </label>
            <p className="ml-6 mt-1 text-xs text-ink-stage/50">
              Optional. Editing this reply alone won&apos;t change future writing.
            </p>
          </div>
        )}

        {note && (
          <p
            className={`rounded-xl px-3 py-2 text-sm font-medium ${
              note.kind === "success"
                ? "bg-brand-cyan-soft text-ink-stage"
                : "bg-red-50 text-red-600"
            }`}
          >
            {note.text}
          </p>
        )}

        {/* Attachments ride emails — a platform paste can't carry a PDF. */}
        {!platform && (canAttachPressKit || canAttachQuote) && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-white/60 px-3 py-2.5">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-stage/45">
              Attach
            </span>
            {canAttachPressKit && (
              <label className="flex items-center gap-2 text-sm text-ink-stage/80">
                <input
                  type="checkbox"
                  checked={attachPressKit}
                  onChange={(e) => setAttachPressKit(e.target.checked)}
                  disabled={busy}
                  className="size-4 accent-brand-cyan"
                />
                Press kit
                {suggestPressKit && (
                  <span className="font-semibold text-brand-cyan">· they asked</span>
                )}
              </label>
            )}
            {canAttachQuote && (
              <label className="flex items-center gap-2 text-sm text-ink-stage/80">
                <input
                  type="checkbox"
                  checked={attachQuote}
                  onChange={(e) => setAttachQuote(e.target.checked)}
                  disabled={busy}
                  className="size-4 accent-brand-cyan"
                />
                Quote
                {suggestQuote && (
                  <span className="font-semibold text-brand-cyan">· they asked</span>
                )}
              </label>
            )}
          </div>
        )}

        {platform ? (
          // Reply-on-platform kit (P9.8): the platform hides the client's
          // email, so the reply travels by clipboard — copy, paste there,
          // then record that it happened.
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onCopy}
              disabled={busy}
              className={`${buttonStyles.primary} flex-1 sm:flex-none sm:px-8`}
            >
              Copy reply
            </button>
            {platform.inboxUrl && (
              <a
                href={platform.inboxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonStyles.secondaryOnLight}
              >
                Open {platform.name}
              </a>
            )}
            <button
              type="button"
              onClick={onSentOnPlatform}
              disabled={busy}
              className={buttonStyles.secondaryOnLight}
            >
              {isPending ? "Working…" : "I sent it there"}
            </button>
            <RejectDraftMenu busy={busy} onReject={onReject} />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {/* Approve & send = the daily click → solid CYAN pill (interface voice). */}
            <button
              type="button"
              onClick={onApprove}
              disabled={busy}
              className={`${buttonStyles.primary} flex-1 sm:flex-none sm:px-8`}
            >
              {isPending ? "Working…" : "Approve & send"}
            </button>
            {/* Ghost pill — ink outline on the cream panel (cream outline would vanish here). */}
            <RejectDraftMenu busy={busy} onReject={onReject} />
          </div>
        )}

        <div className="border-t border-ink-stage/10 pt-4">
          <p className="mb-2 text-xs text-ink-stage/55">
            Already settled this one outside the thread? Set the outcome — follow-ups stop
            instantly.
          </p>
          {bookingOpen ? (
            <div className="space-y-2">
              <label
                htmlFor="booked-fee"
                className="block font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-stage/55"
              >
                Fee — optional, stays private ({feeCurrency})
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  id="booked-fee"
                  inputMode="decimal"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  disabled={busy}
                  placeholder="e.g. 15000"
                  className="w-36 rounded-xl border border-ink-stage/15 bg-white px-3 py-2 text-base sm:text-sm text-ink-stage focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/40 disabled:opacity-60"
                />
                <button type="button" onClick={onBooked} disabled={busy} className={bookedButtonStyle}>
                  Confirm booked
                </button>
                <button
                  type="button"
                  onClick={() => setBookingOpen(false)}
                  disabled={busy}
                  className="text-sm font-semibold text-ink-stage/45 transition-colors hover:text-ink-stage/70"
                >
                  Cancel
                </button>
              </div>
              <p className="text-[11px] text-ink-stage/50">
                Powers your booked-value receipts — the client never sees it.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setBookingOpen(true)}
                disabled={busy}
                className={bookedButtonStyle}
              >
                Mark booked
              </button>
              <button type="button" onClick={onDead} disabled={busy} className={buttonStyles.danger}>
                Mark dead
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
