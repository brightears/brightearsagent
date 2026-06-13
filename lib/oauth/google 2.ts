// Google OAuth (Phase 10.5) — minimal raw-fetch client for the gmail.send
// flow. NO googleapis SDK (keeps deps light; package.json has none). We request
// the MINIMAL restricted scope gmail.send ONLY — reply capture
// (gmail.readonly/modify) is a deferred later phase. openid + email ride along
// so the callback learns which address the artist connected.
//
// Redirect URI is derived from APP_URL with the deployed fallback (the exact
// epkUrlFor pattern) — the two URIs registered with Google are:
//   http://localhost:3057/api/oauth/google/callback
//   https://brightears-app.onrender.com/api/oauth/google/callback
//
// LOCAL NOTE: the client SECRET is added to Render directly, not .env.local —
// so locally isConfigured() is false and the start/callback routes show the
// "not configured" path. exchangeCode/refreshAccessToken only run once the
// secret is present (the deployed app).

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

/** gmail.send ONLY — restricted minimal scope. openid+email learn the address. */
export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const SCOPES = [GMAIL_SEND_SCOPE, "openid", "email"];

/** Deployed fallback mirrors epkUrlFor — APP_URL drives both. */
function appUrl(): string {
  return (process.env.APP_URL ?? "https://brightears-app.onrender.com").replace(/\/$/, "");
}

/** The exact redirect URI registered with Google (must match byte-for-byte). */
export function redirectUri(): string {
  return `${appUrl()}/api/oauth/google/callback`;
}

/** Both env vars present — the gate for live token exchange. */
export function isConfigured(): boolean {
  return !!process.env.GOOGLE_OAUTH_CLIENT_ID && !!process.env.GOOGLE_OAUTH_CLIENT_SECRET;
}

function clientId(): string {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!id) throw new Error("GOOGLE_OAUTH_CLIENT_ID is not set");
  return id;
}

function clientSecret(): string {
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!secret) throw new Error("GOOGLE_OAUTH_CLIENT_SECRET is not set");
  return secret;
}

/**
 * The Google consent-screen URL. access_type=offline + prompt=consent so a
 * REFRESH token is always returned (Google omits it on re-consent otherwise),
 * which we need for long-lived sending. `state` is the CSRF token the caller
 * binds to the tenant via a signed cookie.
 */
export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
    include_granted_scopes: "true",
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface ExchangedTokens {
  access: string;
  refresh: string;
  /** Absolute expiry instant of the access token. */
  expiresAt: Date;
  /** The connected mailbox address (From + Reply-To on sends). */
  email: string;
  /** Granted scopes (space-joined) — audited to include gmail.send. */
  scope: string;
}

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

/** fetch seam — tests inject a stub so no real network call is made. */
type FetchLike = typeof fetch;

/**
 * Exchange an auth code for tokens, then resolve the connected email via the
 * userinfo endpoint. Throws (friendly) on any Google error — the callback maps
 * that to ?mailbox=error. Never logs the token payload.
 */
export async function exchangeCode(
  code: string,
  fetchImpl: FetchLike = fetch,
): Promise<ExchangedTokens> {
  const res = await fetchImpl(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }).toString(),
  });
  const data = (await res.json()) as GoogleTokenResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(`Google token exchange failed: ${data.error ?? res.status}`);
  }
  if (!data.refresh_token) {
    // prompt=consent should always return one; if it didn't, sending can't
    // survive token expiry — fail loudly rather than store a dead connection.
    throw new Error("Google did not return a refresh token — re-grant access");
  }

  const email = await fetchUserEmail(data.access_token, fetchImpl);
  return {
    access: data.access_token,
    refresh: data.refresh_token,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
    email,
    scope: data.scope ?? SCOPES.join(" "),
  };
}

/** Resolve the connected address from the OIDC userinfo endpoint. */
async function fetchUserEmail(accessToken: string, fetchImpl: FetchLike): Promise<string> {
  const res = await fetchImpl(USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as { email?: string };
  if (!res.ok || !data.email) {
    throw new Error("Could not read the connected Google address");
  }
  return data.email.toLowerCase();
}

export interface RefreshedToken {
  access: string;
  expiresAt: Date;
}

/**
 * Trade a refresh token for a fresh access token (refresh tokens don't expire
 * unless revoked). Throws on a dead/revoked token — the caller marks the
 * mailbox ERROR and asks the artist to reconnect.
 */
export async function refreshAccessToken(
  refreshToken: string,
  fetchImpl: FetchLike = fetch,
): Promise<RefreshedToken> {
  const res = await fetchImpl(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: "refresh_token",
    }).toString(),
  });
  const data = (await res.json()) as GoogleTokenResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(`Google token refresh failed: ${data.error ?? res.status}`);
  }
  return {
    access: data.access_token,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
  };
}
