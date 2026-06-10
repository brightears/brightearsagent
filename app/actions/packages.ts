"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Prices are entered in dollars, stored in cents. Returns null on bad input. */
function dollarsToCents(raw: string): number | null {
  const dollars = Number(raw);
  if (!Number.isFinite(dollars) || dollars < 0) return null;
  return Math.round(dollars * 100);
}

/** "Wedding, Corporate , birthday" → ["wedding", "corporate", "birthday"] */
function parseEventTypes(raw: string): string[] {
  return [...new Set(raw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

type PriceFields = { priceMin: number; priceMax: number | null };

function parsePrices(formData: FormData): PriceFields | { error: string } {
  const priceMin = dollarsToCents(field(formData, "priceMin"));
  if (priceMin === null) return { error: "enter a starting price in dollars" };

  const maxRaw = field(formData, "priceMax");
  const priceMax = maxRaw ? dollarsToCents(maxRaw) : null;
  if (maxRaw && priceMax === null) return { error: "top price must be a number" };
  if (priceMax !== null && priceMax < priceMin) {
    return { error: "top price can't be below the starting price" };
  }
  return { priceMin, priceMax };
}

export async function createPackage(formData: FormData) {
  const business = await getCurrentBusiness();

  const name = field(formData, "name");
  if (!name) return { ok: false, error: "give the package a name" };

  const prices = parsePrices(formData);
  if ("error" in prices) return { ok: false, error: prices.error };

  await db.package.create({
    data: {
      businessId: business.id,
      name,
      description: field(formData, "description"),
      priceMin: prices.priceMin,
      priceMax: prices.priceMax,
      eventTypes: parseEventTypes(field(formData, "eventTypes")),
    },
  });

  revalidatePath("/dashboard/packages");
  return { ok: true };
}

export async function updatePackage(formData: FormData) {
  const business = await getCurrentBusiness();

  const id = field(formData, "id");
  if (!id) return { ok: false, error: "missing package id" };

  const name = field(formData, "name");
  if (!name) return { ok: false, error: "give the package a name" };

  const prices = parsePrices(formData);
  if ("error" in prices) return { ok: false, error: prices.error };

  // updateMany so the where clause stays tenant-scoped.
  const { count } = await db.package.updateMany({
    where: { id, businessId: business.id },
    data: {
      name,
      description: field(formData, "description"),
      priceMin: prices.priceMin,
      priceMax: prices.priceMax,
      eventTypes: parseEventTypes(field(formData, "eventTypes")),
      active: formData.get("active") === "on",
    },
  });
  if (count === 0) return { ok: false, error: "package not found" };

  revalidatePath("/dashboard/packages");
  return { ok: true };
}

/**
 * Soft delete: past quotes/drafts may reference a package by name (no DB
 * relation to cascade), so we never hard-delete — we toggle `active`. The
 * drafter only quotes active packages; the owner can flip one back anytime.
 */
export async function deletePackage(id: string) {
  const business = await getCurrentBusiness();

  const pkg = await db.package.findFirst({
    where: { id, businessId: business.id },
    select: { id: true, active: true },
  });
  if (!pkg) return { ok: false, error: "package not found" };

  await db.package.update({ where: { id: pkg.id }, data: { active: !pkg.active } });

  revalidatePath("/dashboard/packages");
  return { ok: true };
}
