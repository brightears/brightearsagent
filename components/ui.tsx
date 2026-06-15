// Shared UI kit — brand-styled primitives for design language v2 "Neon Collage"
// (docs/DESIGN.md, THE LAW; canonical preview: app/(marketing)/design/b/page.tsx).
// Every dashboard screen composes these; screens never re-invent the patterns.
//
// Voice split (LAW): ceylon cyan = interface/clickable (app voice);
// magenta→orange = show/celebration (marketing voice). Pages sit on the ink
// canvas (bg-ink-stage); content lives on white/cream rounded-3xl panels.
import Image from "next/image";
import type { ReactNode } from "react";
import type { LeadStatus, VenueStatus } from "@/app/generated/prisma/enums";
import { RingsBackdrop, VinylDisc } from "@/components/collage";

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
 * The only sanctioned logo rendering — the REAL Bright Ears mark: white "BE"
 * monogram in the cyan ring on a transparent ground (public/brand/logo.png,
 * the dark-UI version). No constructed tile or dot — the ring is part of the
 * mark, and stacking another tile/dot is what made the old hand-drawn SVG
 * read as a knock-off. (logo-light.png is the dark-on-white version for
 * light/SEO surfaces.)
 */
export function BrightEarsLogo({ size = 28 }: { size?: 20 | 28 | 32 | 44 | 56 }) {
  return (
    <Image
      src="/brand/logo.png"
      alt="Bright Ears"
      width={size}
      height={size}
      className="shrink-0"
    />
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
  const heading: ReactNode = typeof title === "string" ? paintAccent(title, accent) : title;
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
 * Editorial section kicker (docs/DESIGN.md v2.1 rule 2) — the section-title
 * system everywhere: mono ALL-CAPS tracked label with a 4px cyan square
 * prefix. Default styling sits on the ink canvas (cream/50); pass `onLight`
 * inside white/cream panels (ink/50). Renders an inline span — wrap in
 * <h2>/<h3> when the label is a real heading.
 */
export function Kicker({
  children,
  onLight = false,
}: {
  children: ReactNode;
  onLight?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.25em] ${
        onLight ? "text-ink-stage/50" : "text-cream/65"
      }`}
    >
      <span aria-hidden className="size-1 flex-none bg-brand-cyan" />
      {children}
    </span>
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

/** Gradient-paints one substring of a title (the v2 signature). */
function paintAccent(title: string, accent?: string): ReactNode {
  if (!accent) return title;
  const at = title.indexOf(accent);
  if (at === -1) return title;
  return (
    <>
      {title.slice(0, at)}
      <span className="bg-gradient-to-r from-neon-magenta to-neon-orange bg-clip-text text-transparent">
        {accent}
      </span>
      {title.slice(at + accent.length)}
    </>
  );
}

/**
 * Friendly empty state — never render a bare dash (docs/DESIGN.md).
 * v2.1 "Edge": typography does the work — no icons, no halo (founder-killed).
 * Full size = left-aligned cream poster, statement title in display black
 * with an optional gradient-painted substring (`accent`), optional mono
 * `kicker` above, dark vinyl bleeding off the corner.
 * Compact (pipeline columns, in-card strips) = a single mono ALL-CAPS
 * tracked line — sticker-speak, no ornament.
 */
export function EmptyState({
  kicker,
  title,
  accent,
  hint,
  cta,
  compact = false,
}: {
  /** Mono ALL-CAPS line above the title (full size only). */
  kicker?: string;
  title: string;
  /** Substring of `title` to paint with the show gradient. */
  accent?: string;
  hint?: string;
  cta?: ReactNode;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="rounded-xl bg-cream px-4 py-4">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-ink-stage/50">
          {title}
        </p>
        {hint && <p className="mt-1 text-[11px] text-ink-stage/55 normal-case">{hint}</p>}
        {cta && <div className="mt-2.5">{cta}</div>}
      </div>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-2xl bg-cream px-6 py-10 sm:px-8 text-left">
      <VinylDisc size={96} tone="dark" className="-bottom-11 -right-11" />
      <div className="relative">
        {kicker && (
          <div className="mb-2">
            <Kicker onLight>{kicker}</Kicker>
          </div>
        )}
        <p className="text-2xl sm:text-3xl font-black tracking-tight text-ink-stage leading-[1.05]">
          {paintAccent(title, accent)}
        </p>
        {hint && <p className="mt-2 max-w-md text-sm text-ink-stage/55">{hint}</p>}
        {cta && <div className="mt-5">{cta}</div>}
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
    // No emoji (v2.1 LAW) — the gradient accent IS the celebration.
    label: "Booked",
    accent: "bg-gradient-to-r from-neon-magenta to-neon-orange",
    badgeTone: "teal",
  },
  DEAD: { label: "Gone quiet", accent: "bg-cream/40", badgeTone: "gray" },
};

/**
 * Single source of truth for venue-prospect statuses (the Hunt feed, ADR-004 /
 * Phase 10.4) — same conventions and TEXT-PAIRING RULES as LEAD_STATUS_META
 * above (soft tints need dark text; the gradient celebrates BOOKED).
 */
export const VENUE_STATUS_META: Record<
  VenueStatus,
  { label: string; accent: string; badgeTone: "cyan" | "teal" | "lavender" | "peach" | "gray" }
> = {
  DISCOVERED: { label: "Found", accent: "bg-brand-cyan-soft", badgeTone: "cyan" },
  QUALIFIED: { label: "Worth a look", accent: "bg-brand-cyan", badgeTone: "cyan" },
  PITCH_DRAFTED: { label: "Pitch queued", accent: "bg-[#ffd6ec]", badgeTone: "lavender" },
  PITCHED: { label: "Pitched", accent: "bg-[#ffdfba]", badgeTone: "peach" },
  REPLIED: { label: "Talking", accent: "bg-[#ffd6ec]", badgeTone: "lavender" },
  IN_CONVERSATION: { label: "Talking", accent: "bg-[#ffd6ec]", badgeTone: "lavender" },
  BOOKED: {
    // No emoji (v2.1 LAW) — the gradient accent IS the celebration.
    label: "Booked",
    accent: "bg-gradient-to-r from-neon-magenta to-neon-orange",
    badgeTone: "teal",
  },
  DEAD: { label: "Gone quiet", accent: "bg-cream/40", badgeTone: "gray" },
  SUPPRESSED: { label: "Skipped", accent: "bg-cream/40", badgeTone: "gray" },
};
