"use client";

// Motion kit — design language v2.1 "Edge" (docs/DESIGN.md, THE LAW).
// Reference: mustardmusic.com — kinetic editorial type, scroll choreography.
// Three primitives, all CSS-driven (keyframes live in app/globals.css):
//
//   KineticHeadline — headline words rise + fade in, staggered (~110ms),
//     out of overflow-hidden word wrappers. Pure CSS animation present from
//     first paint, so it runs with or without JS (SSR-safe: words are hidden
//     only by `animation-fill-mode: both` until their animation fires).
//     prefers-reduced-motion disables the keyframe — words simply show.
//
//   RevealOnScroll — sections rise 24px + fade as they enter the viewport
//     (IntersectionObserver, once, threshold 0.15). Server markup is VISIBLE;
//     the hidden class is applied client-side only, right before observing,
//     so content can never be lost if JS fails. Reduced motion: never hidden.
//
//   Marquee — full-bleed mono ALL-CAPS ticker with gradient vinyl-dot
//     separators, slow linear loop (~40s), pauses on hover. Reduced motion:
//     static row.

import { Fragment, useEffect, useRef, type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* KineticHeadline                                                     */
/* ------------------------------------------------------------------ */

/** ONE word painted magenta→orange — the v2 signature (docs/DESIGN.md). */
const ACCENT_CLASS =
  "bg-gradient-to-r from-neon-magenta to-neon-orange bg-clip-text text-transparent";

/** Strip leading/trailing punctuation so accentWord="5th" matches "5th," too. */
function coreOf(word: string): string {
  return word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

export function KineticHeadline({
  children,
  lines,
  accentWord,
  staggerMs = 110,
  className = "",
}: {
  /** The headline as a single string (alternative to `lines`). */
  children?: string;
  /** Explicit line breaks — each entry renders as its own block line. */
  lines?: string[];
  /** Paints the first matching word with the magenta→orange show gradient. */
  accentWord?: string;
  /** Per-word stagger in milliseconds. */
  staggerMs?: number;
  className?: string;
}) {
  const lineList = lines ?? (typeof children === "string" ? [children] : []);
  const wordLines = lineList.map((line) => line.split(/\s+/).filter(Boolean));
  // Global word offset per line so the rise/fade stagger stays continuous
  // across line breaks. Computed without render-time mutation (see eslint
  // react-hooks/immutability) — headlines are a handful of words, O(n²) is fine.
  const lineOffsets = wordLines.map((_, li) =>
    wordLines.slice(0, li).reduce((sum, words) => sum + words.length, 0),
  );
  // First word (in reading order) matching accentWord gets the show gradient.
  const accentGlobalIndex =
    accentWord === undefined
      ? -1
      : (wordLines
          .flatMap((words, li) => words.map((word, wi) => ({ word, gi: lineOffsets[li] + wi })))
          .find(({ word }) => word === accentWord || coreOf(word) === accentWord)?.gi ?? -1);
  return (
    <span className={className}>
      {wordLines.map((words, li) => (
        <span key={li} className="block">
          {words.map((word, wi) => {
            const globalIndex = lineOffsets[li] + wi;
            const delay = globalIndex * staggerMs;
            const isAccent = globalIndex === accentGlobalIndex;
            return (
              <Fragment key={wi}>
                {/* clip wrapper: slight bottom padding keeps descenders un-cropped */}
                <span className="-mb-[0.12em] inline-block overflow-hidden pb-[0.12em] align-bottom">
                  <span
                    className={`be-kinetic-word${isAccent ? ` ${ACCENT_CLASS}` : ""}`}
                    style={{ animationDelay: `${delay}ms` }}
                  >
                    {word}
                  </span>
                </span>{" "}
              </Fragment>
            );
          })}
        </span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* RevealOnScroll                                                      */
/* ------------------------------------------------------------------ */

export function RevealOnScroll({
  children,
  className = "",
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  /** Optional transition-delay (ms) for stagger between sibling reveals. */
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // No-JS / reduced-motion / ancient browsers: stay visible, never hide.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    el.classList.add("be-reveal-hidden");
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.remove("be-reveal-hidden");
            io.disconnect();
          }
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      el.classList.remove("be-reveal-hidden");
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`be-reveal ${className}`}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Marquee                                                             */
/* ------------------------------------------------------------------ */

/** The collage glyph between phrases: an 8px magenta→orange vinyl dot. */
function VinylDot() {
  return (
    <span
      aria-hidden
      className="h-2 w-2 shrink-0 rounded-full bg-gradient-to-r from-neon-magenta to-neon-orange"
    />
  );
}

export function Marquee({ items, className = "" }: { items: string[]; className?: string }) {
  // Each row is one full repeating unit (item · dot · …) incl. trailing gap,
  // so translateX(-50%) on the doubled track loops seamlessly.
  const row = (hidden: boolean) => (
    <div
      aria-hidden={hidden || undefined}
      className="flex shrink-0 items-center gap-8 pr-8"
    >
      {items.map((item, i) => (
        <Fragment key={i}>
          <span className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-cream/70">
            {item}
          </span>
          <VinylDot />
        </Fragment>
      ))}
    </div>
  );
  return (
    <div className={`be-marquee overflow-hidden whitespace-nowrap ${className}`}>
      <div className="be-marquee-track flex w-max items-center">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
