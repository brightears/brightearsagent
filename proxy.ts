import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { canonicalRedirectTarget } from "@/lib/canonical-host";

// Signed-in-only surfaces. Marketing pages, the demo API, the inbound webhook,
// crons and opt-out stay public (the latter are shared-secret-gated instead).
//
// /api/oauth/google/* is tenant-scoped (start + callback both resolve the
// signed-in artist via getCurrentBusiness) — protect it so the OAuth flow runs
// under the Clerk session. The Google round-trip is a normal top-level GET
// redirect (no preflight), so Clerk protection doesn't break it: the browser
// returns to /callback carrying the session cookie.
const isProtected = createRouteMatcher([
  "/dashboard(.*)",
  "/onboarding(.*)",
  "/api/onboarding(.*)",
  "/api/oauth(.*)",
]);

const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

/**
 * Post-cutover duplicate-content trap (audit 2026-07): after the apex domain
 * takes over, the Render service keeps serving the full app on its
 * .onrender.com host — a second, indexable copy of the site. 301 every
 * onrender.com request to the canonical origin, preserving path + query.
 * A no-op until cutover: today APP_URL IS the onrender host, so the origins
 * match and nothing redirects. Runs before any auth logic; on the canonical
 * host it never fires, so Clerk is untouched.
 *
 * /api/* is DELIBERATELY EXEMPT (cutover audit 2026-07-27). Webhook providers
 * register an absolute URL with us, and a redirect is not a delivery:
 *   - a 301/302 on a POST is rewritten to GET with the body DROPPED, so a
 *     redirected Postmark inbound parse would arrive empty — every forwarded
 *     lead silently lost;
 *   - Stripe does not follow redirects at all, it just records a failed
 *     delivery, so subscription events would stop flipping plans.
 * Serving /api on BOTH hosts is therefore the safe behavior, and it doubles as
 * the cutover safety net: a webhook still pointed at the old host keeps working
 * until it is re-registered. Only human/crawler-facing GETs get canonicalized.
 */
function stagingHostRedirect(req: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV !== "production") return null;
  // Render terminates TLS in front of the app — trust the forwarded host over
  // whatever the internal hop carries.
  const target = canonicalRedirectTarget({
    method: req.method,
    pathname: req.nextUrl.pathname,
    search: req.nextUrl.search,
    host: req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "",
    appUrl: process.env.APP_URL,
  });
  return target ? NextResponse.redirect(target, 301) : null;
}

// Guard against the silent-disable trap (audit B3-NF): if the publishable key is
// missing in PRODUCTION the guard can't authenticate, so we must NOT fall back
// to passing everything through — that would serve /dashboard, /onboarding and
// the tenant /api/oauth routes publicly (with lib/tenant.ts defaulting to the
// demo business). Log loudly so it's caught.
if (!clerkEnabled && process.env.NODE_ENV === "production") {
  console.error(
    JSON.stringify({
      level: "error",
      kind: "clerk_not_configured",
      message:
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY missing in production — protected routes are blocked (503) to fail closed.",
      ts: new Date().toISOString(),
    }),
  );
}

// With Clerk keys: enforce auth on protected routes. Without them in dev/CI: run
// single-tenant (demo business) and allow. Without them in PROD: fail closed —
// block protected surfaces rather than expose tenant data.
export default clerkEnabled
  ? clerkMiddleware(async (auth, req) => {
      // Host canonicalization first — a stale onrender.com URL must 301 before
      // any auth decision (the canonical host is where the session lives).
      const hostRedirect = stagingHostRedirect(req);
      if (hostRedirect) return hostRedirect;
      if (!isProtected(req)) return;
      // "Get started" must land NEW visitors on sign-UP, not sign-in (audit
      // 2026-07: every marketing CTA 307'd to a sign-in screen — the wrong
      // label at peak intent). Only /onboarding gets this treatment; deep
      // links into /dashboard remain returning-customer sign-in.
      // Clerk's own helper, NOT a hand-built URL off NEXT_PUBLIC_CLERK_SIGN_UP_URL
      // (cutover audit 2026-07-27). Hand-building was wrong twice over: it set
      // redirect_url from req.url, which in middleware is the internal origin
      // Render dials (http://localhost:10000), bouncing every completed signup
      // to a dead host; and it pinned the funnel to whatever instance that env
      // var named — the DEV one — so after the pk_live swap new artists would
      // still have created accounts on the development instance. redirectToSignUp
      // derives both the host (from x-forwarded-host) and the instance (from the
      // active keys), so the production swap needs no env change at all.
      const { userId, redirectToSignUp } = await auth();
      if (!userId && req.nextUrl.pathname.startsWith("/onboarding")) {
        return redirectToSignUp();
      }
      await auth.protect();
    })
  : function proxy(req: NextRequest) {
      const hostRedirect = stagingHostRedirect(req);
      if (hostRedirect) return hostRedirect;
      if (process.env.NODE_ENV === "production" && isProtected(req)) {
        return new NextResponse("Authentication is not configured.", { status: 503 });
      }
      return NextResponse.next();
    };

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|txt|xml)).*)",
    "/(api|trpc)(.*)",
  ],
};
