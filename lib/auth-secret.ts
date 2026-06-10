import { timingSafeEqual } from "node:crypto";

const isProd = process.env.NODE_ENV === "production";

/**
 * Shared-secret gate for internal endpoints (webhooks, cron). Fail-CLOSED in
 * production: if the secret env var is unset, reject — a missing secret must
 * never silently open an endpoint to the world. In dev, an unset secret allows
 * (so local testing needs no setup).
 */
export function checkSharedSecret(envVar: string | undefined, provided: string | null): boolean {
  if (!envVar) return !isProd; // prod + unset secret = denied
  if (!provided) return false;
  const a = Buffer.from(envVar);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Resolve a required secret, throwing in production if it's missing. */
export function requireSecret(envVar: string | undefined, name: string): string {
  if (!envVar) {
    if (isProd) throw new Error(`${name} must be set in production`);
    return `dev-${name}`; // deterministic dev fallback, never reached in prod
  }
  return envVar;
}
