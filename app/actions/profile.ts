"use server";

// Artist-profile actions (Phase 10.1) — the fields the sales agent pitches
// with and the hosted EPK renders. Tenant-scoped via getCurrentBusiness,
// zod-validated, touches ONLY profile fields (same isolation rule as
// app/actions/onboarding.ts — never clobber columns the form doesn't carry).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";

type ActionResult = { ok: true } | { ok: false; error: string };

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "That didn't look right — give it another go";
}

/** Comma-separated text input → trimmed, de-duped string list (v1 tag input). */
function splitList(value: FormDataEntryValue | null, max = 20): string[] {
  if (typeof value !== "string") return [];
  return [...new Set(value.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, max);
}

/** One URL per line (or comma-separated) → list. */
function splitUrls(value: FormDataEntryValue | null, max = 24): string[] {
  if (typeof value !== "string") return [];
  return [...new Set(value.split(/[\n,]/).map((s) => s.trim()).filter(Boolean))].slice(0, max);
}

/** One quote per line → list (quotes may contain commas). */
function splitLines(value: FormDataEntryValue | null, max = 3): string[] {
  if (typeof value !== "string") return [];
  return value.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, max);
}

/** Whole currency units (what the form takes) → cents, or null when blank. */
function toCents(value: FormDataEntryValue | null): number | null | "invalid" {
  if (typeof value !== "string" || value.trim() === "") return null;
  const n = Number(value.replace(/[,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return "invalid";
  return Math.round(n * 100);
}

/** The work-type dial — whitelist to the two real primitives, ignore anything else. */
const GIG_TYPES = ["one-off", "residency"] as const;
function parseGigTypes(values: FormDataEntryValue[]): string[] {
  const set = new Set(
    values.filter((v): v is string => typeof v === "string").map((v) => v.trim().toLowerCase()),
  );
  return GIG_TYPES.filter((t) => set.has(t));
}

const urlSchema = z.url("That doesn't look like a link — paste the full https:// URL");

const profileSchema = z.object({
  headline: z
    .string()
    .trim()
    .max(80, "Keep the headline under 80 characters — it's a one-liner")
    .transform((s) => s || null),
  bio: z
    .string()
    .trim()
    .max(2000, "That bio is a press release — keep it to ~120 words")
    .transform((s) => s || null),
  travelPolicy: z
    .string()
    .trim()
    .max(300, "Keep the travel policy to a sentence or two")
    .transform((s) => s || null),
  videoLinks: z.array(urlSchema).max(6, "Six videos is plenty — lead with your best"),
  photoUrls: z.array(urlSchema).max(24, "24 photos max — quality over quantity"),
  socialLinks: z.array(urlSchema).max(12, "A dozen links is plenty"),
  riderNotes: z
    .string()
    .trim()
    .max(2000, "Keep your setup notes to a paragraph or two")
    .transform((s) => s || null),
});

export async function updateArtistProfile(formData: FormData): Promise<ActionResult> {
  const business = await getCurrentBusiness();

  const parsed = profileSchema.safeParse({
    headline: formData.get("headline") ?? "",
    bio: formData.get("bio") ?? "",
    travelPolicy: formData.get("travelPolicy") ?? "",
    videoLinks: splitUrls(formData.get("videoLinks"), 6),
    photoUrls: splitUrls(formData.get("photoUrls"), 24),
    socialLinks: splitUrls(formData.get("socialLinks"), 12),
    riderNotes: formData.get("riderNotes") ?? "",
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const feeFloor = toCents(formData.get("feeFloor"));
  if (feeFloor === "invalid") return { ok: false, error: "Fee floor should be a plain number" };
  const feeSweetSpot = toCents(formData.get("feeSweetSpot"));
  if (feeSweetSpot === "invalid") {
    return { ok: false, error: "Sweet-spot fee should be a plain number" };
  }
  if (feeFloor !== null && feeSweetSpot !== null && feeSweetSpot < feeFloor) {
    return { ok: false, error: "Your sweet spot can't sit below your floor" };
  }
  const residencyRate = toCents(formData.get("residencyRate"));
  if (residencyRate === "invalid") {
    return { ok: false, error: "Residency rate should be a plain number" };
  }

  const pitchLanguages = splitList(formData.get("pitchLanguages"), 8).map((l) => l.toLowerCase());

  await db.business.update({
    where: { id: business.id },
    data: {
      ...parsed.data,
      genres: splitList(formData.get("genres")),
      eventTypes: splitList(formData.get("eventTypes")),
      // serviceCities is NOT edited here — the Control Room's "Where you hunt"
      // section owns it (updateHomeBase in app/actions/travel.ts). Leaving it
      // out keeps this action from clobbering it to [] when the profile form,
      // which no longer carries the field, is saved.
      notableVenues: splitList(formData.get("notableVenues")),
      reviewQuotes: splitLines(formData.get("reviewQuotes")),
      pitchLanguages: pitchLanguages.length > 0 ? pitchLanguages : ["en"],
      feeFloor,
      feeSweetSpot,
      gigTypes: parseGigTypes(formData.getAll("gigTypes")),
      acceptsTravel: formData.get("acceptsTravel") === "on",
      residencyRate,
      insured: formData.get("insured") === "on",
      epkEnabled: formData.get("epkEnabled") === "on",
    },
  });

  // The profile editor now lives in the Control Room (/dashboard/settings);
  // /dashboard/profile only redirects there.
  revalidatePath("/dashboard/settings");
  revalidatePath(`/epk/${business.slug}`);
  return { ok: true };
}
