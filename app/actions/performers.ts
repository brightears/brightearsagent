"use server";

// Roster CRUD (P13.1) — the Studio tier's multi-performer claim, restored
// honestly: performers are added/renamed/deactivated here, the plan's
// rosterCap is enforced at SAVE (lib/billing/plan-features.ts — the SSOT),
// and every action is tenant-scoped. Deactivation, never deletion: a
// performer's gig history stays on the calendar.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { planFeatures } from "@/lib/billing/plan-features";
import { PerformerKind } from "@/app/generated/prisma/enums";

export type PerformerActionResult = { ok: boolean; error?: string };

const KIND_VALUES = Object.values(PerformerKind) as string[];

function cleanName(raw: FormDataEntryValue | null): string {
  return typeof raw === "string" ? raw.trim().slice(0, 80) : "";
}

function cleanKind(raw: FormDataEntryValue | null): PerformerKind | null {
  return typeof raw === "string" && KIND_VALUES.includes(raw) ? (raw as PerformerKind) : null;
}

export async function addPerformer(formData: FormData): Promise<PerformerActionResult> {
  const business = await getCurrentBusiness();
  const name = cleanName(formData.get("name"));
  const kind = cleanKind(formData.get("kind")) ?? business.performerKind;
  if (!name) return { ok: false, error: "Give the performer a name." };

  const cap = planFeatures(business.plan).rosterCap;
  const active = await db.performer.count({ where: { businessId: business.id, active: true } });
  if (active >= cap) {
    return {
      ok: false,
      error:
        cap === 1
          ? "Your plan covers one performer — Studio adds the roster."
          : `Your roster is full (${cap} performers on Studio).`,
    };
  }

  await db.performer.create({ data: { businessId: business.id, name, kind } });
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/calendar");
  return { ok: true };
}

export async function updatePerformer(
  performerId: string,
  formData: FormData,
): Promise<PerformerActionResult> {
  const business = await getCurrentBusiness();
  const name = cleanName(formData.get("name"));
  const kind = cleanKind(formData.get("kind"));
  if (!name) return { ok: false, error: "Give the performer a name." };
  const updated = await db.performer.updateMany({
    where: { id: performerId, businessId: business.id },
    data: { name, ...(kind ? { kind } : {}) },
  });
  if (updated.count === 0) return { ok: false, error: "Performer not found." };
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/calendar");
  return { ok: true };
}

export async function setPerformerActive(
  performerId: string,
  active: boolean,
): Promise<PerformerActionResult> {
  const business = await getCurrentBusiness();
  // Reactivation counts against the cap too — no cap-dodging via toggling.
  if (active) {
    const cap = planFeatures(business.plan).rosterCap;
    const activeCount = await db.performer.count({
      where: { businessId: business.id, active: true },
    });
    if (activeCount >= cap) {
      return { ok: false, error: "Your roster is at its plan cap." };
    }
  }
  const updated = await db.performer.updateMany({
    where: { id: performerId, businessId: business.id },
    data: { active },
  });
  if (updated.count === 0) return { ok: false, error: "Performer not found." };
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/calendar");
  return { ok: true };
}
