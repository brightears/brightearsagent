import { createHmac, timingSafeEqual } from "node:crypto";
import { requireSecret } from "@/lib/auth-secret";

function secret(): string {
  // Throws in production if OPTOUT_SECRET is unset — a hardcoded fallback would
  // make every opt-out token publicly forgeable (mass mark-dead attack).
  return requireSecret(process.env.OPTOUT_SECRET, "OPTOUT_SECRET");
}

export function optoutToken(leadId: string): string {
  return createHmac("sha256", secret()).update(leadId).digest("hex").slice(0, 32);
}

export function verifyOptoutToken(leadId: string, token: string): boolean {
  const expected = optoutToken(leadId);
  if (token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export function optoutUrl(leadId: string): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base}/api/optout?lead=${leadId}&token=${optoutToken(leadId)}`;
}

/**
 * Compliance footer for follow-up emails (CAN-SPAM/PECR/CASL/Spam Act):
 * who's emailing, why, and a working opt-out. Appended at SEND time.
 */
export function complianceFooter(businessName: string, leadId: string): string {
  return [
    "",
    "—",
    `You're receiving this because you inquired with ${businessName}.`,
    `If you'd rather not hear from us again, no hard feelings: ${optoutUrl(leadId)}`,
  ].join("\n");
}
