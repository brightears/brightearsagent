"use client";

import { useEffect, useState, type ReactNode } from "react";
import { removePushSubscription } from "@/app/actions/settings";
import { enablePush, getPushSnapshot } from "@/lib/push-client";
import { buttonStyles } from "@/components/ui";
import { useI18n } from "@/components/locale-provider";

/** Friendly card row for every push state — colored dot + plain-words microcopy (docs/DESIGN.md).
 *  v2 dots: cyan = on (interface voice), cream = off/quiet. Rows sit on the white card. */
function StatusRow({
  dot,
  tint = "border-cream bg-cream/40",
  title,
  hint,
  action,
}: {
  dot: string;
  tint?: string;
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border px-4 py-3.5 ${tint}`}>
      <span aria-hidden className={`size-2.5 flex-none rounded-full ${dot}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink-stage">{title}</p>
        {hint && <p className="mt-0.5 text-xs leading-relaxed text-ink-stage/55">{hint}</p>}
      </div>
      {action && <div className="flex-none">{action}</div>}
    </div>
  );
}

type PushState =
  | "loading" // checking what this browser already has
  | "unsupported" // no service worker / Push API here
  | "idle" // supported, not subscribed
  | "busy" // subscribing or unsubscribing
  | "subscribed"
  | "denied" // user blocked notifications
  | "error";

export function PushToggle() {
  const { locale } = useI18n();
  const c = (english: string, thai: string) => locale === "th" ? thai : english;
  const [state, setState] = useState<PushState>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPushSnapshot().then((snap) => {
      if (!cancelled) setState(snap);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setState("busy");
    setErrorMsg(null);
    try {
      setState(await enablePush());
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : c("Something went wrong enabling push.", "เปิดการแจ้งเตือนไม่สำเร็จ"));
      setState("error");
    }
  }

  async function disable() {
    setState("busy");
    setErrorMsg(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await removePushSubscription(endpoint);
      }
      setState("idle");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : c("Something went wrong disabling push.", "ปิดการแจ้งเตือนไม่สำเร็จ"));
      setState("error");
    }
  }

  if (state === "loading") {
    return <StatusRow dot="bg-cream ring-1 ring-ink-stage/20 animate-pulse" title={c("Checking this device…", "กำลังตรวจสอบอุปกรณ์นี้…")} />;
  }

  if (state === "unsupported") {
    return (
      <StatusRow
        dot="bg-ink-stage/25"
        title={c("Push isn't available in this browser", "เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือนแบบพุช")}
        hint={
          <>
            {c("On iPhone, add Bright Ears to your home screen first (Share → Add to Home Screen), then enable push from there.", "บน iPhone ให้เพิ่ม Bright Ears ไปยังหน้าจอโฮมก่อน (แชร์ → เพิ่มไปยังหน้าจอโฮม) แล้วเปิดการแจ้งเตือนจากแอปนั้น")}
          </>
        }
      />
    );
  }

  if (state === "denied") {
    return (
      <StatusRow
        // Orange-soft warning fill, ink text (v2 status pairing chart in ui.tsx).
        dot="bg-neon-orange"
        tint="border-[#ffdfba] bg-[#ffdfba]/50"
        title={c("Notifications are blocked for this site", "การแจ้งเตือนของเว็บไซต์นี้ถูกบล็อก")}
        hint={c("Allow them in your browser settings, then come back and try again — no pressure, email still works.", "อนุญาตในการตั้งค่าเบราว์เซอร์แล้วกลับมาลองใหม่ได้ อีเมลยังทำงานตามปกติ")}
      />
    );
  }

  if (state === "subscribed") {
    return (
      <StatusRow
        // ON = cyan dot on a cyan-soft tint (the interface accent).
        dot="bg-brand-cyan"
        tint="border-brand-cyan/40 bg-brand-cyan-soft/40"
        title={c("Push is on for this device", "เปิดการแจ้งเตือนบนอุปกรณ์นี้แล้ว")}
        hint={c("You'll hear the ping the moment a reply is ready.", "คุณจะได้รับแจ้งทันทีเมื่อข้อความตอบพร้อม")}
        action={
          <button type="button" onClick={disable} className={buttonStyles.secondaryOnLight}>
            {c("Turn off", "ปิด")}
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-2">
      <StatusRow
        // OFF = quiet cream dot; busy = cyan pulse while we set things up.
        dot={state === "busy" ? "bg-brand-cyan animate-pulse" : "bg-cream ring-1 ring-ink-stage/20"}
        title={state === "busy" ? c("Setting up…", "กำลังตั้งค่า…") : c("Push is off on this device", "การแจ้งเตือนบนอุปกรณ์นี้ปิดอยู่")}
        hint={c("Turn it on and you'll hear the ping the moment a reply is ready — even mid-set.", "เปิดไว้เพื่อรับแจ้งทันทีเมื่อข้อความตอบพร้อม แม้คุณกำลังแสดงอยู่")}
        action={
          <button
            type="button"
            onClick={enable}
            disabled={state === "busy"}
            className={buttonStyles.primary}
          >
            {state === "busy" ? c("Setting up…", "กำลังตั้งค่า…") : c("Enable push on this device", "เปิดการแจ้งเตือนบนอุปกรณ์นี้")}
          </button>
        }
      />
      {state === "error" && errorMsg && (
        <p className="text-sm font-medium text-red-600">{errorMsg}</p>
      )}
    </div>
  );
}
