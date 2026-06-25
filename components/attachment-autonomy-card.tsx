"use client";

// "Smart attachments" autonomy (Control Room → Connections). When the drafter
// detects a client asked for the act's profile or a price, the assistant can
// attach the press kit / a grounded quote automatically. Both default OFF —
// when off, the reply still flags "they asked" so you attach in one tap on
// approval. Design LAW: cream inputs, cyan, mono Kicker, no emoji.
import { useActionState } from "react";
import { updateAttachmentAutonomy } from "@/app/actions/settings";
import { Card, Kicker, buttonStyles } from "@/components/ui";

export function AttachmentAutonomyCard({
  autoAttachProfile,
  autoAttachQuote,
}: {
  autoAttachProfile: boolean;
  autoAttachQuote: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { ok: boolean; error?: string } | null, formData: FormData) =>
      updateAttachmentAutonomy(formData),
    null,
  );

  return (
    <Card className="p-6">
      <h3 className="mb-2">
        <Kicker onLight>Smart attachments</Kicker>
      </h3>
      <p className="mb-4 text-sm text-ink-stage/60">
        When a client asks for your profile or a price, the assistant can attach it for you. Off by
        default — when off, the reply still flags <em>&ldquo;they asked&rdquo;</em> so you attach it in one tap.
      </p>
      <form action={formAction} className="space-y-3">
        <label className="flex items-start gap-3 text-sm text-ink-stage/85">
          <input
            type="checkbox"
            name="autoAttachProfile"
            defaultChecked={autoAttachProfile}
            className="mt-0.5 size-4 accent-brand-cyan"
          />
          <span>
            <span className="font-semibold">Auto-attach my press kit</span> when a client wants more about the act.
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm text-ink-stage/85">
          <input
            type="checkbox"
            name="autoAttachQuote"
            defaultChecked={autoAttachQuote}
            className="mt-0.5 size-4 accent-brand-cyan"
          />
          <span>
            <span className="font-semibold">Auto-attach a quote</span> when a client asks about price. Built from your
            own rates, never below your floor — only when there&apos;s enough to quote.
          </span>
        </label>

        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={pending} className={buttonStyles.primary}>
            {pending ? "Saving…" : "Save"}
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
