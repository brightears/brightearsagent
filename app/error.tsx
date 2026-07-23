"use client";

// Branded root error boundary (audit 2026-07: the only boundary lived under
// /dashboard/settings — anywhere else, a render crash fell through to Next's
// bare default). Same ink-canvas pattern as app/not-found.tsx: logo, calm
// copy, one obvious retry, two exits. No emoji (v2.1 LAW). Nothing here says
// "AI" or shows internals — the agent's work is unaffected by a page hiccup
// and the copy says so.
import Link from "next/link";
import { BrightEarsLogo, buttonStyles } from "@/components/ui";

export default function RootError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink-stage px-6 text-center">
      <BrightEarsLogo size={44} />
      <p className="mt-8 font-mono text-xs font-bold uppercase tracking-[0.2em] text-brand-cyan">
        A skipped beat
      </p>
      <h1 className="mt-3 max-w-xl text-4xl font-black tracking-tight text-cream-bright sm:text-5xl">
        This page hit a{" "}
        <span className="bg-gradient-to-r from-neon-magenta to-neon-orange bg-clip-text text-transparent">
          wrong note.
        </span>
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-cream/60">
        Something went sideways on our end — your account and your pipeline are untouched, and the
        agent keeps working. Try again, or head somewhere solid.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <button type="button" onClick={reset} className={buttonStyles.primary}>
          Try again
        </button>
        <Link href="/" className={buttonStyles.secondary}>
          Front page
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
