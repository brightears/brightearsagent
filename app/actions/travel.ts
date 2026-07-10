"use server";

// Travel Mode actions — the artist's Home Base (cities + radius) + Travel
// Windows manager (Control Room "Where you hunt" section). Tenant-scoped via
// getCurrentBusiness, zod-
// validated, never trusting the UI. A travel window makes the Hunt ALSO scan a
// destination city for those dates and draft date-bounded outreach
// (lib/discovery/scan.ts + lib/agent/venue-pitch.ts).
//
// packaging: founder decision — travel windows are included for ALL tiers for
// now (no per-tier count limits). Revisit with the pricing pass.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { isAllowedCountry } from "@/lib/geo/countries";
import { planFeatures } from "@/lib/billing/plan-features";
// Role tags live in a plain module — a "use server" file may only export async
// functions, so the const/type cannot be defined (or re-exported) here.
import { TRAVEL_ROLE_TAGS } from "@/lib/travel/roles";

// `notice` = a non-error heads-up to show on success (e.g. cities trimmed to cap).
type ActionResult = { ok: true; notice?: string } | { ok: false; error: string };

const idSchema = z.string().trim().min(1, "No window given").max(64);

/**
 * Parse a date-only string ("2026-08-04") into a UTC-midnight Date — the
 * date-only anchor the scan liveness/expiry checks compare against (so a
 * window entered as Aug 4-11 means exactly those calendar days, server-tz
 * independent). Rejects anything that isn't a real YYYY-MM-DD.
 */
function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  // Round-trip guard: rejects impossible dates (e.g. 2026-02-31 → Mar 3).
  if (
    date.getUTCFullYear() !== Number(y) ||
    date.getUTCMonth() !== Number(mo) - 1 ||
    date.getUTCDate() !== Number(d)
  ) {
    return null;
  }
  return date;
}

const dateOnly = z
  .string()
  .transform((v, ctx) => {
    const d = parseDateOnly(v);
    if (!d) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid date" });
      return z.NEVER;
    }
    return d;
  });

const addWindowSchema = z
  .object({
    city: z.string().trim().min(1, "City is required").max(120),
    // ISO-2 country, uppercased — drives the DESTINATION jurisdiction. Must be
    // a real, non-sanctioned country (isAllowedCountry) — never trust the
    // client to have shown only allowed options.
    country: z
      .string()
      .trim()
      .transform((c) => c.toUpperCase())
      .pipe(z.string().regex(/^[A-Z]{2}$/, "Pick a country"))
      .refine(isAllowedCountry, "We can't hunt in that country — pick another"),
    startDate: dateOnly,
    endDate: dateOnly,
    radiusKm: z
      .union([z.literal(""), z.coerce.number().int().positive().max(20000)])
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
    roleTags: z.array(z.enum(TRAVEL_ROLE_TAGS)).default([]),
  })
  // BOTH dates required (above) AND end ≥ start.
  .refine((v) => v.endDate.getTime() >= v.startDate.getTime(), {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  });

/** Read the multi-value roleTags checkboxes from a FormData. */
function readRoleTags(formData: FormData): string[] {
  return formData
    .getAll("roleTags")
    .filter((v): v is string => typeof v === "string");
}

/**
 * Add a travel window. Validates city, ISO-2 country, BOTH dates, end ≥ start.
 * The window starts ACTIVE — the next scan picks it up once it goes live
 * (now ∈ [startDate − lead, endDate]); a window entirely in the past is
 * rejected (its endDate already passed, nothing to hunt).
 */
export async function addTravelWindow(formData: FormData): Promise<ActionResult> {
  const parsed = addWindowSchema.safeParse({
    city: formData.get("city"),
    country: formData.get("country"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    radiusKm: formData.get("radiusKm") ?? "",
    roleTags: readRoleTags(formData),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the window details" };
  }
  const { city, country, startDate, endDate, radiusKm, roleTags } = parsed.data;

  // Reject a window that's already over (endDate before today, date-only) —
  // there's nothing left to hunt and it would auto-expire on the next scan.
  const todayUtc = new Date();
  const todayMidnight = new Date(
    Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate()),
  );
  if (endDate.getTime() < todayMidnight.getTime()) {
    return { ok: false, error: "That window is already in the past" };
  }

  const business = await getCurrentBusiness();
  await db.travelWindow.create({
    data: {
      businessId: business.id,
      city,
      country,
      startDate,
      endDate,
      radiusKm,
      roleTags,
      status: "ACTIVE",
    },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Form-friendly wrapper (a <form action> must return void). */
export async function addTravelWindowForm(formData: FormData): Promise<void> {
  await addTravelWindow(formData);
}

/**
 * Cancel a travel window: ACTIVE/EXPIRED → CANCELLED (tenant-scoped). The row
 * is kept for history; venues already discovered for it keep their tag. The
 * scan never touches a CANCELLED window again. Idempotent.
 */
export async function cancelTravelWindow(windowId: string): Promise<ActionResult> {
  const parsed = idSchema.safeParse(windowId);
  if (!parsed.success) return { ok: false, error: "No window given" };

  const business = await getCurrentBusiness();
  await db.travelWindow.updateMany({
    where: { id: parsed.data, businessId: business.id, status: { not: "CANCELLED" } },
    data: { status: "CANCELLED" },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Form-friendly wrapper (a <form action> must return void). */
export async function cancelTravelWindowForm(windowId: string): Promise<void> {
  await cancelTravelWindow(windowId);
}

/**
 * Save the artist's Home Base — the cities they're based in (serviceCities,
 * which gate where the Hunt scans) plus the advisory travel radius
 * (Business.homeRadiusKm). The Control Room's "Where you hunt" section owns
 * BOTH, in one form with one Save, so home base is edited exactly where it's
 * used. serviceCities used to live on the profile form; it moved here to make
 * "where you hunt" a single source of truth.
 *
 * The radius is advisory only for now — the UI shows it; scan scoping doesn't
 * act on it yet. Empty radius clears it. Empty cities clears them (the agent
 * then has no home cities to hunt — the strength meter flags that).
 */
const homeRadiusSchema = z
  .union([z.literal(""), z.coerce.number().int().positive().max(20000)])
  .transform((v) => (v === "" ? null : v));

/** Comma-separated text → trimmed, de-duped city list (mirrors profile.ts splitList).
 *  max is a SANITY bound only — it must sit above the largest plan homeCityCap
 *  (Studio 25), or the plan-cap slice below can never see (and honestly report
 *  trimming) everything the owner typed. Audit 2026-07: it was 20, silently
 *  eating Studio's 21st-25th cities. */
function splitCities(value: FormDataEntryValue | null, max = 100): string[] {
  if (typeof value !== "string") return [];
  return [...new Set(value.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, max);
}

export async function updateHomeBase(formData: FormData): Promise<ActionResult> {
  const parsedRadius = homeRadiusSchema.safeParse(formData.get("homeRadiusKm") ?? "");
  if (!parsedRadius.success) {
    return { ok: false, error: "Enter a radius in km, or leave it blank" };
  }

  const business = await getCurrentBusiness();
  // Coverage gate (effort-based pricing): the plan caps how many HOME cities the
  // Hunt scans. Trim here so the saved list never exceeds it, and tell the owner
  // what landed when we trimmed — don't silently drop cities they typed.
  const cap = planFeatures(business.plan).homeCityCap;
  const requested = splitCities(formData.get("serviceCities"));
  const serviceCities = requested.slice(0, cap);
  await db.business.update({
    where: { id: business.id },
    data: {
      serviceCities,
      homeRadiusKm: parsedRadius.data,
    },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return requested.length > cap
    ? {
        ok: true,
        notice: `Your plan covers ${cap} ${cap === 1 ? "city" : "cities"} — saved the first ${cap}. Upgrade to hunt more.`,
      }
    : { ok: true };
}
