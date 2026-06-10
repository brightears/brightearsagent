"use client";

import { useEffect, useState } from "react";
import { savePushSubscription, removePushSubscription } from "@/app/actions/settings";
import { buttonStyles } from "@/components/ui";

/** Web-push wants the VAPID public key as raw bytes, not base64url. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
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
  const [state, setState] = useState<PushState>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancelled) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const sub = await reg?.pushManager.getSubscription();
        if (!cancelled) setState(sub ? "subscribed" : "idle");
      } catch {
        if (!cancelled) setState("idle");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setState("busy");
    setErrorMsg(null);
    try {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setErrorMsg("Push isn't configured on this server yet (missing VAPID key).");
        setState("error");
        return;
      }

      await navigator.serviceWorker.register("/sw.js");
      const reg = await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Browser returned an incomplete subscription");
      }
      const result = await savePushSubscription({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      if (!result.ok) throw new Error(result.error);
      setState("subscribed");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong enabling push.");
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
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong disabling push.");
      setState("error");
    }
  }

  if (state === "loading") {
    return <p className="text-sm text-ink/40">Checking this device…</p>;
  }

  if (state === "unsupported") {
    return (
      <p className="text-sm text-ink/60">
        This browser doesn&apos;t support push notifications. On iPhone, add Bright Ears to your
        home screen first (Share → Add to Home Screen), then enable push from there.
      </p>
    );
  }

  if (state === "denied") {
    return (
      <p className="text-sm text-ink/60">
        Notifications are blocked for this site. Allow them in your browser settings, then come
        back and try again — no pressure, email still works.
      </p>
    );
  }

  if (state === "subscribed") {
    return (
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-deep-teal">
          <span className="h-2 w-2 rounded-full bg-brand-cyan" aria-hidden />
          Push is on for this device
        </span>
        <button type="button" onClick={disable} className={buttonStyles.secondary}>
          Turn off
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={enable}
        disabled={state === "busy"}
        className={buttonStyles.primary}
      >
        {state === "busy" ? "Setting up…" : "Enable push on this device"}
      </button>
      {state === "error" && errorMsg && (
        <p className="text-sm font-medium text-red-600">{errorMsg}</p>
      )}
    </div>
  );
}
