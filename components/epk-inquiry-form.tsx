"use client";

// The EPK availability form (P12.5) — WHITE-LABEL: this is the ARTIST's
// page; the form speaks as them and never mentions any product. Submissions
// feed the tenant's own inbound pipeline (app/actions/epk.ts).
import { useActionState } from "react";
import { submitEpkInquiry, type EpkInquiryState } from "@/app/actions/epk";

const inputCls =
  "w-full rounded-xl border border-cream/20 bg-ink-stage px-3.5 py-2.5 text-base text-cream-bright placeholder:text-cream/35 focus:border-neon-magenta focus:outline-none focus:ring-2 focus:ring-neon-magenta/40";

export function EpkInquiryForm({ slug, artistName }: { slug: string; artistName: string }) {
  const [state, formAction, pending] = useActionState<EpkInquiryState, FormData>(
    submitEpkInquiry.bind(null, slug),
    null,
  );

  if (state?.ok) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-cream/15 bg-ink-stage px-6 py-8 text-center">
        <p className="text-xl font-black tracking-tight text-cream-bright">Inquiry sent.</p>
        <p className="mt-2 text-sm leading-relaxed text-cream/70">
          {artistName} replies personally — usually fast. Keep an eye on your inbox.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mx-auto max-w-lg space-y-3 text-left">
      {/* Honeypot — hidden from people, irresistible to bots. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="name" required placeholder="Your name" className={inputCls} />
        <input name="email" type="email" required placeholder="Your email" className={inputCls} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="eventType" placeholder="Event type (wedding, party…)" className={inputCls} />
        <input name="eventDate" type="date" aria-label="Event date" className={inputCls} />
      </div>
      <textarea
        name="message"
        rows={4}
        placeholder="A few words about your event — venue, vibe, timings…"
        className={inputCls}
      />
      {state && !state.ok && state.error && (
        <p className="rounded-xl bg-red-500/15 px-3 py-2 text-sm font-medium text-red-300">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-neon-magenta px-7 py-3 font-bold text-white shadow-[0_8px_28px_rgba(255,45,174,0.35)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Check availability"}
      </button>
    </form>
  );
}
