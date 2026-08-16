import { db } from "@/lib/db";

export type GlobalSuppressionReason =
  | "unsubscribe"
  | "cease-and-desist"
  | "spam-complaint"
  | "hard-bounce"
  | "invalid-recipient";
export type OutreachSuppressionScope = "global" | "tenant" | null;

/** Canonical storage/lookup form used by both suppression tables. */
export function normalizeOutreachEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Product-wide wins over tenant-local. Keeping the scope is useful for logs
 * and tests, while callers normally need only a truthy hard stop.
 */
export async function outreachSuppressionScope(
  businessId: string,
  rawEmail: string,
): Promise<OutreachSuppressionScope> {
  const email = normalizeOutreachEmail(rawEmail);
  if (!email) return null;

  const global = await db.globalOutreachSuppression.findUnique({
    where: { email },
    select: { id: true },
  });
  if (global) return "global";

  const tenant = await db.outreachSuppression.findUnique({
    where: { businessId_email: { businessId, email } },
    select: { id: true },
  });
  return tenant ? "tenant" : null;
}

/**
 * Global upsert payload for explicit recipient stops and definitive delivery
 * failures. A later bounce/unsubscribe never downgrades an existing C&D or
 * complaint; a stronger recipient-authored event upgrades the audit reason.
 */
export function globalSuppressionUpsertArgs(input: {
  email: string;
  reason: GlobalSuppressionReason;
  business: { id: string };
}) {
  const email = normalizeOutreachEmail(input.email);
  const source = {
    sourceBusinessId: input.business.id,
  };
  return {
    where: { email },
    create: { email, reason: input.reason, ...source },
    // Recipient-authored escalations replace an older delivery failure or
    // ordinary unsubscribe. Delivery failures and unsubscribe never overwrite
    // an existing C&D / complaint with a weaker reason.
    update:
      input.reason === "cease-and-desist" || input.reason === "spam-complaint"
        ? { reason: input.reason, ...source }
        : {},
  } as const;
}

/** Tenant-side companion payload for recipient stops and delivery failures. */
export function tenantSuppressionUpsertArgs(input: {
  businessId: string;
  email: string;
  reason: GlobalSuppressionReason;
}) {
  const email = normalizeOutreachEmail(input.email);
  return {
    where: { businessId_email: { businessId: input.businessId, email } },
    create: { businessId: input.businessId, email, reason: input.reason },
    update: { reason: input.reason },
  } as const;
}
