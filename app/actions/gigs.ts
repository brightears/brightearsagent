"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/; // "18:00" — matches Gig.startTime convention

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Add a gig to the in-app calendar (the availability source the drafter reads).
 * Date convention (whole codebase, see lib/agent/availability.ts): store the
 * local calendar date as NOON UTC so the ISO day slice is tz-stable.
 */
export async function createGig(formData: FormData) {
  const business = await getCurrentBusiness();

  const dateStr = field(formData, "date");
  if (!DATE_RE.test(dateStr)) return { ok: false, error: "pick a date" };

  const title = field(formData, "title");
  if (!title) return { ok: false, error: "give the gig a title" };

  const startRaw = field(formData, "startTime");
  const endRaw = field(formData, "endTime");
  if (startRaw && !TIME_RE.test(startRaw)) return { ok: false, error: "start time must be HH:MM" };
  if (endRaw && !TIME_RE.test(endRaw)) return { ok: false, error: "end time must be HH:MM" };

  const performerId = field(formData, "performerId") || null;
  if (performerId) {
    const performer = await db.performer.findFirst({
      where: { id: performerId, businessId: business.id },
      select: { id: true },
    });
    if (!performer) return { ok: false, error: "performer not found" };
  }

  await db.gig.create({
    data: {
      businessId: business.id,
      date: new Date(`${dateStr}T12:00:00Z`),
      title,
      venue: field(formData, "venue") || null,
      startTime: startRaw || null,
      endTime: endRaw || null,
      performerId,
    },
  });

  revalidatePath("/dashboard/calendar");
  return { ok: true };
}

export async function deleteGig(id: string) {
  const business = await getCurrentBusiness();
  // deleteMany so the where clause stays tenant-scoped.
  const { count } = await db.gig.deleteMany({ where: { id, businessId: business.id } });
  if (count === 0) return { ok: false, error: "gig not found" };

  revalidatePath("/dashboard/calendar");
  return { ok: true };
}
