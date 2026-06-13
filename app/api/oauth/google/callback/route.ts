// Google OAuth callback (Phase 10.5). Verifies the CSRF state against the
// signed cookie (and the tenant binding), exchanges the code for tokens,
// upserts the tenant's MailboxConnection with the tokens ENCRYPTED, then
// redirects to settings with a result flag. Never logs tokens.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { exchangeCode, GMAIL_SEND_SCOPE, isConfigured } from "@/lib/oauth/google";
import { OAUTH_STATE_COOKIE, verifyState } from "@/lib/oauth/state";
import { encryptToken } from "@/lib/crypto/tokens";

export const dynamic = "force-dynamic";

function settingsRedirect(req: Request, query: string): NextResponse {
  const url = new URL("/dashboard/settings", req.url);
  url.search = query;
  const res = NextResponse.redirect(url);
  // One-shot state cookie — clear it whatever the outcome.
  res.cookies.delete(OAUTH_STATE_COOKIE);
  return res;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error"); // e.g. access_denied

  if (oauthError) {
    return settingsRedirect(req, `?mailbox=error&reason=${encodeURIComponent(oauthError)}`);
  }
  if (!isConfigured()) {
    return settingsRedirect(req, "?mailbox=unavailable");
  }
  if (!code || !state) {
    return settingsRedirect(req, "?mailbox=error&reason=missing");
  }

  let business;
  try {
    business = await getCurrentBusiness();
  } catch {
    return settingsRedirect(req, "?mailbox=error&reason=auth");
  }

  // CSRF: the state from Google must match the signed cookie AND verify against
  // this tenant — neither alone is enough.
  const cookieState = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${OAUTH_STATE_COOKIE}=`))
    ?.slice(OAUTH_STATE_COOKIE.length + 1);
  if (!cookieState || cookieState !== state || !verifyState(state, business.id)) {
    return settingsRedirect(req, "?mailbox=error&reason=state");
  }

  let tokens;
  try {
    tokens = await exchangeCode(code);
  } catch {
    // Friendly — never echo Google's raw error or any token material.
    return settingsRedirect(req, "?mailbox=error&reason=exchange");
  }

  // gmail.send must be in the granted scopes or sending will 403 later.
  if (!tokens.scope.split(/\s+/).includes(GMAIL_SEND_SCOPE)) {
    return settingsRedirect(req, "?mailbox=error&reason=scope");
  }

  await db.mailboxConnection.upsert({
    where: { businessId: business.id },
    create: {
      businessId: business.id,
      provider: "GOOGLE",
      email: tokens.email,
      accessTokenEnc: encryptToken(tokens.access),
      refreshTokenEnc: encryptToken(tokens.refresh),
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
      status: "CONNECTED",
    },
    update: {
      provider: "GOOGLE",
      email: tokens.email,
      accessTokenEnc: encryptToken(tokens.access),
      refreshTokenEnc: encryptToken(tokens.refresh),
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
      status: "CONNECTED",
      lastError: null,
      connectedAt: new Date(),
    },
  });

  return settingsRedirect(req, "?mailbox=connected");
}
