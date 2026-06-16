"use client";

import { useState } from "react";
import Link from "next/link";
import { saveMarketingContact } from "@/app/actions/marketing";
import { buttonStyles } from "@/components/ui";
import { GradientBlob, StickerChip, VinylDisc } from "@/components/collage";

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
    text: "Hello — I'm organizing our company holiday party on December 12, roughly 80 people at a downtown hotel. We'd need a band from 7 to 11pm with a sound system and some uplighting. Could you send pricing and availability?",
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
    <div className="space-y-8">
      {/* Input poster — cream panel on the ink stage */}
      <div className="relative">
        <GradientBlob tone="show" className="-bottom-8 -left-6 h-40 w-64" />
        <div className="relative overflow-hidden rounded-3xl bg-cream p-5 sm:p-7 shadow-[0_24px_60px_rgba(0,0,0,0.45)] space-y-4">
          <div>
            <StickerChip tone="ink" rotate={-2}>
              Free tool — 5 drafts a day
            </StickerChip>
          </div>
          <label
            htmlFor="demo-inquiry"
            className="block font-extrabold tracking-tight text-ink-stage"
          >
            Paste an inquiry you&apos;ve received
          </label>
          <textarea
            id="demo-inquiry"
            value={inquiry}
            onChange={(e) => setInquiry(e.target.value)}
            maxLength={1200}
            rows={6}
            placeholder="Hi, we're getting married next June at ... are you available, and what do you charge?"
            className="w-full rounded-xl border border-ink-stage/15 bg-cream-bright p-4 text-sm leading-relaxed text-ink-stage placeholder:text-ink-stage/40 focus:outline-none focus:ring-2 focus:ring-brand-cyan"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-stage/55">No inquiry handy? Try one:</span>
            {SAMPLES.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => {
                  setInquiry(s.text);
                  setState({ phase: "idle" });
                }}
                className="rounded-full bg-brand-cyan-soft text-ink-stage text-xs font-semibold px-3 py-1.5 hover:opacity-80 transition-opacity"
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
            <span className="text-xs text-ink-stage/55">
              Free — 5 drafts a day, no signup. Drafted the way it would be for your business.
            </span>
          </div>
          {state.phase === "error" && (
            <p className="text-sm font-medium text-red-600">{state.message}</p>
          )}
        </div>
      </div>

      {/* Result */}
      {state.phase === "done" && (
        <div className="space-y-8">
          {/* "NOW PLAYING" poster — the drafted reply */}
          <div className="relative">
            <GradientBlob tone="show" className="-bottom-8 -right-6 h-40 w-64" />
            <div className="relative overflow-hidden rounded-3xl bg-cream shadow-[0_24px_60px_rgba(0,0,0,0.45)] rotate-[0.4deg]">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-7 pt-5">
                <StickerChip tone="outline">Now playing — your reply</StickerChip>
                <StickerChip tone="magenta" rotate={3}>
                  {state.remaining} free {state.remaining === 1 ? "draft" : "drafts"} left today
                </StickerChip>
              </div>
              <div className="px-5 sm:px-7 pt-5 pb-2">
                <p className="font-extrabold tracking-tight text-ink-stage">
                  Your reply — drafted, ready to send
                </p>
              </div>
              <div className="px-5 sm:px-7 pb-5 space-y-3">
                <p className="text-sm">
                  <span className="font-semibold text-ink-stage/50">Subject: </span>
                  <span className="font-semibold text-ink-stage">{state.subject}</span>
                </p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink-stage/85">
                  {state.body}
                </p>
              </div>
              <div className="border-t border-ink-stage/10 px-5 sm:px-7 py-4 text-xs text-ink-stage/55">
                In the real product this is drafted from <em>your</em> rate card, <em>your</em>{" "}
                calendar and <em>your</em> voice samples — and lands on your phone for a one-tap
                approve, usually within 5 minutes of the inquiry.
              </div>
            </div>
          </div>

          {/* What's next — the reply is only half the product; point at the Hunt. */}
          <div className="relative overflow-hidden rounded-3xl border border-cream/15 bg-ink-raised p-5 sm:p-6">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-brand-cyan">
              That&apos;s the reply half
            </p>
            <p className="mt-2 text-sm leading-relaxed text-cream/75">
              This drafted a reply to a lead that already found you. Bright Ears also does the harder
              half: it goes out and <span className="font-semibold text-cream-bright">finds you new
              venues</span> — scanning the web for rooms that fit you and drafting the outreach in
              your voice, so you stop missing the gigs you never even hear about.
            </p>
          </div>

          {/* Email gate — the 29 templates */}
          <div className="relative">
            <div className="relative overflow-hidden rounded-3xl bg-cream p-5 sm:p-7 shadow-[0_24px_60px_rgba(0,0,0,0.45)] rotate-[-0.4deg]">
              <VinylDisc size={110} tone="dark" className="-bottom-10 -right-8" />
              {gate.phase === "done" ? (
                <div className="relative space-y-3">
                  <div>
                    <StickerChip tone="magenta" rotate={-3}>
                      Unlocked &#10003;
                    </StickerChip>
                  </div>
                  <h3 className="font-extrabold tracking-tight text-ink-stage text-lg">
                    You&apos;re in — templates unlocked
                  </h3>
                  <p className="text-sm text-ink-stage/65">
                    All 29 venue-outreach, inquiry &amp; follow-up templates are yours. Steal them,
                    tweak them, send them tonight.
                  </p>
                  <Link href="/tools/templates" className={`inline-block ${buttonStyles.primary}`}>
                    Open the 29 templates
                  </Link>
                </div>
              ) : (
                <div className="relative space-y-3">
                  <div>
                    <StickerChip tone="ink" rotate={-3}>
                      Free — 29 templates
                    </StickerChip>
                  </div>
                  <h3 className="font-extrabold tracking-tight text-ink-stage text-lg">
                    Get our 29 ready-to-send venue, inquiry &amp; follow-up templates
                  </h3>
                  <p className="text-sm text-ink-stage/65">
                    Venue outreach that finds new gigs, first replies for every situation, day 2/5/9
                    follow-ups, rebooking and review asks — short, human, and free. Drop your email
                    and they&apos;re yours.
                  </p>
                  <form onSubmit={joinGate} className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@yourbusiness.com"
                      aria-label="Your email address"
                      className="flex-1 rounded-full border border-ink-stage/15 bg-cream-bright px-4 py-2 text-sm text-ink-stage placeholder:text-ink-stage/40 focus:outline-none focus:ring-2 focus:ring-brand-cyan"
                    />
                    <button
                      type="submit"
                      disabled={gate.phase === "saving"}
                      className={buttonStyles.show}
                    >
                      {gate.phase === "saving" ? "Sending…" : "Send me the templates"}
                    </button>
                  </form>
                  {gate.phase === "error" && (
                    <p className="text-sm font-medium text-red-600">{gate.message}</p>
                  )}
                  <p className="text-xs text-ink-stage/45">
                    No spam, no sequence-of-doom — just the templates and the occasional genuinely
                    useful thing.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
