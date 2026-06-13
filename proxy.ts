import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

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

// Without Clerk keys (CI, fresh clones) the app runs in dev single-tenant mode —
// lib/tenant.ts falls back to the demo business and nothing here blocks.
export default clerkEnabled
  ? clerkMiddleware(async (auth, req) => {
      if (isProtected(req)) await auth.protect();
    })
  : function proxy() {
      return NextResponse.next();
    };

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|txt|xml)).*)",
    "/(api|trpc)(.*)",
  ],
};
