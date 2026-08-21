"use client";

import { useEffect, useState } from "react";
import { Kicker } from "@/components/ui";
import { useI18n } from "@/components/locale-provider";

const DISMISS_KEY = "be-a2hs-dismissed";

type BipEvent = Event & { prompt: () => Promise<void> };

/**
 * A2HS prompt (P9.6): approve-from-phone lives or dies on the app being one
 * tap from the Home Screen, and nobody installs a PWA unprompted. Shown on
 * the dashboard only AFTER the first approval (the artist has felt the loop
 * work — the earned moment, same logic as PushPrompt's first-value ask) and
 * only on phones/tablets that aren't already running standalone. iOS Safari
 * has no install event, so it gets Share-sheet directions; Chromium gets a
 * real install button off beforeinstallprompt. "Not now" is honored forever.
 */
export function InstallPrompt({ eligible }: { eligible: boolean }) {
  const { locale } = useI18n();
  const c = (english: string, thai: string) => locale === "th" ? thai : english;
  const [mode, setMode] = useState<"hidden" | "ios" | "chrome">("hidden");
  const [bip, setBip] = useState<BipEvent | null>(null);

  useEffect(() => {
    if (!eligible) return;
    let cancelled = false;
    const onBip = (e: Event) => {
      e.preventDefault();
      setBip(e as BipEvent);
      setMode("chrome");
    };
    // Deferred a tick: the environment check never changes mid-session, and
    // setState synchronously inside an effect trips the react-compiler lint
    // (cascading renders). Same shape as PushPrompt's async snapshot.
    Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        if (localStorage.getItem(DISMISS_KEY)) return;
      } catch {
        // Storage blocked (private mode) — fall through, worst case we ask again.
      }
      const nav = navigator as Navigator & { standalone?: boolean };
      // Already installed (Chromium reports display-mode, iOS sets navigator.standalone).
      if (window.matchMedia("(display-mode: standalone)").matches || nav.standalone) return;
      // Desktop gets no nag — the pitch is the phone Home Screen.
      if (!window.matchMedia("(pointer: coarse)").matches) return;
      if (/iphone|ipad|ipod/i.test(nav.userAgent)) {
        setMode("ios");
        return;
      }
      window.addEventListener("beforeinstallprompt", onBip);
    });
    return () => {
      cancelled = true;
      // Safe even if the listener was never added.
      window.removeEventListener("beforeinstallprompt", onBip);
    };
  }, [eligible]);

  if (mode === "hidden") return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Best effort.
    }
    setMode("hidden");
  };

  return (
    <section className="mb-6 rounded-2xl border border-cream/15 bg-ink-raised px-5 py-4">
      <Kicker>{c("Put it on your phone", "เพิ่มไว้บนโทรศัพท์")}</Kicker>
      <p className="mt-1.5 text-sm text-cream/80">
        <span className="font-bold text-cream-bright">{c("Make this one tap.", "เปิดใช้งานได้ในคลิกเดียว")}</span>{" "}
        {mode === "ios"
          ? c("Add Bright Ears to your Home Screen: tap the Share button, then “Add to Home Screen”. The ping lands, you approve, done.", "เพิ่ม Bright Ears ไปยังหน้าจอโฮม: แตะปุ่มแชร์ แล้วเลือก ‘เพิ่มไปยังหน้าจอโฮม’ เมื่อมีแจ้งเตือนก็เปิดมาอนุมัติได้ทันที")
          : c("Install Bright Ears on your Home Screen — the ping lands, you approve, done.", "ติดตั้ง Bright Ears บนหน้าจอโฮม เมื่อมีแจ้งเตือนก็เปิดมาอนุมัติได้ทันที")}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {mode === "chrome" && (
          <button
            type="button"
            onClick={() => {
              // Chrome only allows one prompt() per event — dismiss either way;
              // the browser's own install UI takes over from here.
              bip?.prompt().catch(() => null);
              dismiss();
            }}
            className="rounded-full bg-brand-cyan px-5 py-2 text-sm font-bold text-ink-stage transition-opacity hover:opacity-90"
          >
            {c("Add to Home Screen", "เพิ่มไปยังหน้าจอโฮม")}
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="text-sm font-semibold text-cream/45 transition-colors hover:text-cream/70"
        >
          {mode === "ios" ? c("Got it", "เข้าใจแล้ว") : c("Not now", "ไว้ทีหลัง")}
        </button>
      </div>
    </section>
  );
}
