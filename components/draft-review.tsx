"use client";

// Draft review panel — the heart of the approve-from-phone loop.
// Edit the body freely; "Approve & send" passes edits through to approveDraft
// (owner edits feed voice tuning). Booked/dead controls live in their own row.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveDraft, rejectDraft, markBooked, markDead } from "@/app/actions/drafts";
import { buttonStyles } from "@/components/ui";
import { StickerChip } from "@/components/collage";

// "Mark booked" is the celebration: ghost pill at rest, magenta→orange
// gradient on hover (ink text — white fails contrast on the orange end).
const bookedButtonStyle =
  "rounded-full border-[1.5px] border-ink-stage/30 text-ink-stage/80 font-semibold px-4 py-2 transition-all hover:border-transparent hover:bg-gradient-to-r hover:from-neon-magenta hover:to-neon-orange hover:text-ink-stage disabled:opacity-40";

// Server actions return non-discriminated unions; this wider shape accepts all of them.
type ActionResult = { ok: boolean; error?: string; transport?: "postmark" | "dev" };

type Note = { kind: "success" | "error"; text: string };

export function DraftReview({
  draftId,
  leadId,
  subject,
  body,
  canAttachPressKit = false,
  canAttachQuote = false,
}: {
  draftId: string;
  leadId: string;
  subject: string;
  body: string;
  canAttachPressKit?: boolean;
  canAttachQuote?: boolean;
}) {
  const router = useRouter();
  const [editedBody, setEditedBody] = useState(body);
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState<Note | null>(null);
  const [done, setDone] = useState(false);
  const [attachPressKit, setAttachPressKit] = useState(false);
  const [attachQuote, setAttachQuote] = useState(false);

  const busy = isPending || done;

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
    const changed = editedBody.trim() !== body.trim();
    run(
      () =>
        approveDraft(draftId, changed ? editedBody : undefined, {
          pressKit: attachPressKit,
          quote: attachQuote,
        }),
      (r) =>
        r.transport === "dev"
          ? "Reply sent via the dev transport — saved to .dev-outbox/ (no real email until Postmark is connected)."
          : "Reply sent — the lead is now in Replied.",
    );
  };

  const onReject = () =>
    run(
      () => rejectDraft(draftId),
      () => "Draft rejected — it won't be sent.",
    );

  const onBooked = () =>
    run(
      () => markBooked(leadId),
      () => "Marked booked — follow-ups stopped and the gig is on your calendar.",
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
          <p className="mb-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-stage/55">
            Subject
          </p>
          <p className="font-semibold text-ink-stage">{subject}</p>
        </div>

        <div>
          <label
            htmlFor="draft-body"
            className="mb-1 block font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-stage/55"
          >
            Reply — edit freely, it sends as you
          </label>
          <textarea
            id="draft-body"
            value={editedBody}
            onChange={(e) => setEditedBody(e.target.value)}
            disabled={busy}
            rows={10}
            className="w-full rounded-xl border border-ink-stage/15 bg-white p-3 text-sm leading-relaxed text-ink-stage focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/40 disabled:opacity-60"
          />
        </div>

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

        {(canAttachPressKit || canAttachQuote) && (
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
              </label>
            )}
          </div>
        )}

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
          <button
            type="button"
            onClick={onReject}
            disabled={busy}
            className={buttonStyles.secondaryOnLight}
          >
            Reject
          </button>
        </div>

        <div className="border-t border-ink-stage/10 pt-4">
          <p className="mb-2 text-xs text-ink-stage/55">
            Already settled this one outside the thread? Set the outcome — follow-ups stop
            instantly.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={onBooked} disabled={busy} className={bookedButtonStyle}>
              Mark booked
            </button>
            <button type="button" onClick={onDead} disabled={busy} className={buttonStyles.danger}>
              Mark dead
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
