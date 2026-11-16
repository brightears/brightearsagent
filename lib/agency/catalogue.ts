// Catalogue profiles: artists who applied through /join, ticked the profile box
// and confirmed the text the desk prepared. Stored apart from Vinyl's artist
// records and booking system. Desk actions are authenticated with the Mac-side
// AGENCY_INQUIRY_TOKEN (the application export credential) and logged.
//
// Privacy rule: a public page only ever sees PUBLIC_SELECT through
// toAgencyArtist(). Fees, contact details, legal names, right-to-work answers
// and consent records are never copied into a profile, and the free-text
// checks below refuse text that looks like one.
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { CITIES, containsThaiIdNumber, MAX_PHOTO_BYTES, sniffPhotoType, type PhotoType } from "./application-contract";
import { BUYER_ACTS, type BuyerAct } from "./acts";
import { InquiryError } from "./inquiry-contract";
import type { AgencyArtist } from "./roster";

import { ACT_TAGS, type ActTag } from "./catalogue-tags";
export { ACT_TAGS, type ActTag };

/** The artist's own public sound, video and social pages. Nothing else is linked. */
const LINK_DOMAINS: [label: string, domain: string][] = [
  ["Instagram", "instagram.com"], ["Facebook", "facebook.com"], ["TikTok", "tiktok.com"], ["YouTube", "youtube.com"],
  ["SoundCloud", "soundcloud.com"], ["Mixcloud", "mixcloud.com"], ["Spotify", "open.spotify.com"],
];
export function catalogueLink(raw: string): { label: string; url: string } | null {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  for (const [label, domain] of LINK_DOMAINS) {
    if (host === domain || host.endsWith("." + domain) || (domain === "youtube.com" && host === "youtu.be")) return { label, url: url.href };
  }
  return null;
}

/** Text that must never be published: contact details, ID numbers and fees. */
export function privateTextIssue(value: string): "contact" | "id_number" | "fee" | null {
  if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(value) || /(?:\+?66|\b0)[\s-]?\d(?:[\s-]?\d){7,9}\b/.test(value) || /\bline\s*id\b/i.test(value)) return "contact";
  if (containsThaiIdNumber(value)) return "id_number";
  if (/฿|\bTHB\b|\bbaht\b|บาท|ค่าตัว|per hour|ต่อชั่วโมง/i.test(value)) return "fee";
  return null;
}

const publicText = (min: number, max: number) => z.string().trim().min(min).max(max)
  .superRefine((value, ctx) => { const issue = privateTextIssue(value); if (issue) ctx.addIssue({ code: "custom", message: issue }); });
const buyerActIds = BUYER_ACTS.map(act => act.id) as [BuyerAct["id"], ...BuyerAct["id"][]];

export const catalogueProfileSchema = z.object({
  applicationRef: z.string().regex(/^BE-APP-[0-9a-f-]{36}$/),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/),
  stageName: publicText(2, 60),
  actLabel: z.object({ en: publicText(2, 60), th: publicText(2, 80) }).strict(),
  actType: z.enum(buyerActIds),
  actTags: z.array(z.enum(Object.keys(ACT_TAGS) as [ActTag, ...ActTag[]])).min(1).max(4),
  bio: z.object({ en: publicText(40, 900), th: z.union([publicText(20, 1200), z.literal("")]).default("") }).strict(),
  genres: z.array(z.string().trim().min(2).max(30)).max(6).default([]),
  basedIn: z.enum(Object.keys(CITIES) as [keyof typeof CITIES, ...(keyof typeof CITIES)[]]),
  links: z.array(z.string().max(300)).max(5).default([])
    .transform((values, ctx) => values.map(value => {
      const link = catalogueLink(value);
      if (!link) ctx.addIssue({ code: "custom", message: "link_not_allowed" });
      return link;
    }).filter((link): link is { label: string; url: string } => link !== null)),
  photoCredit: z.union([publicText(2, 80), z.literal("")]).default(""),
  playedForBrightEars: z.boolean().default(false),
}).strict();
export type CatalogueProfileInput = z.infer<typeof catalogueProfileSchema>;
export type CataloguePhoto = { bytes: Uint8Array<ArrayBuffer>; contentType: PhotoType };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => { const token = randomBytes(24).toString("base64url"); return { token, hash: hashToken(token) }; };
const logEvent = (profileId: string, slug: string, action: string, note?: string) =>
  db.catalogueProfileEvent.create({ data: { profileId, slug, action, note: note?.slice(0, 300) || null } });

/** The only columns a public or preview page reads. */
const PUBLIC_SELECT = {
  slug: true, stageName: true, actLabelEn: true, actLabelTh: true, actType: true, actTags: true, bioEn: true, bioTh: true,
  genres: true, basedIn: true, links: true, photoSha256: true, photoCredit: true, playedForBrightEars: true,
} as const;
type PublicRow = { slug: string; stageName: string; actLabelEn: string; actLabelTh: string; actType: string; actTags: string[]; bioEn: string;
  bioTh: string; genres: string[]; basedIn: string; links: unknown; photoSha256: string; photoCredit: string | null; playedForBrightEars: boolean };

export function toAgencyArtist(row: PublicRow, image: string): AgencyArtist {
  const city = CITIES[row.basedIn as keyof typeof CITIES];
  const links = Array.isArray(row.links) ? row.links.flatMap(item => {
    const link = item && typeof item === "object" && typeof (item as { url?: unknown }).url === "string" ? catalogueLink((item as { url: string }).url) : null;
    return link ? [link] : [];
  }) : [];
  return {
    id: row.slug, name: row.stageName, bio: row.bioEn, bioTh: row.bioTh || row.bioEn, city: city?.en ?? "Bangkok", genres: row.genres,
    image, gallery: [], links, actType: (buyerActIds as string[]).includes(row.actType) ? row.actType as BuyerAct["id"] : "solo",
    source: "catalogue", actTags: row.actTags, basedIn: row.basedIn, played: row.playedForBrightEars,
    actLabel: { en: row.actLabelEn, th: row.actLabelTh }, photoCredit: row.photoCredit || undefined,
  };
}

/** Published catalogue artists for /artists, profiles and the sitemap. */
export async function publishedCatalogueArtists(): Promise<AgencyArtist[]> {
  const rows = await db.catalogueProfile.findMany({ where: { status: "published" }, select: PUBLIC_SELECT, orderBy: [{ publishedAt: "asc" }, { slug: "asc" }] });
  return rows.map(row => toAgencyArtist(row, `/api/agency/catalogue/photo/${row.slug}?v=${row.photoSha256.slice(0, 12)}`));
}

/** The draft or live profile behind a private preview link. Removed profiles have none. */
export async function previewCatalogueArtist(token: string) {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return null;
  const row = await db.catalogueProfile.findFirst({
    where: { previewTokenHash: hashToken(token), status: { in: ["draft", "published"] } },
    select: { ...PUBLIC_SELECT, status: true },
  });
  if (!row) return null;
  return { status: row.status as "draft" | "published", artist: toAgencyArtist(row, `/api/agency/catalogue/preview/${token}/photo?v=${row.photoSha256.slice(0, 12)}`) };
}

export async function cataloguePhoto(where: { slug: string } | { token: string }) {
  if ("token" in where && !/^[A-Za-z0-9_-]{32}$/.test(where.token)) return null;
  return db.catalogueProfile.findFirst({
    where: "slug" in where ? { slug: where.slug, status: "published" } : { previewTokenHash: hashToken(where.token), status: { in: ["draft", "published"] } },
    select: { photoBytes: true, photoType: true },
  });
}

/**
 * Creates a draft from an approved application, or updates one. The application
 * must still be on the site (up to 30 days after export) with the profile box
 * ticked: no consent, no profile. A new profile gets a private preview token,
 * returned once.
 */
export async function upsertCatalogueProfile(input: CatalogueProfileInput, photo: CataloguePhoto | null, rosterIds: string[] = []) {
  if (rosterIds.includes(input.slug)) throw new InquiryError(409, "slug_taken");
  const application = await db.artistApplication.findUnique({
    where: { id: input.applicationRef.slice("BE-APP-".length) },
    select: { listingConsent: true, listingConsentAt: true, listingConsentVersion: true },
  });
  if (!application) throw new InquiryError(404, "application_not_found");
  if (!application.listingConsent || !application.listingConsentAt || !application.listingConsentVersion) throw new InquiryError(409, "no_listing_consent");
  const fields = {
    applicationRef: input.applicationRef, consentVersion: application.listingConsentVersion, consentAt: application.listingConsentAt,
    stageName: input.stageName, actLabelEn: input.actLabel.en, actLabelTh: input.actLabel.th, actType: input.actType, actTags: input.actTags,
    bioEn: input.bio.en, bioTh: input.bio.th, genres: input.genres, basedIn: input.basedIn, links: input.links,
    photoCredit: input.photoCredit || null, playedForBrightEars: input.playedForBrightEars,
    ...(photo ? {
      photoBytes: Buffer.from(photo.bytes.buffer, photo.bytes.byteOffset, photo.bytes.byteLength), photoType: photo.contentType,
      photoSha256: createHash("sha256").update(photo.bytes).digest("hex"),
    } : {}),
  };
  const existing = await db.catalogueProfile.findUnique({ where: { slug: input.slug }, select: { id: true, applicationRef: true, status: true } });
  if (existing) {
    if (existing.applicationRef !== input.applicationRef) throw new InquiryError(409, "slug_taken");
    await db.catalogueProfile.update({ where: { id: existing.id }, data: fields });
    await logEvent(existing.id, input.slug, "updated");
    return { slug: input.slug, status: existing.status, previewToken: null };
  }
  if (!photo) throw new InquiryError(400, "photo_required");
  const { token, hash } = newToken();
  const created = await db.catalogueProfile.create({
    data: { ...fields, slug: input.slug, previewTokenHash: hash } as Parameters<typeof db.catalogueProfile.create>[0]["data"],
    select: { id: true, status: true },
  });
  await logEvent(created.id, input.slug, "created");
  return { slug: input.slug, status: created.status, previewToken: token };
}

async function profileBySlug(slug: string) {
  const profile = await db.catalogueProfile.findUnique({ where: { slug }, select: { id: true, status: true } });
  if (!profile) throw new InquiryError(404, "not_found");
  return profile;
}

/** Issues a new preview link; the old one stops working. */
export async function rotateCataloguePreview(slug: string) {
  const profile = await profileBySlug(slug);
  if (profile.status === "removed") throw new InquiryError(409, "removed");
  const { token, hash } = newToken();
  await db.catalogueProfile.update({ where: { id: profile.id }, data: { previewTokenHash: hash } });
  await logEvent(profile.id, slug, "preview_rotated");
  return { slug, status: profile.status, previewToken: token };
}

/** Publishing needs the artist's confirmation on record, for example where and when they said OK. */
export async function publishCatalogueProfile(slug: string, confirmation: string) {
  if (confirmation.trim().length < 5) throw new InquiryError(400, "confirmation_required");
  const profile = await profileBySlug(slug);
  await db.catalogueProfile.update({ where: { id: profile.id }, data: { status: "published", publishedAt: new Date(), removedAt: null } });
  await logEvent(profile.id, slug, "published", confirmation.trim());
  return { slug, status: "published" };
}

/** Takes a profile off the site at once. The draft stays so it can be republished with a new confirmation. */
export async function unpublishCatalogueProfile(slug: string, reason: string) {
  const profile = await profileBySlug(slug);
  await db.catalogueProfile.update({ where: { id: profile.id }, data: { status: "removed", removedAt: new Date() } });
  await logEvent(profile.id, slug, "unpublished", reason);
  return { slug, status: "removed" };
}

/** Deletes the profile and its photo. Only the action log remains. */
export async function deleteCatalogueProfile(slug: string, reason: string) {
  const profile = await profileBySlug(slug);
  await db.catalogueProfile.delete({ where: { id: profile.id } });
  await logEvent(profile.id, slug, "deleted", reason);
  return { slug, status: "deleted" };
}

export async function listCatalogueProfiles() {
  const [profiles, events] = await Promise.all([
    db.catalogueProfile.findMany({
      orderBy: { createdAt: "asc" },
      select: { slug: true, stageName: true, status: true, applicationRef: true, consentVersion: true, createdAt: true, publishedAt: true, removedAt: true },
    }),
    db.catalogueProfileEvent.findMany({ orderBy: { at: "desc" }, take: 50, select: { slug: true, action: true, note: true, at: true } }),
  ]);
  return { profiles, events };
}

export async function readCataloguePhoto(file: File | null): Promise<CataloguePhoto | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_PHOTO_BYTES) throw new InquiryError(413, "photo_too_large");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = sniffPhotoType(bytes);
  if (!contentType) throw new InquiryError(415, "photo_type");
  return { bytes, contentType };
}
