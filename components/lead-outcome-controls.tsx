"use client";

// Always-on lead outcome controls (audit C1). "Mark booked" / "Mark dead" also
// live inside DraftReview, but that panel only renders when a PENDING draft
// exists — so a lead with no pending draft (REPLIED, IN_SEQUENCE, ENGAGED, NEW…)
// had NO way to record the core booked-or-dead outcome from the app, leaving the
// pipeline's BOOKED/DEAD columns and the weekly "booked" stat unreachable. This
// renders on the lead detail page for any non-terminal lead without a draft.
//
// Styled for the ink canvas (cream-on-ink), unlike DraftReview which sits on a
// cream panel.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markBooked, markDead, draftReplyForLead } from "@/app/actions/drafts";
import { buttonStyles } from "@/components/ui";

const bookedButtonStyle =
  "rounded-full border-[1.5px] border-cream/30 text-cream/85 font-semibold px-4 py-2 transition-all hover:border-transparent hover:bg-gradient-to-r hover:from-neon-magenta hover:to-neon-orange hover:text-ink-stage disabled:opacity-40";

const deadButtonStyle =
  "rounded-full border border-red-400/40 text-red-300 font-semibold px-4 py-2 transition-colors hover:bg-red-500/10 disabled:opacity-40";

type ActionResult = { ok: boolean; error?: string };
type Note = { kind: "success" | "error"; text: string };

export function LeadOutcomeControls({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState<Note | null>(null);
  const [done, setDone] = useState(false);
  const busy = isPending || done;

  const run = (action: () => Promise<ActionResult>, text: string) =>
    startTransition(async () => {
      setNote(null);
      const result = await action();
      if (!result.ok) {
        setNote({ kind: "error", text: result.error ?? "Something went wrong — try again." });
        return;
      }
      setNote({ kind: "success", text });
      setDone(true);
      setTimeout(() => router.refresh(), 1500);
    });

  return (
    <div className="rounded-2xl border border-cream/10 bg-ink-raised p-5">
      {note && (
        <p
          className={`mb-3 rounded-xl px-3 py-2 text-sm font-medium ${
            note.kind === "success" ? "bg-brand-cyan-soft text-ink-stage" : "bg-red-500/15 text-red-300"
          }`}
        >
          {note.text}
        </p>
      )}

      {/* Draft a reply (audit C1-NF): when a prospect has replied (ENGAGED) the
          sequence stops with no new draft — let the owner generate one in-app
          instead of leaving the thread. Also retries a failed auto-draft. */}
      <p className="mb-2 text-xs text-cream/60">
        Want to write back? Draft a reply in your voice — you approve it before it sends.
      </p>
      <button
        type="button"
        onClick={() =>
          run(() => draftReplyForLead(leadId), "Draft ready below — review and send.")
        }
        disabled={busy}
        className={`${buttonStyles.primary} mb-5`}
      >
        {isPending ? "Drafting…" : "Draft a reply"}
      </button>

      <p className="mb-3 border-t border-cream/10 pt-4 text-xs text-cream/60">
        Settled this one outside the thread? Set the outcome — follow-ups stop instantly.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() =>
            run(
              () => markBooked(leadId),
              "Marked booked — follow-ups stopped and the gig is on your calendar.",
            )
          }
          disabled={busy}
          className={bookedButtonStyle}
        >
          Mark booked
        </button>
        <button
          type="button"
          onClick={() => run(() => markDead(leadId), "Marked dead — all follow-ups stopped.")}
          disabled={busy}
          className={deadButtonStyle}
        >
          Mark dead
        </button>
      </div>
    </div>
  );
}
