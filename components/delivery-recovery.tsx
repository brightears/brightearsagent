"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { correctLeadEmail } from "@/app/actions/delivery";

export function DeliveryRecovery({
  leadId,
  currentEmail,
  reason,
  complaint,
}: {
  leadId: string;
  currentEmail: string | null;
  reason: string | null;
  complaint: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await correctLeadEmail(leadId, email);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-neon-orange/45 bg-[#ffdfba] px-4 py-4 text-ink-stage shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
      <p className="font-semibold">
        {complaint ? "Follow-up stopped: spam complaint" : "This reply was not delivered"}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-ink-stage/75">
        {reason ?? "The email provider rejected the message."}
      </p>
      {complaint ? (
        <p className="mt-2 text-sm font-medium">
          This is a permanent consent stop. Bright Ears will not send to this recipient again.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start">
          <label className="flex-1">
            <span className="sr-only">Correct email address</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              placeholder={currentEmail ? `Different from ${currentEmail}` : "Correct email address"}
              className="w-full rounded-xl border border-ink-stage/20 bg-white px-3 py-2 text-sm text-ink-stage outline-none focus:border-ink-stage"
            />
            {error && <span className="mt-1 block text-xs font-semibold text-[#7a1800]">{error}</span>}
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-ink-stage px-4 py-2 text-sm font-bold text-cream-bright disabled:opacity-50"
          >
            {pending ? "Preparing…" : "Save & prepare reply"}
          </button>
        </form>
      )}
    </div>
  );
}
