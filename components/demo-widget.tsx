"use client";

// Live demo on the landing page: paste a real inquiry, watch the reply draft
// itself. Talks to POST /api/demo-reply (rate-limited: 5 per IP per day) and
// typewriter-renders the returned subject + body in a "NOW PLAYING — YOUR
// REPLY" cream mail card with sticker chips (design language v2 "Neon
// Collage", docs/DESIGN.md). Presentation restaged June 2026; wiring unchanged.
import Link from "next/link";
import { useEffect, useState } from "react";
import { StickerChip } from "@/components/collage";

type DemoResult = { subject: string; body: string; remaining?: number };
type Phase = "idle" | "loading" | "typing" | "done" | "error";

const MIN_CHARS = 20;
const MAX_CHARS = 1200;

const SAMPLE_INQUIRY =
  "Hi! We're getting married on October 17 next year at the Grandview Barn — around 120 guests. We'd need a DJ for the ceremony, cocktail hour and reception, roughly 3pm to 10pm. Is that date open, and what would something like that cost? — Maya & Jordan";

export function DemoWidget() {
  const [inquiry, setInquiry] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<DemoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limited, setLimited] = useState(false);
  const [seconds, setSeconds] = useState(6);
  const [typed, setTyped] = useState(0);

  const busy = phase === "loading" || phase === "typing";

  // Typewriter: reveal the draft a few characters per tick, then settle to
  // "done" once the whole reply is shown. The completion transition lives in
  // the interval callback (an event context), not a render-phase effect, so we
  // never call setState directly inside an effect body (eslint react-hooks).
  useEffect(() => {
    if (phase !== "typing" || !result) return;
    const total = result.subject.length + result.body.length;
    let shown = 0;
    const id = setInterval(() => {
      shown = Math.min(shown + 3, total);
      setTyped(shown);
      if (shown >= total) {
        clearInterval(id);
        setPhase("done");
      }
    }, 16);
    return () => clearInterval(id);
  }, [phase, result]);

  async function run() {
    if (busy || inquiry.trim().length < MIN_CHARS) return;
    setPhase("loading");
    setError(null);
    setLimited(false);
    setResult(null);
    setTyped(0);
    const startedAt = Date.now();
    try {
      const res = await fetch("/api/demo-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inquiry: inquiry.trim() }),
      });
      const data = (await res.json().catch(() => null)) as
        | (Partial<DemoResult> & { error?: string })
        | null;
      if (!res.ok || !data || typeof data.subject !== "string" || typeof data.body !== "string") {
        setLimited(res.status === 429);
        setError(
          data?.error ??
            (res.status === 429
              ? "The demo is taking a breather — try again in a little while."
              : "Something went wrong — give it another try in a moment."),
        );
        setPhase("error");
        return;
      }
      setSeconds(Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
      setResult({ subject: data.subject, body: data.body, remaining: data.remaining });
      setPhase("typing");
    } catch {
      setError("Couldn't reach the demo — check your connection and try again.");
      setPhase("error");
    }
  }

  return (
    <div className="relative space-y-5 rounded-3xl bg-cream p-5 text-left text-ink-stage shadow-[0_24px_60px_rgba(0,0,0,0.45)] sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StickerChip tone="ink">Live demo</StickerChip>
        <StickerChip tone="magenta" rotate={3}>
          No sign-up needed
        </StickerChip>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="demo-inquiry"
          className="block font-extrabold tracking-tight text-ink-stage"
        >
          Paste a real inquiry you’ve received
        </label>
        <textarea
          id="demo-inquiry"
          value={inquiry}
          onChange={(e) => setInquiry(e.target.value)}
          disabled={busy}
          rows={5}
          maxLength={MAX_CHARS}
          placeholder="“Hi! Are you available October 17 for a wedding at the Grandview Barn? What do you charge?”"
          className="w-full rounded-xl border-[1.5px] border-ink-stage/15 bg-cream-bright p-3 text-sm leading-relaxed text-ink-stage placeholder:text-ink-stage/40 focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/25 disabled:opacity-60"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-stage/55">
          <button
            type="button"
            onClick={() => setInquiry(SAMPLE_INQUIRY)}
            disabled={busy}
            className="underline decoration-brand-cyan decoration-2 underline-offset-2 transition-colors hover:text-brand-cyan disabled:opacity-50"
          >
            No inquiry handy? Use a sample
          </button>
          <span className="font-mono">
            {inquiry.length}/{MAX_CHARS}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={run}
        disabled={busy || inquiry.trim().length < MIN_CHARS}
        className="w-full rounded-full bg-neon-magenta px-6 py-3 font-bold text-white shadow-[0_8px_28px_rgba(255,45,174,0.35)] transition-opacity hover:opacity-90 disabled:opacity-40 sm:w-auto"
      >
        {phase === "loading" ? "Drafting…" : phase === "typing" ? "Writing…" : "Watch the reply write itself"}
      </button>

      {phase === "loading" && (
        <p className="animate-pulse text-sm text-ink-stage/60">
          Reading the inquiry, checking the calendar, writing in your voice…
        </p>
      )}

      {phase === "error" && error && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p>{error}</p>
          {limited && (
            <Link
              href="/onboarding"
              className="mt-2 inline-block rounded-full bg-neon-magenta px-4 py-1.5 text-sm font-bold text-white shadow-[0_6px_20px_rgba(255,45,174,0.3)] transition-opacity hover:opacity-90"
            >
              Start free
            </Link>
          )}
        </div>
      )}

      {result && (phase === "typing" || phase === "done") && (
        <div className="space-y-4">
          {/* "Now playing — your reply" cream mail card */}
          <div className="overflow-hidden rounded-2xl bg-cream-bright shadow-[0_16px_40px_rgba(23,22,31,0.18)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-stage/10 px-4 py-3">
              <StickerChip tone="outline">Now playing &mdash; your reply</StickerChip>
              {phase === "done" ? (
                <StickerChip tone="magenta" rotate={4}>
                  Drafted in {seconds}s
                </StickerChip>
              ) : (
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-stage/50">
                  Nothing sends until you tap
                </span>
              )}
            </div>
            <div className="space-y-0.5 border-b border-ink-stage/10 px-4 py-2 text-xs text-ink-stage/60">
              <p>
                <span className="font-semibold">From:</span> Your DJ Business
              </p>
              <p>
                <span className="font-semibold">To:</span> Your lead
              </p>
            </div>
            <p className="border-b border-ink-stage/10 px-4 py-2 text-sm font-bold text-ink-stage">
              {result.subject.slice(0, Math.min(typed, result.subject.length))}
              {phase === "typing" && typed <= result.subject.length && <Caret />}
            </p>
            <p className="min-h-28 whitespace-pre-wrap px-4 py-3 text-sm leading-relaxed text-ink-stage/85">
              {result.body.slice(0, Math.max(0, typed - result.subject.length))}
              {phase === "typing" && typed > result.subject.length && <Caret />}
            </p>
          </div>

          {phase === "done" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ink-stage px-4 py-3 text-sm text-cream">
              <p>
                <span className="font-bold text-cream-bright">
                  This took {seconds} {seconds === 1 ? "second" : "seconds"}.
                </span>{" "}
                Imagine it happening for every lead —
              </p>
              <Link
                href="/onboarding"
                className="rounded-full bg-neon-magenta px-4 py-2 font-bold text-white shadow-[0_6px_20px_rgba(255,45,174,0.35)] transition-opacity hover:opacity-90"
              >
                Start free
              </Link>
            </div>
          )}

          {phase === "done" && typeof result.remaining === "number" && result.remaining >= 0 && (
            <p className="text-xs text-ink-stage/55">
              {result.remaining} of 5 free demo replies left today — your trial has no daily limit.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Caret() {
  return (
    <span
      aria-hidden
      className="ml-0.5 inline-block h-4 w-2 animate-pulse rounded-sm bg-neon-magenta align-middle"
    />
  );
}
