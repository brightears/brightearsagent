"use server";

import { db } from "@/lib/db";

type ActionResult = { ok: true } | { ok: false; error: string };

/** Where a marketing email signup came from — one gate per free tool. */
const SOURCES = ["reply-generator", "templates", "roi-calculator"] as const;
type MarketingSource = (typeof SOURCES)[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Email-gate signup from the free tools. Upserts so the same person can
 * hit the same gate twice without an error (and without a duplicate row).
 */
export async function saveMarketingContact(input: {
  email: string;
  source: string;
}): Promise<ActionResult> {
  const email = (input.email ?? "").trim().toLowerCase().slice(0, 254);
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "That doesn't look like an email address." };
  }
  if (!SOURCES.includes(input.source as MarketingSource)) {
    return { ok: false, error: "Unknown signup source." };
  }
  const source = input.source as MarketingSource;

  try {
    await db.marketingContact.upsert({
      where: { email_source: { email, source } },
      create: { email, source },
      update: {}, // already signed up from this tool — nothing to change
    });
  } catch {
    return { ok: false, error: "Couldn't save that just now — please try again." };
  }
  return { ok: true };
}
