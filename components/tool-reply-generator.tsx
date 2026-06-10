"use client";

import { useState } from "react";
import Link from "next/link";
import { saveMarketingContact } from "@/app/actions/marketing";
import { buttonStyles } from "@/components/ui";

const SAMPLES: { label: string; text: string }[] = [
  {
    label: "Wedding (The Knot style)",
    text: "Hi! We're getting married October 17 next year at Cedar Grove Barn in Asheville, about 120 guests. We want a packed dance floor but also a really smooth ceremony and dinner — do you handle MC duties too? What would something like that run us?",
  },
  {
    label: "Price shopper",
    text: "How much do you charge for a wedding? June 6, around 150 people.",
  },
  {
    label: "Corporate party",
    text: "Hello — I'm organizing our company holiday party on December 12, roughly 80 people at a downtown hotel. We'd need a DJ from 7 to 11pm with a sound system and some uplighting. Could you send pricing and availability?",
  },
];

type DemoState =
  | { phase: "idle" }
  | { phase: "drafting" }
  | { phase: "done"; subject: string; body: string; remaining: number }
  | { phase: "error"; message: string };

type GateState =
  | { phase: "idle" }
  | { phase: "saving" }
  | { phase: "done" }
  | { phase: "error"; message: string };

export function ToolReplyGenerator() {
  const [inquiry, setInquiry] = useState("");
  const [state, setState] = useState<DemoState>({ phase: "idle" });
  const [email, setEmail] = useState("");
  const [gate, setGate] = useState<GateState>({ phase: "idle" });

  async function draft() {
    if (inquiry.trim().length < 20) {
      setState({ phase: "error", message: "Paste a real inquiry (at least a sentence or two)." });
      return;
    }
    setState({ phase: "drafting" });
    try {
      const res = await fetch("/api/demo-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inquiry: inquiry.trim() }),
      });
      const data = (await res.json()) as {
        subject?: string;
        body?: string;
        remaining?: number;
        error?: string;
      };
      if (!res.ok || !data.subject || !data.body) {
        setState({
          phase: "error",
          message: data.error ?? "Something went wrong drafting that — please try again.",
        });
        return;
      }
      setState({
        phase: "done",
        subject: data.subject,
        body: data.body,
        remaining: data.remaining ?? 0,
      });
    } catch {
      setState({ phase: "error", message: "Couldn't reach the server — please try again." });
    }
  }

  async function joinGate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGate({ phase: "saving" });
    const result = await saveMarketingContact({ email, source: "templates" });
    if (result.ok) {
      setGate({ phase: "done" });
    } else {
      setGate({ phase: "error", message: result.error });
    }
  }

  return (
    <div className="space-y-6">
      {/* Input card */}
      <div className="rounded-2xl bg-white shadow-sm border border-off-white p-5 sm:p-7 space-y-4">
        <label htmlFor="demo-inquiry" className="block font-semibold text-deep-teal">
          Paste an inquiry you&apos;ve received
        </label>
        <textarea
          id="demo-inquiry"
          value={inquiry}
          onChange={(e) => setInquiry(e.target.value)}
          maxLength={1200}
          rows={6}
          placeholder="Hi, we're getting married next June at ... are you available, and what do you charge?"
          className="w-full rounded-xl border border-off-white bg-background p-4 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-cyan"
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink/50">No inquiry handy? Try one:</span>
          {SAMPLES.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => {
                setInquiry(s.text);
                setState({ phase: "idle" });
              }}
              className="rounded-full bg-brand-cyan-soft text-deep-teal text-xs font-semibold px-3 py-1.5 hover:opacity-80 transition-opacity"
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={draft}
            disabled={state.phase === "drafting"}
            className={buttonStyles.primary}
          >
            {state.phase === "drafting" ? "Drafting your reply…" : "Draft my reply"}
          </button>
          <span className="text-xs text-ink/50">
            Free — 5 drafts a day, no signup. Drafted the way it would be for your business.
          </span>
        </div>
        {state.phase === "error" && (
          <p className="text-sm font-medium text-red-600">{state.message}</p>
        )}
      </div>

      {/* Result */}
      {state.phase === "done" && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-white shadow-sm border border-off-white overflow-hidden">
            <div className="bg-brand-cyan-soft px-5 sm:px-7 py-3 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-deep-teal">
                Your reply — drafted, ready to send
              </span>
              <span className="text-xs text-deep-teal/70">
                {state.remaining} free {state.remaining === 1 ? "draft" : "drafts"} left today
              </span>
            </div>
            <div className="p-5 sm:p-7 space-y-3">
              <p className="text-sm">
                <span className="font-semibold text-ink/50">Subject: </span>
                <span className="font-semibold text-deep-teal">{state.subject}</span>
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink/90">{state.body}</p>
            </div>
            <div className="border-t border-off-white px-5 sm:px-7 py-4 text-xs text-ink/50">
              In the real product this is drafted from <em>your</em> rate card, <em>your</em> calendar
              and <em>your</em> voice samples — and lands on your phone for a one-tap approve, usually
              within 5 minutes of the inquiry.
            </div>
          </div>

          {/* Email gate — the 25 templates */}
          <div className="rounded-2xl bg-soft-lavender/15 border border-soft-lavender/40 p-5 sm:p-7">
            {gate.phase === "done" ? (
              <div className="space-y-3">
                <h3 className="font-bold text-deep-teal text-lg">You&apos;re in — templates unlocked</h3>
                <p className="text-sm text-ink/70">
                  All 25 inquiry &amp; follow-up templates are yours. Steal them, tweak them, send them
                  tonight.
                </p>
                <Link
                  href="/tools/templates"
                  className="inline-block rounded-xl bg-brand-cyan text-white font-semibold px-4 py-2 hover:opacity-90 transition-opacity"
                >
                  Open the 25 templates
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="font-bold text-deep-teal text-lg">
                  Get our 25 proven inquiry &amp; follow-up templates
                </h3>
                <p className="text-sm text-ink/70">
                  First replies for every situation, day 2/5/9 follow-ups, rebooking and review asks —
                  short, human, and free. Drop your email and they&apos;re yours.
                </p>
                <form onSubmit={joinGate} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@yourdjbusiness.com"
                    aria-label="Your email address"
                    className="flex-1 rounded-xl border border-off-white bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-cyan"
                  />
                  <button
                    type="submit"
                    disabled={gate.phase === "saving"}
                    className={buttonStyles.primary}
                  >
                    {gate.phase === "saving" ? "Sending…" : "Send me the templates"}
                  </button>
                </form>
                {gate.phase === "error" && (
                  <p className="text-sm font-medium text-red-600">{gate.message}</p>
                )}
                <p className="text-xs text-ink/40">
                  No spam, no sequence-of-doom — just the templates and the occasional genuinely
                  useful thing.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
