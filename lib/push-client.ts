"use client";

// Browser-side push plumbing shared by the Control Room PushToggle and the
// first-value PushPrompt (P4.2). Server side lives in lib/push.ts.

import { savePushSubscription } from "@/app/actions/settings";

/** Web-push wants the VAPID public key as raw bytes, not base64url. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export type PushSnapshot = "unsupported" | "denied" | "subscribed" | "idle";

/** What this browser/device currently has, without prompting for anything. */
export async function getPushSnapshot(): Promise<PushSnapshot> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    return sub ? "subscribed" : "idle";
  } catch {
    return "idle";
  }
}

/**
 * Ask permission, subscribe this device, persist server-side.
 * Returns the resulting state; throws only on unexpected errors (missing
 * config, incomplete subscription) with a user-showable message.
 */
export async function enablePush(): Promise<"subscribed" | "denied"> {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) throw new Error("Push isn't configured on this server yet (missing VAPID key).");

  await navigator.serviceWorker.register("/sw.js");
  const reg = await navigator.serviceWorker.ready;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

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
  return "subscribed";
}
