import Link from "next/link";
import { BrightEarsLogo } from "@/components/ui";

/**
 * Branded 404 (audit 2026-07: lost visitors hit Next's bare default — no nav,
 * no logo, no way home — wearing the retired root-title tagline). Ink canvas,
 * typography-first, one obvious exit. No emoji (v2.1 LAW).
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink-stage px-6 text-center">
      <BrightEarsLogo size={44} />
      <p className="mt-8 font-mono text-xs font-bold uppercase tracking-[0.2em] text-brand-cyan">
        404 — nothing playing here
      </p>
      <h1 className="mt-3 max-w-xl text-4xl font-black tracking-tight text-cream-bright sm:text-5xl">
        This page missed its{" "}
        <span className="bg-gradient-to-r from-neon-magenta to-neon-orange bg-clip-text text-transparent">
          soundcheck.
        </span>
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-cream/60">
        The link is broken or the page moved on. The gigs haven&apos;t — head back and let the agent
        keep hunting.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/"
          className="rounded-full bg-brand-cyan px-5 py-2.5 font-bold text-ink-stage transition-opacity hover:opacity-90"
        >
          Back to the front page
        </Link>
        <Link
          href="/dashboard"
          className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-cream/60 hover:text-brand-cyan"
        >
          Your dashboard →
        </Link>
      </div>
    </main>
  );
}
