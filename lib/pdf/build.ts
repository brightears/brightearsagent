// Build PDF documents from a Business row — shared by the download routes and
// (phase 3) the outbound email-attachment path, so the press kit looks the same
// however it's delivered.
import { fetchImageDataUris } from "@/lib/pdf/images";
import { renderPressKitPdf, type PressKitData } from "@/lib/pdf/press-kit";

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
