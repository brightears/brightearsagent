// Neon Collage primitives — design language v2 (docs/DESIGN.md, THE LAW).
// Pure CSS/SVG pieces extracted from the founder-picked preview at
// app/(marketing)/design/b/page.tsx. Build once, reuse everywhere.
//
// Server-component friendly: no hooks, no event handlers, no client APIs.
// Every piece is decorative (aria-hidden) and absolutely positioned so it can
// be collaged onto a `relative overflow-hidden` cream/white panel.
//
// Palette (tokens in app/globals.css):
//   ink stage #17161f · ink raised #201f2b · cream #e8e4dc · cream-bright #f5f2ec
//   neon magenta #ff2dae · neon orange #ff8a00 · brand cyan #00bbe4
import type { CSSProperties, ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* VinylDisc — radial-gradient grooves, magenta center label, cream    */
/* spindle hole. tone="orange" is the signature hero vinyl.            */
/* ------------------------------------------------------------------ */

const VINYL_SPIN_CSS =
  "@keyframes be-vinyl-spin{to{transform:rotate(360deg)}}.be-vinyl-spin{animation:be-vinyl-spin 36s linear infinite}";

export function VinylDisc({
  size,
  tone = "orange",
  spin = false,
  className = "",
}: {
  size: number;
  tone?: "dark" | "orange";
  spin?: boolean;
  className?: string;
}) {
  const label = Math.round(size * 0.36);
  const hole = Math.max(6, Math.round(size * 0.06));
  const grooves =
    tone === "orange"
      ? "repeating-radial-gradient(circle, #df6d00 0 1.5px, #ff8a00 1.5px 3.5px)"
      : "repeating-radial-gradient(circle, #211e29 0 1.5px, #2f2c3a 1.5px 3.5px)";
  return (
    <div aria-hidden className={`absolute ${className}`} style={{ width: size, height: size }}>
      {spin && <style>{VINYL_SPIN_CSS}</style>}
      <div
        className={`absolute inset-0 rounded-full ${spin ? "be-vinyl-spin" : ""}`}
        style={{
          background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 44%), ${grooves}`,
          boxShadow: "0 16px 36px rgba(23,22,31,0.35), inset 0 0 0 1px rgba(23,22,31,0.25)",
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: label,
          height: label,
          background: "#ff2dae",
          boxShadow: "inset 0 0 0 2.5px rgba(23,22,31,0.3)",
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cream"
        style={{ width: hole, height: hole }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* StudioSpeaker — ink cabinet, cream-ringed tweeter + woofer, tiny    */
/* orange power LED. `size` is the cabinet width; height is 1.6×.      */
/* ------------------------------------------------------------------ */

export function StudioSpeaker({ size, className = "" }: { size: number; className?: string }) {
  const height = Math.round(size * 1.6);
  const tweeter = Math.round(size * 0.34);
  const woofer = Math.round(size * 0.7);
  return (
    <div
      aria-hidden
      className={`absolute rounded-2xl ${className}`}
      style={{
        width: size,
        height,
        background: "linear-gradient(160deg, #2c2935 0%, #1a1922 100%)",
        boxShadow: "0 18px 36px rgba(23,22,31,0.35), inset 0 0 0 1.5px rgba(232,228,220,0.14)",
      }}
    >
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-full"
        style={{
          top: Math.round(height * 0.1),
          width: tweeter,
          height: tweeter,
          border: "3px solid rgba(232,228,220,0.55)",
          background: "radial-gradient(circle at 45% 38%, #514b60 0%, #211e29 70%)",
        }}
      />
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-full"
        style={{
          bottom: Math.round(height * 0.07),
          width: woofer,
          height: woofer,
          border: "3px solid rgba(232,228,220,0.4)",
          background: "radial-gradient(circle at 50% 42%, #5b5570 0%, #17161f 68%)",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{ top: 10, right: 10, width: 6, height: 6, background: "#ff8a00" }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* HaloRing — the tilted white ellipse outline that floats behind      */
/* collage pieces on cream panels.                                     */
/* ------------------------------------------------------------------ */

export function HaloRing({
  width = 180,
  height = 66,
  tilt = -12,
  className = "",
}: {
  width?: number;
  height?: number;
  tilt?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`absolute rounded-[50%] ${className}`}
      style={{
        width,
        height,
        transform: `rotate(${tilt}deg)`,
        border: "7px solid #fffcf4",
        boxShadow: "0 12px 26px rgba(23,22,31,0.18), inset 0 4px 12px rgba(23,22,31,0.08)",
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* GradientBlob — soft blurred glow placed UNDER a poster panel.       */
/* tone="show" (magenta→orange, the default celebration glow) or      */
/* tone="cyan" (the quiet product-voice glow for app moments).        */
/* Size/position via className (e.g. "-bottom-10 -right-8 h-56 w-72"). */
/* ------------------------------------------------------------------ */

const BLOB_TONES: Record<"show" | "cyan", string> = {
  show: "linear-gradient(120deg, #ff2dae 15%, #ff8a00 85%)",
  cyan: "linear-gradient(120deg, #00bbe4 15%, #b6eaff 85%)",
};

export function GradientBlob({
  tone = "show",
  className = "",
}: {
  tone?: "show" | "cyan";
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`absolute rounded-full blur-2xl ${className}`}
      style={{ background: BLOB_TONES[tone], opacity: 0.5 }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* StickerChip — small rotated mono-font pill ("REPLIED IN 4:51").     */
/* Tones + their checked text pairings:                                */
/*   magenta — bg #ff2dae / white text (the design/b show sticker)     */
/*   cream   — bg cream-bright / ink text (for ink surfaces)           */
/*   ink     — bg ink-stage / cream text (for cream panels)            */
/*   outline — ink/25 border, ink/70 text (quiet chip on cream/white)  */
/* ------------------------------------------------------------------ */

const CHIP_TONES: Record<"magenta" | "cream" | "ink" | "outline", string> = {
  magenta: "bg-neon-magenta text-white shadow-[0_8px_20px_rgba(255,45,174,0.35)]",
  cream: "bg-cream-bright text-ink-stage shadow-[0_8px_20px_rgba(23,22,31,0.25)]",
  ink: "bg-ink-stage text-cream",
  outline: "border-[1.5px] border-ink-stage/25 text-ink-stage/70",
};

export function StickerChip({
  tone = "magenta",
  rotate = 0,
  className = "",
  children,
}: {
  tone?: "magenta" | "cream" | "ink" | "outline";
  rotate?: number;
  className?: string;
  children: ReactNode;
}) {
  const style: CSSProperties | undefined =
    rotate !== 0 ? { transform: `rotate(${rotate}deg)` } : undefined;
  return (
    <span
      className={`inline-block rounded-full px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${CHIP_TONES[tone]} ${className}`}
      style={style}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* CollageMark — small geometric marks for empty states (v2.1 LAW:     */
/* no emoji in interface chrome, ever). Hand-drawn inline SVG/CSS,     */
/* ~40-56px: ink-stage strokes at ~70% opacity + exactly ONE accent    */
/* per mark (cyan OR the magenta→orange show gradient). Unlike the     */
/* other collage pieces these flow INLINE (centered above copy), so    */
/* they are not absolutely positioned. Still decorative (aria-hidden). */
/* ------------------------------------------------------------------ */

export type CollageMarkKind = "inbox" | "calendar" | "package" | "draft" | "report";

const INK_STROKE = {
  stroke: "#17161f",
  strokeOpacity: 0.7,
  fill: "none",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const MARK_GRADIENT = (id: string) => (
  <defs>
    <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stopColor="#ff2dae" />
      <stop offset="100%" stopColor="#ff8a00" />
    </linearGradient>
  </defs>
);

/** Slotted tray + a show-gradient dot dropping toward the slot. */
function InboxMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" aria-hidden>
      {MARK_GRADIENT("be-mark-grad-inbox")}
      <circle cx="28" cy="11" r="5" fill="url(#be-mark-grad-inbox)" />
      <path d="M28 20v4" strokeWidth="2.5" {...INK_STROKE} strokeOpacity={0.3} />
      <path
        d="M7 31v9a6 6 0 0 0 6 6h30a6 6 0 0 0 6-6v-9"
        strokeWidth="2.5"
        {...INK_STROKE}
      />
      <path d="M7 31h12l5 7h8l5-7h12" strokeWidth="2.5" {...INK_STROKE} />
    </svg>
  );
}

/** Minimal month grid — dot days, ONE gradient-filled day cell. */
function CalendarMark({ size }: { size: number }) {
  const days: ReactNode[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      if (row === 1 && col === 2) continue; // the gradient day
      days.push(
        <circle
          key={`${row}-${col}`}
          cx={15 + col * 9}
          cy={27 + row * 8.5}
          r="1.7"
          fill="#17161f"
          fillOpacity="0.3"
        />,
      );
    }
  }
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" aria-hidden>
      {MARK_GRADIENT("be-mark-grad-calendar")}
      <rect x="7" y="10" width="42" height="38" rx="6" strokeWidth="2.5" {...INK_STROKE} />
      <path d="M7 19.5h42" strokeWidth="2.5" {...INK_STROKE} />
      {days}
      <rect x="28.5" y="31" width="9" height="9" rx="2.5" fill="url(#be-mark-grad-calendar)" />
    </svg>
  );
}

/** Record-sleeve square with a vinyl disc peeking out (reuses VinylDisc). */
function PackageMark({ size }: { size: number }) {
  const disc = Math.round(size * 0.74);
  const sleeveW = Math.round(size * 0.72);
  const sleeveH = Math.round(size * 0.92);
  return (
    <span aria-hidden className="relative inline-block" style={{ width: size, height: size }}>
      {/* disc tucked behind the sleeve, peeking out the right edge */}
      <span
        className="absolute"
        style={{ left: size - disc, top: (size - disc) / 2, width: disc, height: disc }}
      >
        <VinylDisc size={disc} tone="dark" className="left-0 top-0" />
      </span>
      <span
        className="absolute left-0 top-1/2 -translate-y-1/2"
        style={{
          width: sleeveW,
          height: sleeveH,
          background: "#e8e4dc",
          border: "2.5px solid rgba(23,22,31,0.7)",
          borderRadius: 6,
        }}
      />
    </span>
  );
}

/** Three text-line strokes with a cyan cursor block (the product voice). */
function DraftMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" aria-hidden>
      <path d="M9 15h38" strokeWidth="3" {...INK_STROKE} />
      <path d="M9 27h34" strokeWidth="3" {...INK_STROKE} />
      <path d="M9 39h22" strokeWidth="3" {...INK_STROKE} />
      <rect x="36" y="33.5" width="7" height="11" fill="#00bbe4" />
    </svg>
  );
}

/** Three rising bars on a baseline — the last one wears the gradient. */
function ReportMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" aria-hidden>
      {MARK_GRADIENT("be-mark-grad-report")}
      <rect x="10" y="31" width="9" height="15" rx="2" strokeWidth="2.5" {...INK_STROKE} />
      <rect x="23.5" y="21" width="9" height="25" rx="2" strokeWidth="2.5" {...INK_STROKE} />
      <rect x="37" y="9" width="9" height="37" rx="2" fill="url(#be-mark-grad-report)" />
      <path d="M7 48h42" strokeWidth="2.5" {...INK_STROKE} />
    </svg>
  );
}

export function CollageMark({
  kind,
  size = 52,
  className = "",
}: {
  kind: CollageMarkKind;
  size?: number;
  className?: string;
}) {
  const marks: Record<CollageMarkKind, ReactNode> = {
    inbox: <InboxMark size={size} />,
    calendar: <CalendarMark size={size} />,
    package: <PackageMark size={size} />,
    draft: <DraftMark size={size} />,
    report: <ReportMark size={size} />,
  };
  return (
    <span aria-hidden className={`inline-flex ${className}`}>
      {marks[kind]}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* RingsBackdrop — the faint concentric thin-line rings on ink.        */
/* DESIGN.md law: at most ONE ring pattern per page (heroes/bands).    */
/* Parent needs `relative overflow-hidden`.                            */
/* ------------------------------------------------------------------ */

export function RingsBackdrop({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        background:
          "repeating-radial-gradient(circle at 74% 30%, transparent 0 84px, rgba(232,228,220,0.055) 84px 85.5px)",
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* HeroCollage — the composed design/b hero art: cream poster panel,   */
/* halo behind, spinning orange vinyl bleeding bottom-left, studio     */
/* speaker right, sticker chips + sparkles, show blob underneath.      */
/* Drop into a grid column; size/tilt match the canonical preview.     */
/* ------------------------------------------------------------------ */

export function HeroCollage({ className = "" }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <GradientBlob tone="show" className="-bottom-10 -right-8 h-56 w-72" />
      <div className="relative h-[460px] overflow-hidden rounded-3xl bg-cream shadow-[0_36px_90px_rgba(0,0,0,0.5)] rotate-[1.5deg]">
        <StickerChip tone="outline" className="absolute left-6 top-6">
          Now playing &mdash; your reply
        </StickerChip>
        <StickerChip tone="magenta" rotate={6} className="absolute right-6 top-6">
          Replied in 4:51
        </StickerChip>

        {/* collage: halo behind, orange vinyl bleeding bottom-left, speaker right */}
        <HaloRing width={360} height={140} tilt={-13} className="left-6 top-32" />
        <VinylDisc size={270} tone="orange" spin className="-bottom-16 -left-12" />
        <StudioSpeaker size={150} className="bottom-10 right-9 rotate-[2.5deg]" />

        {/* sparkles */}
        <span aria-hidden className="absolute left-[52%] top-16 text-2xl text-ink-stage/30">
          &#10022;
        </span>
        <span aria-hidden className="absolute bottom-28 left-[46%] text-sm text-ink-stage/25">
          &#10022;
        </span>
        <span aria-hidden className="absolute right-44 top-28 text-base text-neon-magenta/50">
          &#10022;
        </span>
      </div>
    </div>
  );
}
