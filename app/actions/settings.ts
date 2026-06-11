"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { PerformerKind } from "@/app/generated/prisma/enums";

type ActionResult = { ok: true } | { ok: false; error: string };

/** Trimmed string or null — for the nullable Business columns. */
function optional(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
}

export async function updateBusiness(formData: FormData): Promise<ActionResult> {
  const business = await getCurrentBusiness();

  const name = optional(formData, "name");
  const ownerName = optional(formData, "ownerName");
  if (!name) return { ok: false, error: "Business name is required" };
  if (!ownerName) return { ok: false, error: "Your name is required" };

  const performerKindRaw = optional(formData, "performerKind");
  if (
    performerKindRaw &&
    !Object.values(PerformerKind).includes(performerKindRaw as PerformerKind)
  ) {
    return { ok: false, error: "Unknown performer type" };
  }

  const replyToEmail = optional(formData, "replyToEmail");
  if (replyToEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyToEmail)) {
    return { ok: false, error: "Reply-to address doesn't look like an email" };
  }

  const timezone = optional(formData, "timezone");
  if (timezone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    } catch {
      return { ok: false, error: "Unknown timezone" };
    }
  }

  await db.business.update({
    where: { id: business.id },
    data: {
      name,
      ownerName,
      replyToEmail,
      timezone: timezone ?? business.timezone,
      country: optional(formData, "country") ?? business.country,
      websiteUrl: optional(formData, "websiteUrl"),
      bookingLinkUrl: optional(formData, "bookingLinkUrl"),
      voiceSamples: optional(formData, "voiceSamples"),
      performerKind: (performerKindRaw as PerformerKind | null) ?? business.performerKind,
    },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Register (or refresh) a device for approve-from-phone push. Upserts on endpoint. */
export async function savePushSubscription(sub: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): Promise<ActionResult> {
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { ok: false, error: "Incomplete push subscription" };
  }
  const business = await getCurrentBusiness();
  await db.pushSubscription.upsert({
    where: { businessId_endpoint: { businessId: business.id, endpoint: sub.endpoint } },
    create: {
      businessId: business.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
    update: {
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
  });
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  if (!endpoint) return { ok: false, error: "No endpoint given" };
  const business = await getCurrentBusiness();
  // Scoped to the current tenant — one tenant can never unregister another's device.
  await db.pushSubscription.deleteMany({
    where: { endpoint, businessId: business.id },
  });
  return { ok: true };
}
