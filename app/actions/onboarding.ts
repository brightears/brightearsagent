"use server";

// Onboarding wizard actions. Steps that map 1:1 onto existing actions reuse
// them (packages → app/actions/packages.ts createPackage); these cover what's
// missing. All tenant-scoped via getCurrentBusiness, zod-validated.
//
// Deliberately NOT reusing settings.ts updateBusiness for step 1: it writes
// voiceSamples/replyToEmail from the form too, so calling it from a step-1
// form (which has neither field) would null out voice samples saved in step 3
// when someone revisits step 1. These actions each touch only their own fields.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { isAllowedCountry, currencyForCountry } from "@/lib/geo/countries";
import { PerformerKind } from "@/app/generated/prisma/enums";

type ActionResult = { ok: true } | { ok: false; error: string };

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "That didn't look right — give it another go";
}

// ---------------------------------------------------------------------------
// Step 1 — Your business
// ---------------------------------------------------------------------------

const basicsSchema = z.object({
  name: z.string().trim().min(1, "Your business needs a name"),
  ownerName: z.string().trim().min(1, "Tell us your name"),
  performerKind: z.enum(PerformerKind, "Pick what you perform"),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Pick a country")
    // Real, non-sanctioned country — don't trust the client's dropdown.
    .refine(isAllowedCountry, "Pick a country we can support"),
  timezone: z
    .string()
    .trim()
    .min(1, "Pick a timezone")
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Unknown timezone"),
  websiteUrl: z
    .string()
    .trim()
    .max(200, "That's a long URL — double-check it")
    // "" → null; bare domains get https:// so the drafter can link it.
    .transform((v) => (v === "" ? null : /^https?:\/\//i.test(v) ? v : `https://${v}`))
    .refine((v) => {
      if (v === null) return true;
      try {
        new URL(v);
        return true;
      } catch {
        return false;
      }
    }, "That website address doesn't look right"),
});

export async function saveBusinessBasics(input: {
  name: string;
  ownerName: string;
  performerKind: string;
  country: string;
  timezone: string;
  websiteUrl: string;
}): Promise<ActionResult> {
  const business = await getCurrentBusiness();

  const parsed = basicsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  // Derive the artist's fee currency from their country (THB for Thailand) so
  // the drafter quotes clients in local money — separate from USD billing.
  await db.business.update({
    where: { id: business.id },
    data: { ...parsed.data, currency: currencyForCountry(parsed.data.country) },
  });

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Step 3 — Your voice
// ---------------------------------------------------------------------------

const TONE_HINTS = ["Fun & casual", "Warm & professional", "High-energy"] as const;

const voiceSchema = z.object({
  samples: z
    .string()
    .trim()
    .min(20, "Paste at least a sentence or two — real replies you've sent work best")
    .max(20_000, "That's plenty! Trim it to your 2-3 favourite replies"),
  tones: z.array(z.enum(TONE_HINTS)).max(TONE_HINTS.length),
});

/**
 * Saves pasted past replies to Business.voiceSamples; selected tone chips are
 * appended as a bracketed tone note the drafter reads alongside the samples.
 */
export async function saveVoiceSamples(input: {
  samples: string;
  tones: string[];
}): Promise<ActionResult> {
  const business = await getCurrentBusiness();

  const parsed = voiceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const { samples, tones } = parsed.data;
  const toneNote = tones.length > 0 ? `\n\n[Tone: ${tones.join(", ")}]` : "";

  await db.business.update({
    where: { id: business.id },
    data: { voiceSamples: `${samples}${toneNote}` },
  });

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Step 4 — Your calendar (bulk add of already-booked dates)
// ---------------------------------------------------------------------------

const bookedDatesSchema = z
  .array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Each booked date needs a real date"),
      title: z
        .string()
        .trim()
        .min(1, "Each booked date needs a short title")
        .max(120, "Keep titles short — under 120 characters"),
    }),
  )
  .min(1, "Add at least one date (or skip this step for now)")
  .max(50, "Up to 50 dates here — add the rest from your Calendar page");

export async function addBookedDates(
  input: { date: string; title: string }[],
): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  const business = await getCurrentBusiness();

  const parsed = bookedDatesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  // Date convention (whole codebase, see app/actions/gigs.ts + lib/agent/availability.ts):
  // store the local calendar date as NOON UTC so the ISO day slice is tz-stable.
  const { count } = await db.gig.createMany({
    data: parsed.data.map((row) => ({
      businessId: business.id,
      date: new Date(`${row.date}T12:00:00Z`),
      title: row.title,
    })),
  });

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  return { ok: true, added: count };
}
