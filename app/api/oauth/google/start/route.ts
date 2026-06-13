// Google OAuth start (Phase 10.5). Tenant-scoped: getCurrentBusiness resolves
// the signed-in artist (Clerk-protected via proxy.ts). We mint a CSRF state
// bound to the tenant, drop it in a short-lived signed httpOnly cookie, and
// 302 to Google's consent screen. If OAuth isn't configured on this
// environment (no client secret — the LOCAL case), bounce to settings with
// ?mailbox=unavailable instead of sending the artist to a broken Google flow.

import { NextResponse } from "next/server";
import { getCurrentBusiness } from "@/lib/tenant";
import { buildAuthUrl, isConfigured } from "@/lib/oauth/google";
import { createState, OAUTH_STATE_COOKIE } from "@/lib/oauth/state";

export const dynamic = "force-dynamic";

function settingsUrl(req: Request, query: string): URL {
  const url = new URL("/dashboard/settings", req.url);
  url.search = query;
  return url;
}

export async function GET(req: Request) {
  let business;
  try {
    business = await getCurrentBusiness();
  } catch {
    // Not signed in / no tenant — back to settings, no flow started.
    return NextResponse.redirect(settingsUrl(req, "?mailbox=error&reason=auth"));
  }

  if (!isConfigured()) {
    return NextResponse.redirect(settingsUrl(req, "?mailbox=unavailable"));
  }

  const state = createState(business.id);
  const res = NextResponse.redirect(buildAuthUrl(state));
  // Short-lived, httpOnly, lax (survives the top-level redirect back from
  // Google). Secure in production only (localhost is http).
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600, // 10 minutes — the consent screen lifetime
  });
  return res;
}
