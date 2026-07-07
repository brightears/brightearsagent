import { timingSafeEqual } from "node:crypto";

/**
 * Fail-closed posture (14.5): closed in production AND whenever a public
 * https origin is configured — a misbuilt NODE_ENV must never silently open
 * webhook/cron endpoints on a reachable host. Read per call so tests and
 * runtime env changes behave predictably.
 */
const failClosed = () =>
  process.env.NODE_ENV === "production" || !!process.env.APP_URL?.startsWith("https://");

/**
 * Shared-secret gate for internal endpoints (webhooks, cron). Fail-CLOSED in
 * production: if the secret env var is unset, reject — a missing secret must
 * never silently open an endpoint to the world. In dev, an unset secret allows
 * (so local testing needs no setup).
 */
export function checkSharedSecret(envVar: string | undefined, provided: string | null): boolean {
  if (!envVar) return !failClosed(); // fail-closed posture + unset secret = denied
  if (!provided) return false;
  const a = Buffer.from(envVar);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Extract the caller-provided shared secret from a request, preferring HEADERS
 * over the query string. A `?secret=...` query param leaks into access/request
 * logs, proxies and browser history; an Authorization/header secret does not.
 *
 * Order: `Authorization: Bearer <secret>` → `x-webhook-secret` header → the
 * legacy `?secret=` query param. The query fallback is kept ONLY so already-
 * configured cron/Postmark URLs keep working through the cutover — migrate those
 * to send the header (see docs/DEPLOYMENT.md) to fully close the leak.
 */
export function providedSecret(req: {
  headers: { get(name: string): string | null };
  nextUrl?: { searchParams: { get(name: string): string | null } };
}): string | null {
  const auth = req.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const header = req.headers.get("x-webhook-secret");
  if (header) return header;
  return req.nextUrl?.searchParams.get("secret") ?? null;
}

/** Resolve a required secret, throwing in production if it's missing. */
export function requireSecret(envVar: string | undefined, name: string): string {
  if (!envVar) {
    if (failClosed()) throw new Error(`${name} must be set in production`);
    return `dev-${name}`; // deterministic dev fallback, never reached in prod
  }
  return envVar;
}
