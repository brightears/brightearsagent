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

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Badge, Card, Kicker, buttonStyles } from "@/components/ui";
import { disconnectMailboxForm } from "@/app/actions/settings";
import { sendTestEmail } from "@/app/actions/venues";
import { useI18n } from "@/components/locale-provider";

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
const TH_REASON_COPY: Record<string, string> = {
  auth: "ยืนยันเซสชันไม่สำเร็จ โปรดเข้าสู่ระบบแล้วลองใหม่",
  state: "ลิงก์เชื่อมต่อหมดอายุหรือไม่ตรงกัน โปรดลองใหม่",
  missing: "Google ไม่ได้ส่งข้อมูลที่จำเป็นกลับมา โปรดลองใหม่",
  exchange: "Google ปฏิเสธการเชื่อมต่อ โปรดลองใหม่",
  scope: "ยังไม่ได้อนุญาตสิทธิ์ส่งอีเมล โปรดเชื่อมต่อใหม่และอนุญาตการส่ง",
  config: "การส่งจากกล่องจดหมายขัดข้องชั่วคราว โปรดลองอีกครั้งในภายหลัง",
  access_denied: "คุณปฏิเสธสิทธิ์ โปรดเชื่อมต่อใหม่เพื่อส่งจากกล่องจดหมายของคุณ",
};

// Keep the reviewed English disclosure co-located with the consent button.
// Source-level boundary tests deliberately assert these exact claims cannot be
// removed while copy is localized.
const GOOGLE_DISCLOSURE_EN = {
  heading: "What connecting Gmail allows",
  scope: "Bright Ears can send email on your behalf. We never read, list or import Gmail messages.",
  data: "Your connected Google email, OAuth tokens and Gmail message IDs are never sent to OpenRouter.",
};

function Toast({ mailbox, reason }: { mailbox: string; reason: string | null }) {
  const { locale } = useI18n();
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
    connected: { tone: "cyan", text: locale === "th" ? "เชื่อมต่อกล่องจดหมายแล้ว ข้อความแนะนำตัวจะส่งจากกล่องจดหมายของคุณ" : "Mailbox connected — pitches now send from your inbox." },
    unavailable: { tone: "peach", text: locale === "th" ? "สภาพแวดล้อมนี้ยังไม่เปิดใช้การส่งจากกล่องจดหมาย" : "Mailbox sending isn't enabled on this environment yet." },
    error: {
      tone: "peach",
      text: (reason && (locale === "th" ? TH_REASON_COPY[reason] : REASON_COPY[reason]))
        ?? (locale === "th" ? "เชื่อมต่อกล่องจดหมายไม่สำเร็จ โปรดลองใหม่" : "We couldn't connect your mailbox — please try again."),
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

// "Send test email" — sends a SAMPLE pitch (in the owner's voice) to their OWN
// connected address: proves sending works end-to-end and doubles as a permanent
// "verify your mailbox" affordance. No venue is contacted; no rows are written.
// Inline confirmation, on-brand (no emoji), ink-outline ghost on the white card.
function SendTestEmailButton() {
  const { locale, t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  function onClick() {
    setResult(null);
    startTransition(async () => {
      const res = await sendTestEmail();
      setResult(
        res.ok
          ? res.generation === "ai"
            ? {
                ok: true,
                text: locale === "th"
                  ? `ส่งอีเมลทดสอบที่สร้างโดย AI ไปยัง ${res.sentTo} แล้ว โปรดตรวจกล่องจดหมาย`
                  : `AI-generated test sent to ${res.sentTo} — check your inbox.`,
              }
            : {
                ok: false,
                text: locale === "th"
                  ? "การส่งจากกล่องจดหมายทำงาน แต่การสร้างด้วย AI ล้มเหลวและใช้อีเมลตัวอย่าง โปรดลองอีกครั้งก่อนใช้ร่างติดต่อสถานที่"
                  : "Mailbox delivery worked, but AI generation failed and the email used a static sample. Try again before relying on venue drafts.",
              }
          : { ok: false, text: locale === "th" ? "ส่งอีเมลทดสอบไม่สำเร็จ โปรดลองใหม่" : res.error },
      );
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={buttonStyles.secondaryOnLight}
      >
        {pending ? t("settings.mailbox.sending") : t("settings.mailbox.test")}
      </button>
      {result && (
        <p
          className={`text-sm font-medium ${result.ok ? "text-ink-stage/70" : "text-red-600"}`}
        >
          {result.text}
        </p>
      )}
    </div>
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
  const { locale, t } = useI18n();
  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3>
          <Kicker onLight>{t("settings.mailbox.title")}</Kicker>
        </h3>
        {state.kind === "connected" && <Badge tone="teal">{t("settings.mailbox.connected")}</Badge>}
        {state.kind === "error" && <Badge tone="peach">{t("settings.mailbox.attention")}</Badge>}
      </div>

      {mailbox && <Toast mailbox={mailbox} reason={reason} />}

      <p className="mb-4 text-sm text-ink-stage/60">
        {t("settings.mailbox.intro")}
      </p>

      {(state.kind === "disconnected" || state.kind === "error") && (
        <div className="mb-4 rounded-xl border border-brand-cyan/30 bg-brand-cyan-soft/45 px-4 py-3 text-sm leading-relaxed text-ink-stage/75">
          <p className="font-semibold text-ink-stage">{locale === "th" ? t("settings.mailbox.allows") : GOOGLE_DISCLOSURE_EN.heading}</p>
          <p className="mt-1.5">
            {locale === "th" ? t("settings.mailbox.scope") : GOOGLE_DISCLOSURE_EN.scope}
          </p>
          <p className="mt-1.5">
            {locale === "th" ? t("settings.mailbox.data") : GOOGLE_DISCLOSURE_EN.data}{" "}
            {locale === "th"
              ? "เมื่อเลือกเชื่อมต่อ Gmail คุณขอให้เราใช้สิทธิ์แบบจำกัดนี้ตาม "
              : "By choosing Connect Gmail, you ask us to use this limited access as described in our "}
            <Link href="/privacy" className="font-semibold underline underline-offset-2">
              {t("settings.mailbox.privacy")}
            </Link>
            .
          </p>
        </div>
      )}

      {state.kind === "unconfigured" && (
        <p className="rounded-xl bg-cream/60 px-3 py-2 text-sm text-ink-stage/55">
          {locale === "th" ? "ระบบนี้ยังไม่เปิดใช้การส่งจากกล่องจดหมาย" : "Mailbox sending isn't enabled on this environment yet."}
        </p>
      )}

      {state.kind === "disconnected" && (
        <div className="flex flex-wrap items-center gap-3">
          {/* A plain link (not a form) — the start route 302s to Google. */}
          {locale === "th" ? (
            <a href="/api/oauth/google/start" className={buttonStyles.primary}>
              {t("settings.mailbox.connect")}
            </a>
          ) : (
            <a href="/api/oauth/google/start" className={buttonStyles.primary}>Connect Gmail</a>
          )}
          <button
            type="button"
            disabled
            aria-disabled
            className={`${buttonStyles.secondaryOnLight} cursor-not-allowed`}
            title={locale === "th" ? "กำลังเพิ่มการรองรับ Outlook" : "Outlook support is coming soon"}
          >
            {t("settings.mailbox.outlook")}
          </button>
        </div>
      )}

      {state.kind === "connected" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex max-w-full items-center rounded-full bg-brand-cyan-soft px-4 py-2">
              <code className="select-all break-all font-mono text-sm font-semibold text-ink-stage">
                {state.email}
              </code>
            </span>
            <div className="flex flex-wrap items-start gap-3">
              <SendTestEmailButton />
              <form action={disconnectMailboxForm}>
                <button className={buttonStyles.secondaryOnLight}>{t("settings.mailbox.disconnect")}</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {state.kind === "error" && (
        <div className="space-y-3">
          <p className="flex items-start gap-2 text-sm text-ink-stage/75">
            <span aria-hidden className="mt-1.5 size-1 flex-none bg-neon-orange" />
            {locale === "th" ? "การเชื่อมต่อกล่องจดหมายต้องได้รับการตรวจสอบ" : state.lastError ?? "Your mailbox connection needs attention."}
            {state.email ? ` (${state.email})` : ""}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a href="/api/oauth/google/start" className={buttonStyles.primary}>
              {t("settings.mailbox.reconnect")}
            </a>
            <form action={disconnectMailboxForm}>
              <button className={buttonStyles.secondaryOnLight}>{t("settings.mailbox.remove")}</button>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}
