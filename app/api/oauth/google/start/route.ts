// Google OAuth start (Phase 10.5). Tenant-scoped: getCurrentBusiness resolves
// the signed-in artist (Clerk-protected via proxy.ts). We mint a CSRF state
// bound to the tenant, drop it in a short-lived signed httpOnly cookie, and
// 302 to Google's consent screen. If OAuth isn't configured on this
// environment (no client secret — the LOCAL case), bounce to settings with
// ?mailbox=unavailable instead of sending the artist to a broken Google flow.

import { NextResponse } from "next/server";
import { getCurrentBusiness } from "@/lib/tenant";
import { appUrl, buildAuthUrl, isConfigured } from "@/lib/oauth/google";
import { createState, OAUTH_STATE_COOKIE } from "@/lib/oauth/state";
import { isTokenCryptoConfigured } from "@/lib/crypto/tokens";

export const dynamic = "force-dynamic";

function settingsUrl(_req: Request, query: string): URL {
  // PUBLIC base URL, never req.url (Render's internal host is localhost:10000).
  const url = new URL("/dashboard/settings", appUrl());
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

  // "Feature not enabled here" — no OAuth client (the LOCAL case). Muted note.
  if (!isConfigured()) {
    return NextResponse.redirect(settingsUrl(req, "?mailbox=unavailable"));
  }

  // SERVER MISCONFIG (distinct from "unavailable"): OAuth IS configured but the
  // token-encryption key is missing/malformed, so createState() (which HMACs on
  // that key) and the callback's encryptToken() would throw a raw 500. Bounce
  // with a DISTINCT error reason instead — honest "server misconfigured", not
  // the "feature off" wording.
  if (!isTokenCryptoConfigured()) {
    return NextResponse.redirect(settingsUrl(req, "?mailbox=error&reason=config"));
  }

  // Defensive: even with both guards green, anything key-dependent could throw
  // unexpectedly — redirect with the config error rather than surface a 500.
  // NEVER log tokens/secrets/codes in this catch.
  let state: string;
  try {
    state = createState(business.id);
  } catch {
    return NextResponse.redirect(settingsUrl(req, "?mailbox=error&reason=config"));
  }

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
