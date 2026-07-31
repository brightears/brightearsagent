"use client";

import type { PointerEvent } from "react";
import { BrightEarsLogo } from "@/components/ui";

const SIGNALS = [
  {
    label: "New room",
    detail: "Opening soon",
    position: "be-signal-node--one",
    match: true,
  },
  {
    label: "Live-music night",
    detail: "Books your style",
    position: "be-signal-node--two",
    match: true,
  },
  {
    label: "Guest slot",
    detail: "Right city",
    position: "be-signal-node--three",
    match: true,
  },
  {
    label: "Private event",
    detail: "No public contact",
    position: "be-signal-node--four",
    match: false,
  },
  {
    label: "Too far",
    detail: "Outside your cities",
    position: "be-signal-node--five",
    match: false,
  },
  {
    label: "Wrong fee",
    detail: "Below your floor",
    position: "be-signal-node--six",
    match: false,
  },
];

/**
 * The homepage's one deliberately spectacular moment.
 *
 * It behaves like a small installation: venue signals orbit an artist profile,
 * resolve into the three that fit, then become an approval-ready pitch. Pointer
 * movement adds depth but communicates no extra information, so touch, keyboard
 * and reduced-motion visitors get the same product story.
 */
export function BookingSignalStage() {
  function moveStage(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    event.currentTarget.style.setProperty("--stage-x", `${x * 14}px`);
    event.currentTarget.style.setProperty("--stage-y", `${y * 10}px`);
  }

  function resetStage(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.style.setProperty("--stage-x", "0px");
    event.currentTarget.style.setProperty("--stage-y", "0px");
  }

  return (
    <div
      className="be-signal-stage relative mx-auto min-h-[470px] w-full max-w-[600px] overflow-hidden rounded-[2rem] border border-cream/10 bg-ink-raised shadow-[0_36px_110px_rgba(0,0,0,0.52)] sm:min-h-[540px]"
      onPointerMove={moveStage}
      onPointerLeave={resetStage}
      role="img"
      aria-label="Venue signals are scanned against an artist profile. Three good matches are selected and turned into a pitch ready for approval."
    >
      <div aria-hidden className="be-signal-aurora" />
      <div aria-hidden className="be-signal-grid" />
      <div aria-hidden className="be-signal-sweep" />

      <div aria-hidden className="absolute left-5 top-5 z-30 flex items-center gap-2">
        <span className="be-live-dot size-2 rounded-full bg-brand-cyan" />
        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-cream/65">
          <span className="hidden sm:inline">Booking </span>signals live
        </span>
      </div>
      <div
        aria-hidden
        className="absolute right-5 top-5 z-30 rounded-full border border-cream/10 bg-ink-stage/70 px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-cream/55 backdrop-blur"
      >
        <span className="sm:hidden">18 → 3 fit</span>
        <span className="hidden sm:inline">18 checked · 3 fit</span>
      </div>

      <div aria-hidden className="be-signal-field absolute inset-0">
        <svg
          viewBox="0 0 600 600"
          className="absolute inset-0 size-full"
          preserveAspectRatio="none"
        >
          <path className="be-signal-path be-signal-path--match" d="M300 292 L105 110" />
          <path className="be-signal-path be-signal-path--match" d="M300 292 L495 125" />
          <path className="be-signal-path be-signal-path--match" d="M300 292 L555 300" />
          <path className="be-signal-path be-signal-path--miss" d="M300 292 L485 500" />
          <path className="be-signal-path be-signal-path--miss" d="M300 292 L100 505" />
          <path className="be-signal-path be-signal-path--miss" d="M300 292 L45 300" />
        </svg>

        <div className="be-profile-orbit absolute left-1/2 top-[47%] z-20 -translate-x-1/2 -translate-y-1/2">
          <span className="be-profile-ring be-profile-ring--outer" />
          <span className="be-profile-ring be-profile-ring--inner" />
          <div className="relative flex size-32 flex-col items-center justify-center rounded-full border border-cream/20 bg-ink-stage shadow-[0_0_60px_rgba(0,187,228,0.2)] sm:size-40">
            <BrightEarsLogo size={44} />
            <p className="mt-2 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-brand-cyan">
              Your profile
            </p>
            <p className="mt-1 text-center text-[10px] leading-tight text-cream/45">
              Style · city · fee
            </p>
          </div>
        </div>

        {SIGNALS.map((signal) => (
          <div
            key={signal.label}
            className={`be-signal-node ${signal.position} ${
              signal.match ? "be-signal-node--match" : "be-signal-node--miss"
            }`}
          >
            <span className="be-signal-node-dot" />
            <span>
              <span className="block text-xs font-extrabold text-cream-bright sm:text-sm">
                {signal.label}
              </span>
              <span className="mt-0.5 hidden font-mono text-[8px] uppercase tracking-[0.12em] text-cream/40 sm:block">
                {signal.detail}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div
        aria-hidden
        className="be-pitch-ticket absolute bottom-4 left-4 right-4 z-40 rounded-2xl bg-cream p-4 text-ink-stage shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:bottom-5"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-9 flex-none items-center justify-center rounded-full bg-neon-magenta font-mono text-xs font-black text-white">
            01
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[8px] font-bold uppercase tracking-[0.18em] text-ink-stage/40">
              Best match · pitch ready
            </p>
            <p className="truncate text-sm font-black">Rooftop opening · your city</p>
          </div>
          <span className="rounded-full bg-brand-cyan px-3 py-1.5 text-[10px] font-black">
            Review
          </span>
        </div>
        <p className="mt-3 border-t border-ink-stage/10 pt-3 text-xs leading-relaxed text-ink-stage/60">
          Fit explained. Contact found. Written in your voice. Nothing sends without your say-so.
        </p>
      </div>
    </div>
  );
}
