"use client";

import { useEffect, useState } from "react";
import { enablePush, getPushSnapshot } from "@/lib/push-client";
import { buttonStyles } from "@/components/ui";

const DISMISS_KEY = "be-push-prompt-dismissed";

/**
 * First-value push prompt (P4.2): the enable-notifications ask, made at the
 * moment it's obviously worth it — the artist is looking at a drafted reply —
 * instead of buried in Control Room → Connections where nobody found it
 * (audit 2026-07). Renders nothing when push is unsupported, denied, already
 * on, or previously dismissed on this device; "Not now" is honored forever
 * (the Control Room toggle remains the opt-in path after that).
 */
export function PushPrompt() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      // Storage blocked (private mode) — fall through, worst case we ask again.
    }
    getPushSnapshot().then((snap) => {
      if (!cancelled && snap === "idle") setShow(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Best effort.
    }
    setShow(false);
  };

  const enable = async () => {
    setBusy(true);
    try {
      await enablePush();
    } catch {
      // Errors and denials both end the prompt — the Control Room toggle
      // shows the full state and remains the recovery path.
    }
    setShow(false);
    setBusy(false);
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-brand-cyan/40 bg-brand-cyan-soft/30 px-4 py-3">
      <p className="min-w-48 flex-1 text-sm text-ink-stage/80">
        <span className="font-bold text-ink-stage">Hear the ping.</span> Get notified the moment a
        reply is ready — even mid-set.
      </p>
      <div className="flex flex-none items-center gap-3">
        <button
          type="button"
          onClick={dismiss}
          className="text-sm font-semibold text-ink-stage/45 hover:text-ink-stage/70"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className={`${buttonStyles.primary} text-sm`}
        >
          {busy ? "Setting up…" : "Enable notifications"}
        </button>
      </div>
    </div>
  );
}
