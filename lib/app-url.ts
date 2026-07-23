// Single source of truth for the app's own origin (the APP_URL env var).
// Before this helper, seven files carried three different fallbacks
// (onrender.com, brightears.io, localhost:3000) — a missing APP_URL in
// production would have put localhost links in customer emails while the
// staging host leaked into canonicals. Two tiers on purpose:
//
//   appUrl()        — STRICT: throws in production when APP_URL is unset.
//                     Use for anything that leaves the building (email links,
//                     OAuth redirect URIs, Stripe return URLs, EPK links in
//                     outbound pitches, opt-out links).
//   appUrlLenient() — never throws; logs once and falls back. Use for
//                     self-referential metadata (metadataBase, robots,
//                     sitemap) where a wrong value is recoverable and a
//                     crash would take the marketing site down with it.

const STAGING_FALLBACK = "https://brightears-app.onrender.com";

function fromEnv(): string | null {
  const url = process.env.APP_URL;
  return url ? url.replace(/\/+$/, "") : null;
}

export function appUrl(): string {
  const url = fromEnv();
  if (url) return url;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "APP_URL is not set — refusing to build an outbound link to an unknown origin",
    );
  }
  return "http://localhost:3000";
}

let warned = false;

export function appUrlLenient(): string {
  const url = fromEnv();
  if (url) return url;
  if (process.env.NODE_ENV === "production" && !warned) {
    warned = true;
    console.error(
      JSON.stringify({ level: "error", msg: "APP_URL unset — metadata falling back", fallback: STAGING_FALLBACK }),
    );
  }
  return process.env.NODE_ENV === "production" ? STAGING_FALLBACK : "http://localhost:3000";
}
