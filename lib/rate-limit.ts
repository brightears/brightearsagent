// Lightweight in-memory fixed-window rate limiter (audit B10).
//
// Protects public/expensive endpoints (inbound parse, opt-out, onboarding poll)
// from abuse without a Redis dependency. State is per-process and resets on
// deploy/restart — adequate for a single Render instance; swap for a shared
// store (Redis/Upstash) if we ever run more than one instance.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/**
 * Returns { ok } for a given key within a rolling fixed window. When the limit
 * is exceeded, `retryAfterSec` is how long until the window resets.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    // Opportunistically prune expired buckets so the map can't grow unbounded.
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k);
    }
    return { ok: true, retryAfterSec: 0 };
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  bucket.count++;
  return { ok: true, retryAfterSec: 0 };
}

/** Best-effort client IP from the proxy header (Render sets x-forwarded-for). */
export function clientIp(req: { headers: { get(name: string): string | null } }): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
