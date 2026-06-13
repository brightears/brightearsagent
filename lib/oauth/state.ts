// OAuth CSRF state (Phase 10.5). The start route mints a random state, binds it
// to the tenant, and stores it in a short-lived signed cookie; the callback
// verifies the state from Google matches the signed cookie. Prevents an
// attacker from completing an OAuth flow against a victim's session.
//
// Signed with HMAC-SHA256 keyed on TOKEN_ENCRYPTION_KEY (already a strong
// server secret; fail-closed if absent). Payload = businessId|nonce so the
// callback can also assert the flow belongs to the same tenant.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { tokenKey } from "@/lib/crypto/tokens";

/** Cookie name for the signed state — short-lived, httpOnly. */
export const OAUTH_STATE_COOKIE = "be_oauth_state";

function sign(payload: string): string {
  return createHmac("sha256", tokenKey()).update(payload).digest("base64url");
}

/**
 * Mint a state token bound to a tenant. Shape: businessId.nonce.sig — the value
 * goes BOTH to Google (as ?state) and into the signed cookie; the callback
 * requires them to match and the signature to verify.
 */
export function createState(businessId: string): string {
  const nonce = randomBytes(16).toString("base64url");
  const payload = `${businessId}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

/**
 * Verify a state token's signature and (optionally) its tenant binding.
 * Returns the businessId on success, null on any mismatch/tamper. Constant-time
 * signature comparison.
 */
export function verifyState(state: string, expectBusinessId?: string): string | null {
  const parts = state.split(".");
  if (parts.length !== 3) return null;
  const [businessId, nonce, sig] = parts;
  if (!businessId || !nonce || !sig) return null;

  const expected = sign(`${businessId}.${nonce}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (expectBusinessId && businessId !== expectBusinessId) return null;
  return businessId;
}
