import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

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
      if (isProtected(req)) await auth.protect();
    })
  : function proxy(req: NextRequest) {
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
