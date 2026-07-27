// The canonicalization decision, as a pure function — no Next types, no env
// reads — so it can actually be tested. proxy.ts wraps it with NextRequest /
// NextResponse. Extracted 2026-07-27 after the cutover audit found two bugs in
// the inlined version that no test could have caught, because there were none.
//
// WHY canonicalize at all: after the apex takes over, the Render service keeps
// serving the whole app on its .onrender.com host — a second, fully indexable
// copy of the site. Search engines must be sent to one origin.
//
// WHY the exemptions are load-bearing:
//   - non-GET: a 301/302 on a POST is rewritten to GET with the body DROPPED.
//     That silently guts Next server actions (which POST to the page URL) and
//     any webhook still addressed to the old host.
//   - /api/*: providers register an absolute URL with us and a redirect is not
//     a delivery — Stripe does not follow redirects at all, and a cross-origin
//     redirect strips the Authorization header our crons send. Serving /api on
//     both hosts is the correct behavior AND the cutover safety net, keeping
//     every integration alive until it is re-registered.
export function canonicalRedirectTarget(input: {
  method: string;
  pathname: string;
  search: string;
  /** Public host, already stripped of any port. */
  host: string;
  /** The canonical origin (APP_URL). */
  appUrl: string | undefined;
}): string | null {
  const { method, pathname, search, host, appUrl } = input;
  if (!appUrl) return null;
  if (method !== "GET" && method !== "HEAD") return null;
  if (pathname.startsWith("/api/")) return null;
  const from = host.split(":")[0].toLowerCase();
  if (!from.endsWith(".onrender.com")) return null;

  let canonical: URL;
  try {
    canonical = new URL(appUrl);
  } catch {
    return null; // malformed APP_URL — never turn every request into a crash
  }
  if (canonical.hostname.toLowerCase() === from) return null; // pre-cutover: same origin
  return new URL(pathname + search, canonical.origin).toString();
}
