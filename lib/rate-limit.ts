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

/**
 * The visitor's address, for per-IP limits.
 *
 * Getting this wrong is silent in both directions, and we have now had it wrong
 * both ways. Trusting the LEFT-most x-forwarded-for hop lets anyone spoof
 * ("X-Forwarded-For: fake" — the proxy simply appends the real address after
 * it) and evade every limit. Taking the RIGHT-most hop, which was the fix for
 * that, turned out to be worse in practice: production is Render behind
 * Cloudflare, so the right-most hop is Cloudflare's edge node, shared by
 * everyone. Measured live on 2026-07-29:
 *
 *   x-forwarded-for:  27.130.34.170, 172.68.232.160   ← 172.68.x = Cloudflare
 *   cf-connecting-ip: 27.130.34.170                   ← the actual visitor
 *
 * So every "per IP" bucket was one global bucket: the homepage demo capped at
 * 5 uses per DAY for the entire internet, on the primary conversion surface,
 * telling visitor six they had used their free demo.
 *
 * cf-connecting-ip is the answer. Cloudflare sets it to the true client address
 * and OVERWRITES anything the client sent, so it cannot be spoofed while
 * Cloudflare is in front — and on Render it always is; the origin is not
 * reachable directly. true-client-ip is the same value under Cloudflare's
 * enterprise name and is kept as a second source.
 *
 * The x-forwarded-for fallback only runs if neither is present. It takes the
 * second-from-right hop — the address the single trusted proxy actually saw —
 * and only falls back to the right-most when there is nothing else, which
 * over-groups rather than letting anyone spoof. Over-grouping degrades a limit;
 * spoofing removes it.
 */
export function clientIp(req: { headers: { get(name: string): string | null } }): string {
  const cf = req.headers.get("cf-connecting-ip") ?? req.headers.get("true-client-ip");
  if (cf?.trim()) return cf.trim();

  const xff = req.headers.get("x-forwarded-for");
  if (!xff) return "unknown";
  const hops = xff.split(",").map((h) => h.trim()).filter(Boolean);
  if (!hops.length) return "unknown";
  return hops.length >= 2 ? hops[hops.length - 2] : hops[0];
}
