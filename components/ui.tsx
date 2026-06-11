// Shared UI kit — brand-styled primitives for design language v2 "Neon Collage"
// (docs/DESIGN.md, THE LAW; canonical preview: app/(marketing)/design/b/page.tsx).
// Every dashboard screen composes these; screens never re-invent the patterns.
//
// Voice split (LAW): ceylon cyan = interface/clickable (app voice);
// magenta→orange = show/celebration (marketing voice). Pages sit on the ink
// canvas (bg-ink-stage); content lives on white/cream rounded-3xl panels.
import Image from "next/image";
import type { ReactNode } from "react";
import type { LeadStatus } from "@/app/generated/prisma/enums";
import { HaloRing, RingsBackdrop, VinylDisc } from "@/components/collage";

/** White data card floating on the ink canvas. Never tilted (app rule). */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-3xl bg-white border border-cream/10 shadow-[0_16px_40px_rgba(0,0,0,0.35)] ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Badge — tone KEYS are frozen (callers depend on them); fills remapped to v2.
 * All fills are opaque so a badge reads on ink AND on white/cream panels.
 * Checked text pairings:
 *   cyan     → cyan-soft #b6eaff fill, ink text (~12:1) — interface voice
 *   teal     → solid magenta #ff2dae, white bold text — the show/celebration chip
 *   lavender → magenta-soft #ffd6ec fill, deep magenta #9c0f63 text (~7:1)
 *   peach    → orange-soft #ffdfba fill, deep amber #7a4100 text (~7:1)
 *   gray     → cream fill, ink/70 text — the muted "gone quiet" chip
 */
export function Badge({
  children,
  tone = "cyan",
}: {
  children: ReactNode;
  tone?: "cyan" | "teal" | "lavender" | "peach" | "gray";
}) {
  const tones: Record<string, string> = {
    cyan: "bg-brand-cyan-soft text-ink-stage",
    teal: "bg-neon-magenta text-white",
    lavender: "bg-[#ffd6ec] text-[#9c0f63]",
    peach: "bg-[#ffdfba] text-[#7a4100]",
    gray: "bg-cream text-ink-stage/70",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${tones[tone]}`}>
      {children}
    </span>
  );
}

/**
 * Button recipes — all pill-shaped (rounded-full) in v2.
 *   primary          → solid CYAN pill, ink text (app voice — the daily click;
 *                      ink-on-cyan ~7.5:1, white-on-cyan fails contrast)
 *   show             → solid MAGENTA pill, white text + glow (marketing voice:
 *                      "Start free" and friends — never for app actions)
 *   secondary        → cream-outline ghost pill for the ink canvas
 *   secondaryOnLight → ink-outline ghost pill for use INSIDE white/cream cards
 *                      (cream outline is invisible on white — use this there)
 *   danger           → quiet red outline, unchanged shape-wise except pill
 */
export const buttonStyles = {
  primary:
    "rounded-full bg-brand-cyan text-ink-stage font-bold px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-40",
  show:
    "rounded-full bg-neon-magenta text-white font-bold px-5 py-2.5 shadow-[0_8px_28px_rgba(255,45,174,0.35)] hover:opacity-90 transition-opacity disabled:opacity-40",
  secondary:
    "rounded-full border-[1.5px] border-cream/40 text-cream font-semibold px-4 py-2 hover:border-cream/75 hover:text-cream-bright transition-colors disabled:opacity-40",
  secondaryOnLight:
    "rounded-full border-[1.5px] border-ink-stage/30 text-ink-stage/80 font-semibold px-4 py-2 hover:border-ink-stage/60 hover:text-ink-stage transition-colors disabled:opacity-40",
  danger:
    "rounded-full border border-red-300 text-red-600 font-semibold px-4 py-2 hover:bg-red-50 transition-colors disabled:opacity-40",
};

/**
 * The only sanctioned logo rendering — ink-raised tile with a cyan wordmark
 * dot, sized variants. The logo SVG is white + cyan, so it reads cleanly on
 * the ink-raised tile (white-on-#201f2b).
 */
export function BrightEarsLogo({ size = 28 }: { size?: 20 | 28 | 32 | 44 | 56 }) {
  const radius = size >= 44 ? "rounded-xl" : size >= 28 ? "rounded-lg" : "rounded";
  const pad = size >= 44 ? "p-1.5" : size >= 28 ? "p-1" : "p-0.5";
  const dot = size >= 44 ? "h-2.5 w-2.5" : "h-1.5 w-1.5";
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <Image
        src="/brand/logo.svg"
        alt="Bright Ears"
        width={size}
        height={size}
        className={`bg-ink-raised ring-1 ring-cream/15 ${radius} ${pad}`}
      />
      <span
        aria-hidden
        className={`absolute -bottom-0.5 -right-0.5 rounded-full bg-brand-cyan ring-2 ring-ink-stage ${dot}`}
      />
    </span>
  );
}

/**
 * Ink-raised header band every dashboard page opens with (docs/DESIGN.md).
 * Warm-white title on ink; pass `accent` to gradient-paint ONE word/substring
 * of a string title (the v2 signature). `rings` adds the faint concentric
 * rings backdrop — at most one ring pattern per page (LAW).
 */
export function PageHeader({
  title,
  subtitle,
  action,
  stats,
  accent,
  rings = false,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  stats?: ReactNode;
  accent?: string;
  rings?: boolean;
}) {
  let heading: ReactNode = title;
  if (accent && typeof title === "string") {
    const at = title.indexOf(accent);
    if (at !== -1) {
      heading = (
        <>
          {title.slice(0, at)}
          <span className="bg-gradient-to-r from-neon-magenta to-neon-orange bg-clip-text text-transparent">
            {accent}
          </span>
          {title.slice(at + accent.length)}
        </>
      );
    }
  }
  return (
    <header className="relative overflow-hidden rounded-3xl bg-ink-raised border border-cream/10 px-6 py-6 mb-8">
      {rings && <RingsBackdrop />}
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-cream-bright">{heading}</h1>
          {subtitle && <p className="text-sm text-cream/55 mt-1">{subtitle}</p>}
          {stats && <div className="flex flex-wrap gap-2 mt-3">{stats}</div>}
        </div>
        {action && <div>{action}</div>}
      </div>
    </header>
  );
}

/**
 * Small stat chip for PageHeader metrics — mono sticker-chip styling.
 * tone="teal" → solid cyan chip (ink text, the interface accent);
 * default → cream chip (ink text). Both opaque: read on ink and on white.
 */
export function StatPill({ children, tone = "white" }: { children: ReactNode; tone?: "white" | "teal" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em] ${
        tone === "teal" ? "bg-brand-cyan text-ink-stage" : "bg-cream text-ink-stage"
      }`}
    >
      {children}
    </span>
  );
}

/**
 * Friendly empty state — never render a bare dash (docs/DESIGN.md).
 * v2: a cream poster mini-panel with a small collage piece (halo behind the
 * copy; a dark vinyl bleeding off the corner on the full-size variant).
 */
export function EmptyState({
  emoji,
  title,
  hint,
  cta,
  compact = false,
}: {
  emoji: string;
  title: string;
  hint?: string;
  cta?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-cream text-center ${
        compact ? "px-3 py-5" : "px-6 py-12"
      }`}
    >
      <HaloRing
        width={compact ? 110 : 190}
        height={compact ? 40 : 70}
        tilt={-12}
        className={compact ? "left-1/2 top-3 -ml-14" : "left-1/2 top-8 -ml-24"}
      />
      {!compact && <VinylDisc size={88} tone="dark" className="-bottom-10 -right-10" />}
      <div className="relative">
        <div className={compact ? "text-2xl mb-1" : "text-4xl mb-2"} aria-hidden>
          {emoji}
        </div>
        <p className={`font-semibold text-ink-stage/80 ${compact ? "text-xs" : "text-sm"}`}>
          {title}
        </p>
        {hint && (
          <p className={`text-ink-stage/55 mt-1 ${compact ? "text-[11px]" : "text-xs"}`}>{hint}</p>
        )}
        {cta && <div className="mt-3">{cta}</div>}
      </div>
    </div>
  );
}

/**
 * Single source of truth for lead-status labels + colors (pipeline columns,
 * badges, detail pages). v2 accents per docs/DESIGN.md status restaging.
 *
 * READABLE TEXT PAIRED WITH EACH ACCENT (consumers painting text over an
 * accent fill MUST use these — soft tints need dark text):
 *   bg-brand-cyan                                  → text-ink-stage  (~7.5:1)
 *   bg-brand-cyan-soft                             → text-ink-stage  (~12:1)
 *   bg-[#ffd6ec]  (magenta-soft)                   → text-ink-stage or text-[#9c0f63]
 *   bg-[#ffdfba]  (orange-soft)                    → text-ink-stage or text-[#7a4100]
 *   bg-gradient-to-r from-neon-magenta
 *     to-neon-orange  (BOOKED celebration)         → text-ink-stage  (white fails on the orange end)
 *   bg-cream/40   (muted, on white panels)         → text-ink-stage/70
 */
export const LEAD_STATUS_META: Record<
  LeadStatus,
  { label: string; accent: string; badgeTone: "cyan" | "teal" | "lavender" | "peach" | "gray" }
> = {
  NEW: { label: "New", accent: "bg-brand-cyan", badgeTone: "cyan" },
  SPAM: { label: "Spam", accent: "bg-cream/40", badgeTone: "gray" },
  DRAFTED: { label: "Reply ready", accent: "bg-[#ffd6ec]", badgeTone: "lavender" },
  REPLIED: { label: "Replied", accent: "bg-brand-cyan-soft", badgeTone: "cyan" },
  IN_SEQUENCE: { label: "Following up", accent: "bg-[#ffdfba]", badgeTone: "peach" },
  ENGAGED: { label: "Talking", accent: "bg-[#ffd6ec]", badgeTone: "lavender" },
  BOOKED: {
    label: "Booked 🎉",
    accent: "bg-gradient-to-r from-neon-magenta to-neon-orange",
    badgeTone: "teal",
  },
  DEAD: { label: "Gone quiet", accent: "bg-cream/40", badgeTone: "gray" },
};
