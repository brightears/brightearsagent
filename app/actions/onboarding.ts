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
import { scheduleActivationScan } from "@/lib/discovery/activation";
import { isAllowedCountry, currencyForCountry } from "@/lib/geo/countries";
import { residencyDates, WEEKDAY_NAMES } from "@/lib/calendar/residency";
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
  homeCity: z
    .string()
    .trim()
    .min(1, "Tell us your home city — it's where the agent hunts first")
    .max(80, "That looks like more than a city name"),
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
  homeCity: string;
  timezone: string;
  websiteUrl: string;
}): Promise<ActionResult> {
  const business = await getCurrentBusiness();

  const parsed = basicsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  // Home base = serviceCities[0]. Replace only the first slot and dedupe —
  // extra cities and their order (Control Room "Where you hunt") stay intact
  // when someone revisits step 1.
  const { homeCity, ...basics } = parsed.data;
  const extraCities = business.serviceCities
    .slice(1)
    .filter((c) => c.toLowerCase() !== homeCity.toLowerCase());
  const hadNoCities = business.serviceCities.length === 0;

  // Derive the artist's fee currency from their country (THB for Thailand) so
  // the drafter quotes clients in local money — separate from USD billing.
  await db.business.update({
    where: { id: business.id },
    data: {
      ...basics,
      currency: currencyForCountry(basics.country),
      serviceCities: [homeCity, ...extraCities],
    },
  });

  // First city ever: hunt NOW, not at tomorrow's 05:00 UTC cron — day one is
  // the trial. Bounded: only fires when serviceCities was empty, and the
  // scan's own guards refuse unsubscribed tenants (no spend on free users).
  if (hadNoCities) scheduleActivationScan(business.id, { force: true });

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Step 2 — Who you are (artist profile + the work/pricing dials)
// Replaced the package builder (June 2026 redesign): captures WHO the artist is
// so the Hunt matches WIDER, plus the non-narrowing dials. Touches ONLY these
// fields — never clobbers media/voice/serviceCities owned by other steps.
// ---------------------------------------------------------------------------

const GIG_TYPES = ["one-off", "residency"] as const;

/** Whole currency units (what the form takes) → cents; null blank; "invalid" garbage. */
function feeToCents(raw: string): number | null | "invalid" {
  const v = raw.trim();
  if (v === "") return null;
  const n = Number(v.replace(/[,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return "invalid";
  return Math.round(n * 100);
}

const artistProfileSchema = z.object({
  headline: z
    .string()
    .trim()
    .min(1, "Give yourself a one-line description — the first thing a venue reads")
    .max(80, "Keep it to one line — under 80 characters"),
  bio: z.string().trim().max(2000, "That bio is a press release — keep it to ~120 words"),
  riderNotes: z.string().trim().max(2000, "Keep your setup notes to a paragraph or two"),
});

/**
 * Lenient link splitter for the OPTIONAL onboarding link fields — paste-friendly
 * (newline or comma separated), bare domains get https://, deduped + capped. No
 * hard rejection: these are optional, and a validation wall mid-onboarding is
 * exactly the friction the redesign removed. The Control Room editor enforces
 * strict z.url() later when the artist polishes the profile.
 */
function splitLinks(raw: string, max: number): string[] {
  return [
    ...new Set(
      raw
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => (/^https?:\/\//i.test(s) ? s : `https://${s}`)),
    ),
  ].slice(0, max);
}

export async function saveArtistProfile(input: {
  genres: string;
  headline: string;
  bio: string;
  videoLinks: string;
  socialLinks: string;
  photoUrls: string[];
  riderNotes: string;
  gigTypes: string[];
  acceptsTravel: boolean;
  feeFloor: string;
  residencyRate: string;
}): Promise<ActionResult> {
  const business = await getCurrentBusiness();

  const parsed = artistProfileSchema.safeParse({
    headline: input.headline,
    bio: input.bio,
    riderNotes: input.riderNotes,
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const genres = [
    ...new Set(input.genres.split(",").map((s) => s.trim()).filter(Boolean)),
  ].slice(0, 20);
  if (genres.length === 0) {
    return { ok: false, error: "Add at least one genre or style — it's how the agent matches you" };
  }

  const feeFloor = feeToCents(input.feeFloor);
  if (feeFloor === "invalid") return { ok: false, error: "Your floor should be a plain number" };
  if (feeFloor === null) {
    return { ok: false, error: "Set your one-off floor — the agent never pitches below it" };
  }
  const residencyRate = feeToCents(input.residencyRate);
  if (residencyRate === "invalid") {
    return { ok: false, error: "Residency rate should be a plain number" };
  }

  await db.business.update({
    where: { id: business.id },
    data: {
      genres,
      headline: parsed.data.headline,
      bio: parsed.data.bio || null,
      videoLinks: splitLinks(input.videoLinks, 6),
      socialLinks: splitLinks(input.socialLinks, 12),
      // Uploaded R2 image URLs — already minted by our presigned-upload route,
      // so they're trusted; just dedupe + cap.
      photoUrls: [...new Set(input.photoUrls.filter((u) => typeof u === "string" && u))].slice(0, 24),
      riderNotes: parsed.data.riderNotes || null,
      gigTypes: GIG_TYPES.filter((t) => input.gigTypes.includes(t)),
      acceptsTravel: input.acceptsTravel,
      feeFloor,
      residencyRate,
    },
  });

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath(`/epk/${business.slug}`);
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
  greeting: z.string().trim().max(120, "Keep your greeting short").transform((s) => s || null),
  signoff: z.string().trim().max(120, "Keep your sign-off short").transform((s) => s || null),
  phrases: z.string().trim().max(300, "A few phrases is plenty").transform((s) => s || null),
});

// "Skip for now" variant: no samples required. Everything else validates the
// same, so a skipper's tone chips and quick-check answers still count.
const voiceSkipSchema = voiceSchema.extend({
  samples: z.string().trim().max(20_000, "That's plenty! Trim it to your 2-3 favourite replies"),
});

/**
 * Saves pasted past replies to Business.voiceSamples (selected tone chips are
 * appended as a bracketed tone note the drafter reads), plus the structured
 * voice signals (greeting/sign-off/emoji/phrases) the drafter uses as explicit
 * rules. Touches only the voice fields.
 *
 * `skipped` (the wizard's "Skip for now"): performers without old replies at
 * hand shouldn't bounce off a 20-character wall at the top of the funnel.
 * A skip writes NO samples (never clobbers existing ones) and guarantees a
 * professional default greeting/sign-off so the drafter — and setup-complete
 * (lib/onboarding-status.ts) — have a voice to work with. The profile-strength
 * meter keeps nagging for real samples; that's intended.
 */
export async function saveVoiceSamples(input: {
  samples: string;
  tones: string[];
  greeting: string;
  signoff: string;
  emoji: boolean | null;
  phrases: string;
  skipped?: boolean;
}): Promise<ActionResult> {
  const business = await getCurrentBusiness();

  const parsed = (input.skipped ? voiceSkipSchema : voiceSchema).safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const { samples, tones } = parsed.data;
  const toneNote = tones.length > 0 ? `\n\n[Tone: ${tones.join(", ")}]` : "";

  await db.business.update({
    where: { id: business.id },
    data: {
      // Skip never clobbers samples someone saved on an earlier visit; with
      // samples present this behaves exactly as before.
      voiceSamples: input.skipped && !samples ? undefined : `${samples}${toneNote}`,
      voiceGreeting: parsed.data.greeting ?? (input.skipped ? "Hi [name]," : null),
      voiceSignoff: parsed.data.signoff ?? (input.skipped ? "Best regards" : null),
      voiceUsesEmoji: input.emoji,
      voicePhrases: parsed.data.phrases,
    },
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

// ---------------------------------------------------------------------------
// Step 4 (residency) — a recurring slot ("every Wednesday at Venue A") expanded
// into individual booked nights, so the availability check just works.
// ---------------------------------------------------------------------------

// Optional "HH:MM", or "" (which becomes null = an all-day booking).
const optionalTime = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 19:00")
  .optional()
  .or(z.literal(""));

const residencySchema = z.object({
  weekday: z.number().int().min(0).max(6),
  title: z.string().trim().min(1, "Add the venue or a name for the residency").max(120, "Keep the name short"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick an end date"),
  startTime: optionalTime,
  endTime: optionalTime,
});

export async function addResidency(input: {
  weekday: number;
  title: string;
  from: string;
  to: string;
  startTime?: string;
  endTime?: string;
}): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  const business = await getCurrentBusiness();

  const parsed = residencySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { weekday, title, from, to } = parsed.data;
  if (from > to) return { ok: false, error: "The end date is before the start date" };

  const dates = residencyDates(weekday, from, to);
  if (dates.length === 0) {
    return { ok: false, error: `No ${WEEKDAY_NAMES[weekday]}s fall in that range` };
  }

  // A time makes it a windowed commitment (7-9pm slot) rather than an all-day
  // block, so the artist stays quotable for a late gig elsewhere that night.
  const startTime = parsed.data.startTime || null;
  const endTime = parsed.data.endTime || null;

  // Noon-UTC convention (same as addBookedDates), one Gig per residency night.
  const { count } = await db.gig.createMany({
    data: dates.map((date) => ({
      businessId: business.id,
      date: new Date(`${date}T12:00:00Z`),
      title,
      startTime,
      endTime,
    })),
  });

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  return { ok: true, added: count };
}
