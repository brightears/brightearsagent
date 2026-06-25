// Build PDF documents from a Business row — shared by the download routes and
// (phase 3) the outbound email-attachment path, so the press kit looks the same
// however it's delivered.
import { fetchImageDataUris } from "@/lib/pdf/images";
import { renderPressKitPdf, type PressKitData } from "@/lib/pdf/press-kit";
import { renderQuotationPdf, type QuotationData } from "@/lib/pdf/quotation";
import { computeQuote } from "@/lib/quote/compute";

/** The Business fields a press kit needs — the Prisma row satisfies this. */
export type BusinessForPressKit = {
  name: string;
  ownerName: string;
  performerKind: string;
  headline: string | null;
  bio: string | null;
  genres: string[];
  eventTypes: string[];
  serviceCities: string[];
  travelPolicy: string | null;
  notableVenues: string[];
  reviewQuotes: string[];
  riderNotes: string | null;
  websiteUrl: string | null;
  bookingLinkUrl: string | null;
  socialLinks: string[];
  videoLinks: string[];
  replyToEmail: string | null;
  ownerEmail: string;
  photoUrls: string[];
};

export async function renderPressKitForBusiness(b: BusinessForPressKit): Promise<Buffer> {
  const photoDataUris = await fetchImageDataUris(b.photoUrls, 4);
  const data: PressKitData = {
    name: b.name,
    ownerName: b.ownerName,
    performerKind: b.performerKind,
    headline: b.headline,
    bio: b.bio,
    genres: b.genres,
    eventTypes: b.eventTypes,
    serviceCities: b.serviceCities,
    travelPolicy: b.travelPolicy,
    notableVenues: b.notableVenues,
    reviewQuotes: b.reviewQuotes,
    riderNotes: b.riderNotes,
    websiteUrl: b.websiteUrl,
    bookingLinkUrl: b.bookingLinkUrl,
    socialLinks: b.socialLinks,
    videoLinks: b.videoLinks,
    contactEmail: b.replyToEmail ?? b.ownerEmail,
    photoDataUris,
  };
  return renderPressKitPdf(data);
}

// --- Quotation -------------------------------------------------------------

export type BusinessForQuote = {
  name: string;
  timezone: string;
  currency: string;
  feeFloor: number | null;
  feeSweetSpot: number | null;
  residencyRate: number | null;
  gigTypes: string[];
  replyToEmail: string | null;
  ownerEmail: string;
  websiteUrl: string | null;
  bookingLinkUrl: string | null;
  packages: { name: string; description: string | null; priceMin: number; priceMax: number | null; eventTypes: string[] }[];
};

export type LeadForQuote = {
  id: string;
  clientName: string | null;
  eventType: string | null;
  eventDate: Date | null;
  venue: string | null;
  guestCount: number | null;
};

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

function fmtDate(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/**
 * Build a quotation PDF for a lead from the artist's pricing, or null when there
 * is nothing to quote from (caller should fall back to asking for details).
 * `now` is injectable for deterministic tests.
 */
export async function renderQuotationForLead(
  lead: LeadForQuote,
  business: BusinessForQuote,
  now: Date = new Date(),
): Promise<Buffer | null> {
  const quote = computeQuote({
    currency: business.currency,
    feeFloor: business.feeFloor,
    feeSweetSpot: business.feeSweetSpot,
    residencyRate: business.residencyRate,
    gigTypes: business.gigTypes,
    packages: business.packages,
    eventType: lead.eventType,
  });
  if (!quote) return null;

  const validUntil = new Date(now.getTime() + quote.validityDays * 24 * 3600 * 1000);
  const data: QuotationData = {
    artistName: business.name,
    contactEmail: business.replyToEmail ?? business.ownerEmail,
    websiteUrl: business.websiteUrl,
    bookingLinkUrl: business.bookingLinkUrl,
    clientName: lead.clientName,
    eventType: lead.eventType ? titleCase(lead.eventType) : null,
    eventDateLabel: lead.eventDate ? fmtDate(lead.eventDate, business.timezone) : null,
    venue: lead.venue,
    guestCount: lead.guestCount,
    quote,
    quoteRef: `Q-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${lead.id.slice(-4).toUpperCase()}`,
    issuedLabel: fmtDate(now, business.timezone),
    validUntilLabel: fmtDate(validUntil, business.timezone),
  };
  return renderQuotationPdf(data);
}
