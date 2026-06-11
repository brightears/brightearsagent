"use client";

import { useEffect, useRef, useState } from "react";

/** One-tap copy for template cards. Falls back gracefully if the Clipboard API is blocked. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 1800);
  }

  // Sticker-chip styled, cyan = the click (interface voice, docs/DESIGN.md).
  return (
    <button
      type="button"
      onClick={copy}
      className={`shrink-0 rounded-full px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${
        state === "copied"
          ? "bg-brand-cyan text-ink-stage"
          : "bg-ink-stage text-cream hover:bg-brand-cyan hover:text-ink-stage"
      }`}
    >
      {state === "copied" ? "Copied!" : state === "failed" ? "Select & copy manually" : label}
    </button>
  );
}
