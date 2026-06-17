"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { isAllowedCountry, currencyForCountry } from "@/lib/geo/countries";
import { toneNoteOf, withToneNote } from "@/lib/voice/tone-note";
import { AUTO_SEND_INELIGIBLE_SOURCES } from "@/lib/inbound/auto-send";
import { PerformerKind, LeadSource } from "@/app/generated/prisma/enums";

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

  // Blank = keep current. A submitted country must be real and non-sanctioned —
  // don't trust the client's dropdown (isAllowedCountry, lib/geo/countries.ts).
  const country = optional(formData, "country");
  if (country && !isAllowedCountry(country)) {
    return { ok: false, error: "Pick a country we can support" };
  }
  // Keep the artist's fee currency in lockstep with their country (THB for a
  // Thai act) — re-derived on every save so a country change carries it along.
  const resolvedCountry = country ?? business.country;

  await db.business.update({
    where: { id: business.id },
    data: {
      name,
      ownerName,
      replyToEmail,
      timezone: timezone ?? business.timezone,
      country: resolvedCountry,
      currency: currencyForCountry(resolvedCountry),
      websiteUrl: optional(formData, "websiteUrl"),
      bookingLinkUrl: optional(formData, "bookingLinkUrl"),
      performerKind: (performerKindRaw as PerformerKind | null) ?? business.performerKind,
    },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Save the owner's voice samples (Control Room "Voice & profile" section).
 * Split out of updateBusiness so the voice editor is its own writer — the
 * Control Room gives each section a single, non-overlapping action, so saving
 * one section can never clobber a column another section owns.
 *
 * The voice card strips the internal "[Tone: …]" marker for display, so re-
 * attach the existing tone here — otherwise editing the voice would silently
 * drop the tone preference the owner set during onboarding. Empty clears it
 * (tone and all).
 */
export async function updateVoice(formData: FormData): Promise<ActionResult> {
  const business = await getCurrentBusiness();
  const edited = optional(formData, "voiceSamples");
  const voiceSamples = edited === null ? null : withToneNote(edited, toneNoteOf(business.voiceSamples));
  await db.business.update({
    where: { id: business.id },
    data: { voiceSamples },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Save which lead sources the owner trusts for AUTO-SEND (Pro+ autonomy gate).
 * Stores the preference; enforcement is at send time (lib/inbound/auto-send.ts:
 * canAutoSend also checks the plan), so an unverified value never auto-sends on
 * its own. Validated to real LeadSource values and ToS-eligible ones only
 * (GigSalad can never be auto-sent — CLAUDE.md rule 4).
 */
export async function updateAutoSendSources(formData: FormData): Promise<ActionResult> {
  const business = await getCurrentBusiness();
  const allValues = Object.values(LeadSource) as string[];
  const chosen = formData
    .getAll("autoSendSources")
    .filter((v): v is string => typeof v === "string")
    .filter(
      (s): s is LeadSource =>
        allValues.includes(s) && !AUTO_SEND_INELIGIBLE_SOURCES.includes(s as LeadSource),
    );
  await db.business.update({
    where: { id: business.id },
    data: { autoSendSources: { set: [...new Set(chosen)] as LeadSource[] } },
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

/**
 * Disconnect the tenant's sending mailbox (Phase 10.5). We DELETE the row so
 * the encrypted tokens leave the database entirely (the cleanest revocation —
 * a REVOKED-but-kept row would still hold ciphertext). Tenant-scoped; one
 * tenant can never touch another's connection. Idempotent.
 */
export async function disconnectMailbox(): Promise<ActionResult> {
  const business = await getCurrentBusiness();
  await db.mailboxConnection.deleteMany({ where: { businessId: business.id } });
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Form-friendly wrapper (a <form action> must return void). */
export async function disconnectMailboxForm(): Promise<void> {
  await disconnectMailbox();
}
