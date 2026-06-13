"use client";

// "Your sending mailbox" card (Phase 10.5). Proactive venue pitches send from
// the artist's OWN inbox (Gmail OAuth) so venues hear from THEM, not a tool.
// Design LAW: editorial Kicker, no emoji ever.
//
// States: not connected → explain + "Connect Gmail" (links to the start
// route); connected → email + green "Connected" Badge + Disconnect; error →
// lastError + reconnect. When OAuth isn't enabled on this environment (no
// client secret — the LOCAL case) we show a muted note, never a dead button.
//
// The ?mailbox=connected|error|unavailable query flags become a one-line toast.

import { useEffect, useState } from "react";
import { Badge, Card, Kicker, buttonStyles } from "@/components/ui";
import { disconnectMailboxForm } from "@/app/actions/settings";

export type MailboxState =
  | { kind: "unconfigured" }
  | { kind: "disconnected" }
  | { kind: "connected"; email: string }
  | { kind: "error"; email: string | null; lastError: string | null };

const REASON_COPY: Record<string, string> = {
  auth: "We couldn't confirm your session — sign in and try again.",
  state: "That connection link expired or didn't match — please try again.",
  missing: "Google didn't return what we needed — please try again.",
  exchange: "Google declined the connection — please try again.",
  scope: "Sending permission wasn't granted — reconnect and allow sending.",
  // Server-side misconfiguration (encryption key missing/malformed) — NOT the
  // owner's fault and NOT a "feature off" state. Honest, non-actionable line.
  config: "Mailbox sending is temporarily misconfigured on our end — we're on it. Please try again shortly.",
  access_denied: "You declined the permission — reconnect to send from your inbox.",
};

function Toast({ mailbox, reason }: { mailbox: string; reason: string | null }) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    // Clean the query out of the URL so a refresh doesn't re-toast.
    const url = new URL(window.location.href);
    url.searchParams.delete("mailbox");
    url.searchParams.delete("reason");
    window.history.replaceState({}, "", url.toString());
    const t = setTimeout(() => setShow(false), 6000);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;

  const map: Record<string, { tone: "cyan" | "peach"; text: string }> = {
    connected: { tone: "cyan", text: "Mailbox connected — pitches now send from your inbox." },
    unavailable: { tone: "peach", text: "Mailbox sending isn't enabled on this environment yet." },
    error: {
      tone: "peach",
      text: (reason && REASON_COPY[reason]) ?? "We couldn't connect your mailbox — please try again.",
    },
  };
  const m = map[mailbox];
  if (!m) return null;
  return (
    <p
      className={`mb-3 rounded-xl px-3 py-2 text-sm font-semibold ${
        m.tone === "cyan" ? "bg-brand-cyan-soft text-ink-stage" : "bg-[#ffdfba] text-[#7a4100]"
      }`}
    >
      {m.text}
    </p>
  );
}

export function MailboxCard({
  state,
  mailbox,
  reason,
}: {
  state: MailboxState;
  /** ?mailbox= query flag (connected|error|unavailable), if present. */
  mailbox: string | null;
  /** ?reason= query flag for an error, if present. */
  reason: string | null;
}) {
  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2>
          <Kicker onLight>Outreach mailbox</Kicker>
        </h2>
        {state.kind === "connected" && <Badge tone="teal">Connected</Badge>}
        {state.kind === "error" && <Badge tone="peach">Needs attention</Badge>}
      </div>

      {mailbox && <Toast mailbox={mailbox} reason={reason} />}

      <p className="mb-4 text-sm text-ink-stage/60">
        Pitches send from your own inbox so venues hear from you, not a tool. We only ever ask to
        send — never to read your mail.
      </p>

      {state.kind === "unconfigured" && (
        <p className="rounded-xl bg-cream/60 px-3 py-2 text-sm text-ink-stage/55">
          Mailbox sending isn&apos;t enabled on this environment yet.
        </p>
      )}

      {state.kind === "disconnected" && (
        <div className="flex flex-wrap items-center gap-3">
          {/* A plain link (not a form) — the start route 302s to Google. */}
          <a href="/api/oauth/google/start" className={buttonStyles.primary}>
            Connect Gmail
          </a>
          <button
            type="button"
            disabled
            aria-disabled
            className={`${buttonStyles.secondaryOnLight} cursor-not-allowed`}
            title="Outlook support is coming soon"
          >
            Outlook (coming soon)
          </button>
        </div>
      )}

      {state.kind === "connected" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex max-w-full items-center rounded-full bg-brand-cyan-soft px-4 py-2">
            <code className="select-all break-all font-mono text-sm font-semibold text-ink-stage">
              {state.email}
            </code>
          </span>
          <form action={disconnectMailboxForm}>
            <button className={buttonStyles.secondaryOnLight}>Disconnect</button>
          </form>
        </div>
      )}

      {state.kind === "error" && (
        <div className="space-y-3">
          <p className="flex items-start gap-2 text-sm text-ink-stage/75">
            <span aria-hidden className="mt-1.5 size-1 flex-none bg-neon-orange" />
            {state.lastError ?? "Your mailbox connection needs attention."}
            {state.email ? ` (${state.email})` : ""}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a href="/api/oauth/google/start" className={buttonStyles.primary}>
              Reconnect Gmail
            </a>
            <form action={disconnectMailboxForm}>
              <button className={buttonStyles.secondaryOnLight}>Remove</button>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}
