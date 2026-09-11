"use client";
import { useSyncExternalStore } from "react";

const KEY = "brightears:shortlist:v1";
const EVENT = "be:shortlist";
let fallback = "[]";
function snapshot() { try { return window.localStorage.getItem(KEY) || fallback; } catch { return fallback; } }
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener); window.addEventListener(EVENT, listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener(EVENT, listener); };
}
export function parseShortlist(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(id)))].slice(0, 6) : [];
  } catch { return []; }
}
export function useAgencyShortlist() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
  const shortlist = parseShortlist(raw);
  function setShortlist(next: string[] | ((current: string[]) => string[])) {
    const value = typeof next === "function" ? next(parseShortlist(snapshot())) : next;
    fallback = JSON.stringify(value.slice(0, 6));
    try { window.localStorage.setItem(KEY, fallback); } catch { /* Navigation still retains the in-memory selection. */ }
    window.dispatchEvent(new Event(EVENT));
  }
  return [shortlist, setShortlist] as const;
}
