// Pure input shapes for the draft engine — no DB types, so the drafter is
// directly testable/evaluable with plain objects.

export interface BusinessProfile {
  id: string | null; // null in evals (no usage logging)
  name: string;
  ownerName: string;
  performerKind: string; // "DJ", "BAND", ...
  country: string;
  currency: string; // ISO-4217 — the artist's own fee currency (e.g. THB), NOT our USD billing
  voiceSamples?: string | null;
  websiteUrl?: string | null;
  bookingLinkUrl?: string | null; // owner's existing booking/contract/deposit page — the close
  riderNotes?: string | null; // how they perform & what they need — answers client setup questions
}

export interface PackageInfo {
  name: string;
  description: string;
  priceMin: number; // cents
  priceMax: number | null;
  eventTypes: string[];
}

export interface LeadInfo {
  source: string;
  subject?: string | null; // the inquiry's original subject, for natural Re: threading
  clientName?: string | null;
  clientEmail?: string | null;
  eventType?: string | null;
  eventDate?: string | null; // YYYY-MM-DD
  venue?: string | null;
  guestCount?: number | null;
  budgetHint?: string | null;
  message: string; // the client's own words (rawBody or latest inbound)
}

export type Availability =
  | { state: "free" }
  | { state: "partial"; freePerformers: string[] } // some performers booked, these are free
  | { state: "conflict"; bookedTitles: string[] }
  | { state: "unknown" }; // no date on the lead

export interface ThreadMessage {
  direction: "INBOUND" | "OUTBOUND";
  body: string;
}

export interface DraftRequest {
  business: BusinessProfile;
  packages: PackageInfo[];
  lead: LeadInfo;
  availability: Availability;
  /** Empty for the first reply; full thread for follow-ups/engaged replies. */
  thread: ThreadMessage[];
  /** 0 = first reply; 1..n = follow-up sequence step. */
  sequenceStep: number;
}

export interface DraftResult {
  subject: string;
  body: string;
  /** Model's self-report — must match the availability input; evals assert it. */
  availabilityStatement: "affirmed" | "conflicted" | "not_addressed";
}
