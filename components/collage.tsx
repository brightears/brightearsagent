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
  "@keyframes be-vinyl-spin{to{transform:rotate(360deg)}}.be-vinyl-spin{animation:be-vinyl-spin 36s linear infinite}@media (prefers-reduced-motion: reduce){.be-vinyl-spin{animation:none}}";

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
/* StickerChip — small rotated mono-font pill ("ANSWERED IN MINUTES").  */
/* Tones + their checked text pairings:                                */
/*   magenta — bg #ff2dae / ink text (the show sticker; white text     */
/*             fails AA at chip size ~3.4:1, ink passes ~4.8:1)        */
/*   cream   — bg cream-bright / ink text (for ink surfaces)           */
/*   ink     — bg ink-stage / cream text (for cream panels)            */
/*   outline — ink/25 border, ink/70 text (quiet chip on cream/white)  */
/* ------------------------------------------------------------------ */

const CHIP_TONES: Record<"magenta" | "cream" | "ink" | "outline", string> = {
  magenta: "bg-neon-magenta text-ink-stage shadow-[0_8px_20px_rgba(255,45,174,0.35)]",
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
          Answered in minutes
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
