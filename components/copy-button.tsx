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

  return (
    <button
      type="button"
      onClick={copy}
      className={`rounded-full text-xs font-semibold px-3 py-1.5 transition-colors ${
        state === "copied"
          ? "bg-deep-teal text-white"
          : "bg-brand-cyan-soft text-deep-teal hover:bg-brand-cyan hover:text-white"
      }`}
    >
      {state === "copied" ? "Copied!" : state === "failed" ? "Select & copy manually" : label}
    </button>
  );
}
