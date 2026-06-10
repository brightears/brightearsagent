"use client";

// Live demo on the landing page: paste a real inquiry, watch the reply draft
// itself. Talks to POST /api/demo-reply (rate-limited: 5 per IP per day) and
// typewriter-renders the returned subject + body in a mail-style card.
import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonStyles } from "@/components/ui";

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
  const totalChars = result ? result.subject.length + result.body.length : 0;

  // Typewriter: reveal the draft a few characters per tick.
  useEffect(() => {
    if (phase !== "typing" || !result) return;
    const total = result.subject.length + result.body.length;
    const id = setInterval(() => {
      setTyped((n) => Math.min(n + 3, total));
    }, 16);
    return () => clearInterval(id);
  }, [phase, result]);

  useEffect(() => {
    if (phase === "typing" && result && typed >= totalChars) setPhase("done");
  }, [phase, result, typed, totalChars]);

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
    <div className="space-y-5 rounded-3xl border border-off-white bg-white p-5 text-left shadow-sm sm:p-8">
      <div className="space-y-2">
        <label htmlFor="demo-inquiry" className="block font-semibold text-deep-teal">
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
          className="w-full rounded-xl border border-off-white bg-background p-3 text-sm leading-relaxed focus:border-brand-cyan focus:outline-none disabled:opacity-60"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink/50">
          <button
            type="button"
            onClick={() => setInquiry(SAMPLE_INQUIRY)}
            disabled={busy}
            className="underline decoration-brand-cyan decoration-2 underline-offset-2 transition-colors hover:text-brand-cyan disabled:opacity-50"
          >
            No inquiry handy? Use a sample
          </button>
          <span>
            {inquiry.length}/{MAX_CHARS}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={run}
        disabled={busy || inquiry.trim().length < MIN_CHARS}
        className={`${buttonStyles.primary} w-full px-6 py-3 sm:w-auto`}
      >
        {phase === "loading" ? "Drafting…" : phase === "typing" ? "Writing…" : "Watch the reply write itself"}
      </button>

      {phase === "loading" && (
        <p className="animate-pulse text-sm text-ink/60">
          Reading the inquiry, checking the calendar, writing in your voice…
        </p>
      )}

      {phase === "error" && error && (
        <div className="rounded-xl border border-warm-peach bg-warm-peach/30 px-4 py-3 text-sm text-ink">
          <p>{error}</p>
          {limited && (
            <Link
              href="/onboarding"
              className="mt-1 inline-block font-semibold text-deep-teal underline decoration-brand-cyan decoration-2 underline-offset-2 transition-colors hover:text-brand-cyan"
            >
              Start free
            </Link>
          )}
        </div>
      )}

      {result && (phase === "typing" || phase === "done") && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-off-white bg-white shadow-sm">
            <div className="flex items-center gap-1.5 border-b border-off-white bg-background px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-warm-peach" />
              <span className="h-2.5 w-2.5 rounded-full bg-soft-lavender" />
              <span className="h-2.5 w-2.5 rounded-full bg-brand-cyan" />
              <span className="ml-2 text-xs text-ink/50">
                Drafted for your approval — nothing sends until you tap
              </span>
            </div>
            <div className="space-y-0.5 border-b border-off-white px-4 py-2 text-xs text-ink/60">
              <p>
                <span className="font-semibold">From:</span> Your DJ Business
              </p>
              <p>
                <span className="font-semibold">To:</span> Your lead
              </p>
            </div>
            <p className="border-b border-off-white px-4 py-2 text-sm font-semibold text-deep-teal">
              {result.subject.slice(0, Math.min(typed, result.subject.length))}
              {phase === "typing" && typed <= result.subject.length && <Caret />}
            </p>
            <p className="min-h-28 whitespace-pre-wrap px-4 py-3 text-sm leading-relaxed text-ink">
              {result.body.slice(0, Math.max(0, typed - result.subject.length))}
              {phase === "typing" && typed > result.subject.length && <Caret />}
            </p>
          </div>

          {phase === "done" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-cyan-soft px-4 py-3 text-sm text-deep-teal">
              <p>
                <span className="font-bold">
                  This took {seconds} {seconds === 1 ? "second" : "seconds"}.
                </span>{" "}
                Imagine it happening for every lead —
              </p>
              <Link
                href="/onboarding"
                className="rounded-xl bg-brand-cyan px-4 py-2 font-semibold text-white transition-opacity hover:opacity-90"
              >
                Start free
              </Link>
            </div>
          )}

          {phase === "done" && typeof result.remaining === "number" && result.remaining >= 0 && (
            <p className="text-xs text-ink/50">
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
      className="ml-0.5 inline-block h-4 w-2 animate-pulse rounded-sm bg-brand-cyan align-middle"
    />
  );
}
