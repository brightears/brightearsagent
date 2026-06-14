// Shared chrome for the legal pages (Privacy, Terms, Cookies, DPA).
// Design language v2.1 "Neon Collage" (docs/DESIGN.md, THE LAW): ink canvas,
// a single cream prose card floating on the ink (NO tilt — these are read like
// data, not posters), a mono ALL-CAPS kicker eyebrow, a display headline with
// one gradient-painted word, a prominent DRAFT banner and a Last-updated line.
//
// Server-component friendly: no hooks, no client APIs. Decorative collage is
// kept deliberately quiet here — legal copy must read at AA contrast, calm.
import type { ReactNode } from "react";
import { GradientBlob, StickerChip } from "@/components/collage";

/** The v2 signature: one gradient-painted word in a warm-white headline. */
const GRAD = "bg-gradient-to-r from-neon-magenta to-neon-orange bg-clip-text text-transparent";

export const LAST_UPDATED = "June 14, 2026";

/**
 * DRAFT banner — required on EVERY legal page (task B6). Cyan = the interface
 * voice telling you a true fact about state; high-contrast on ink, not a
 * decorative show accent. Kept sober: this is a real disclaimer.
 */
export function DraftBanner() {
  return (
    <div
      role="note"
      className="mb-8 rounded-2xl border border-brand-cyan/40 bg-brand-cyan/10 px-5 py-4"
    >
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-brand-cyan">
        Draft — pending legal review
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-cream/80">
        This document is a working draft and is{" "}
        <span className="font-semibold text-cream-bright">not yet effective</span>. It has not been
        reviewed or approved by a lawyer and does not yet govern your use of Bright Ears.
      </p>
    </div>
  );
}

/** A section heading inside the prose card — mono kicker + bold ink heading. */
export function LegalSection({
  kicker,
  title,
  children,
}: {
  kicker?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="scroll-mt-24">
      {kicker ? (
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-stage/50">
          {kicker}
        </p>
      ) : null}
      <h2 className="mt-1.5 text-xl sm:text-2xl font-extrabold tracking-tight text-ink-stage">
        {title}
      </h2>
      <div className="mt-4 space-y-4 leading-relaxed text-ink-stage/80">{children}</div>
    </section>
  );
}

/**
 * Page frame: ink canvas + hero (kicker, gradient-word headline, lead-in),
 * then the cream prose card carrying the DRAFT banner, the Last-updated line
 * and the page body.
 */
export function LegalPage({
  kicker,
  title,
  gradientWord,
  lead,
  children,
}: {
  /** mono ALL-CAPS eyebrow, e.g. "LEGAL — PRIVACY" */
  kicker: string;
  /** headline with {gradientWord} substituted in; pass title WITHOUT the word */
  title: ReactNode;
  /** the one word painted in the show gradient inside the headline */
  gradientWord?: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <div className="relative isolate overflow-hidden bg-ink-stage text-cream-bright">
      {/* quiet hero glow (no ring pattern — keep these pages calm) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80"
        style={{
          background:
            "radial-gradient(560px circle at 82% 120px, rgba(255,45,174,0.08), transparent 70%), radial-gradient(460px circle at 6% 60px, rgba(0,187,228,0.06), transparent 70%)",
        }}
      />

      <header className="relative mx-auto max-w-3xl px-6 pt-16 pb-8 sm:pt-20">
        <StickerChip tone="cream" rotate={-2}>
          {kicker}
        </StickerChip>
        <h1 className="mt-6 text-4xl sm:text-5xl font-black tracking-tight text-cream-bright text-balance">
          {title}
          {gradientWord ? <span className={GRAD}>{gradientWord}</span> : null}
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-cream/70 text-balance">{lead}</p>
      </header>

      <div className="relative mx-auto max-w-3xl px-6 pb-24">
        <div className="relative">
          <GradientBlob tone="cyan" className="-top-8 -left-10 h-36 w-56" />
          <article className="relative rounded-[2rem] bg-cream px-6 py-10 shadow-[0_36px_90px_rgba(0,0,0,0.5)] sm:px-10 sm:py-12">
            <DraftBanner />
            <p className="mb-10 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink-stage/50">
              Last updated: {LAST_UPDATED}
            </p>
            <div className="space-y-10">{children}</div>
          </article>
        </div>
      </div>
    </div>
  );
}
