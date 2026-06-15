"use server";

// Travel Mode actions — the artist's Home Base radius + Travel Windows manager
// (settings "Where you hunt" card). Tenant-scoped via getCurrentBusiness, zod-
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

type ActionResult = { ok: true } | { ok: false; error: string };

// The role tags an owner may attach to a window (what kind of work to hunt).
export const TRAVEL_ROLE_TAGS = ["guest-spot", "residency", "private-event"] as const;
export type TravelRoleTag = (typeof TRAVEL_ROLE_TAGS)[number];

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
    // ISO-2 country, uppercased — drives the DESTINATION jurisdiction.
    country: z
      .string()
      .trim()
      .transform((c) => c.toUpperCase())
      .pipe(z.string().regex(/^[A-Z]{2}$/, "Pick a country")),
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
 * Save the advisory Home Base radius (Business.homeRadiusKm). Empty clears it.
 * Advisory only for now — the UI shows it; scan scoping doesn't act on it yet.
 */
const homeRadiusSchema = z
  .union([z.literal(""), z.coerce.number().int().positive().max(20000)])
  .transform((v) => (v === "" ? null : v));

export async function updateHomeRadius(formData: FormData): Promise<ActionResult> {
  const parsed = homeRadiusSchema.safeParse(formData.get("homeRadiusKm") ?? "");
  if (!parsed.success) return { ok: false, error: "Enter a radius in km, or leave it blank" };

  const business = await getCurrentBusiness();
  await db.business.update({
    where: { id: business.id },
    data: { homeRadiusKm: parsed.data },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Form-friendly wrapper (a <form action> must return void). */
export async function updateHomeRadiusForm(formData: FormData): Promise<void> {
  await updateHomeRadius(formData);
}
