"use client";

// Draft review panel — the heart of the approve-from-phone loop.
// Edit the body freely; "Approve & send" passes edits through to approveDraft
// (owner edits feed voice tuning). Booked/dead controls live in their own row.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveDraft, rejectDraft, markBooked, markDead } from "@/app/actions/drafts";
import { buttonStyles } from "@/components/ui";

// Server actions return non-discriminated unions; this wider shape accepts all of them.
type ActionResult = { ok: boolean; error?: string; transport?: "postmark" | "dev" };

type Note = { kind: "success" | "error"; text: string };

export function DraftReview({
  draftId,
  leadId,
  subject,
  body,
}: {
  draftId: string;
  leadId: string;
  subject: string;
  body: string;
}) {
  const router = useRouter();
  const [editedBody, setEditedBody] = useState(body);
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState<Note | null>(null);
  const [done, setDone] = useState(false);

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
      () => approveDraft(draftId, changed ? editedBody : undefined),
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
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/50 mb-1">Subject</p>
        <p className="font-medium text-deep-teal">{subject}</p>
      </div>

      <div>
        <label
          htmlFor="draft-body"
          className="block text-xs font-semibold uppercase tracking-wide text-ink/50 mb-1"
        >
          Reply — edit freely, it sends as you
        </label>
        <textarea
          id="draft-body"
          value={editedBody}
          onChange={(e) => setEditedBody(e.target.value)}
          disabled={busy}
          rows={10}
          className="w-full rounded-xl border border-off-white bg-white p-3 text-sm leading-relaxed focus:border-brand-cyan focus:outline-none disabled:opacity-60"
        />
      </div>

      {note && (
        <p
          className={`rounded-xl px-3 py-2 text-sm ${
            note.kind === "success"
              ? "bg-brand-cyan-soft text-deep-teal"
              : "bg-red-50 text-red-600"
          }`}
        >
          {note.text}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onApprove} disabled={busy} className={buttonStyles.primary}>
          {isPending ? "Working…" : "Approve & send"}
        </button>
        <button type="button" onClick={onReject} disabled={busy} className={buttonStyles.danger}>
          Reject
        </button>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-off-white pt-4">
        <button type="button" onClick={onBooked} disabled={busy} className={buttonStyles.secondary}>
          Mark booked 🎉
        </button>
        <button type="button" onClick={onDead} disabled={busy} className={buttonStyles.danger}>
          Mark dead
        </button>
      </div>
    </div>
  );
}
