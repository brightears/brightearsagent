// Draft-engine eval scenarios. Each runs the pure drafter and asserts
// deterministic quality gates. Run: npm run eval:drafts
import type { BusinessProfile, DraftRequest, PackageInfo } from "@/lib/agent/types";

export const BUSINESS: BusinessProfile = {
  id: null, // evals don't log usage
  name: "Demo DJ Co",
  ownerName: "Jamie",
  performerKind: "DJ",
  country: "US",
  voiceSamples:
    "Hey! Thanks so much for reaching out — congrats on the engagement! We'd love to hear more about what you have planned. We keep things fun and stress-free: you tell us the vibe, we handle the rest.",
};

export const PACKAGES: PackageInfo[] = [
  { name: "Wedding Essentials (6h)", description: "Ceremony + reception DJ, MC duties, dance floor lighting.", priceMin: 180000, priceMax: 220000, eventTypes: ["wedding"] },
  { name: "Wedding + Photo Booth (6h)", description: "Essentials plus open-air photo booth with attendant.", priceMin: 250000, priceMax: 290000, eventTypes: ["wedding"] },
  { name: "Corporate / Private Party (4h)", description: "DJ + sound system for corporate events and private parties.", priceMin: 90000, priceMax: 120000, eventTypes: ["corporate", "birthday", "private party"] },
];

export interface Expectation {
  /** Single value or acceptable set (follow-ups may reasonably skip availability talk). */
  availability: ("affirmed" | "conflicted" | "not_addressed") | Array<"affirmed" | "conflicted" | "not_addressed">;
  mustInclude?: RegExp[];
  mustNotInclude?: RegExp[];
  maxWords?: number;
  minWords?: number;
}

export interface Scenario {
  name: string;
  request: DraftRequest;
  expect: Expectation;
}

const base: Pick<DraftRequest, "business" | "packages" | "thread" | "sequenceStep"> = {
  business: BUSINESS,
  packages: PACKAGES,
  thread: [],
  sequenceStep: 0,
};

export const SCENARIOS: Scenario[] = [
  {
    name: "wedding-free-full-details",
    request: { ...base, lead: { source: "WEBSITE_FORM", clientName: "Emily", eventType: "wedding", eventDate: "2026-10-17", venue: "Harvest Barn", guestCount: 140, message: "Hi! Are you free on our date? We'd love ceremony music and a fun reception. Budget around $2,000." }, availability: { state: "free" } },
    expect: { availability: "affirmed", mustInclude: [/Emily/], minWords: 60, maxWords: 220 },
  },
  {
    name: "wedding-conflict-honest",
    request: { ...base, lead: { source: "THE_KNOT", clientName: "Priya", eventType: "wedding", eventDate: "2026-07-10", guestCount: 200, message: "We're getting married July 10 and love your reviews. Are you available?" }, availability: { state: "conflict", bookedTitles: ["Miller wedding"] } },
    expect: { availability: "conflicted", mustNotInclude: [/date is open/i, /we('| a)re available/i, /Miller/], mustInclude: [/Priya/] },
  },
  {
    name: "vague-date-asks-for-it",
    request: { ...base, lead: { source: "GIGSALAD", clientName: "Nina", eventType: "wedding", message: "We haven't picked a date yet, sometime next fall. What are your packages?" }, availability: { state: "unknown" } },
    expect: { availability: "not_addressed", mustInclude: [/Nina/, /date/i] },
  },
  {
    name: "terse-price-shopper-gets-price",
    request: { ...base, lead: { source: "PLAIN_EMAIL", clientName: "Mike", message: "how much for a saturday wedding in september" }, availability: { state: "unknown" } },
    expect: { availability: "not_addressed", mustInclude: [/\$1,?800/] },
  },
  {
    name: "partial-availability-no-roster-leak",
    request: { ...base, lead: { source: "WEDDINGWIRE", clientName: "Sofia", eventType: "wedding", eventDate: "2026-09-12", message: "Looking for a DJ for ~120 guests, are you free Sept 12?" }, availability: { state: "partial", freePerformers: ["Sam"] } },
    expect: { availability: "affirmed", mustNotInclude: [/other (booking|event|client)/i, /roster/i, /already booked/i] },
  },
  {
    name: "corporate-with-package-price",
    request: { ...base, lead: { source: "PLAIN_EMAIL", clientName: "Mark", eventType: "corporate", eventDate: "2026-08-21", guestCount: 80, message: "Company party for ~80 people, what would that cost?" }, availability: { state: "free" } },
    expect: { availability: "affirmed", mustInclude: [/\$9[0-9]{2}|\$900/] },
  },
  {
    name: "budget-below-minimum-no-invented-discount",
    request: { ...base, lead: { source: "PLAIN_EMAIL", clientName: "Gary", eventType: "birthday", budgetHint: "$400 max", message: "Birthday party, only have $400, can you do it?" }, availability: { state: "unknown" } },
    expect: { availability: "not_addressed", mustNotInclude: [/(special price|discount|we can do it for|make it work for)\s+(of\s+)?\$/i] },
  },
  {
    name: "photo-booth-addon-mentions-package",
    request: { ...base, lead: { source: "WEBSITE_FORM", clientName: "Aisha", eventType: "wedding", eventDate: "2026-11-07", message: "Do you also do photo booths? We want DJ + booth." }, availability: { state: "free" } },
    expect: { availability: "affirmed", mustInclude: [/photo booth/i] },
  },
  {
    name: "gigsalad-no-contact-still-drafts",
    request: { ...base, lead: { source: "GIGSALAD", eventType: "wedding", eventDate: "2026-10-03", message: "Quote request: wedding reception, 4 hours." }, availability: { state: "free" } },
    expect: { availability: "affirmed", minWords: 50 },
  },
  {
    name: "knot-sparse-asks-for-details",
    request: { ...base, lead: { source: "THE_KNOT", clientName: "Jordan", message: "Jordan is interested in your services." }, availability: { state: "unknown" } },
    expect: { availability: "not_addressed", mustInclude: [/Jordan/] },
  },
  {
    name: "nonlisted-event-no-invented-price",
    request: { ...base, lead: { source: "PLAIN_EMAIL", clientName: "Casey", eventType: "school prom", eventDate: "2027-05-14", message: "Do you DJ proms? What do you charge?" }, availability: { state: "free" } },
    expect: { availability: "affirmed", mustInclude: [/Casey/] },
  },
  {
    name: "flexible-date-couple",
    request: { ...base, lead: { source: "WEDDINGWIRE", clientName: "Dana", eventType: "wedding", message: "Our date is flexible, sometime in spring. Pricing?" }, availability: { state: "unknown" } },
    expect: { availability: "not_addressed", mustInclude: [/\$/] },
  },
  {
    name: "followup-step1-short-specific",
    request: { ...base, sequenceStep: 1, lead: { source: "WEBSITE_FORM", clientName: "Emily", eventType: "wedding", eventDate: "2026-10-17", venue: "Harvest Barn", guestCount: 140, message: "Hi! Are you free on our date? Budget around $2,000." }, availability: { state: "free" }, thread: [ { direction: "INBOUND", body: "Hi! Are you free on our date? Budget around $2,000." }, { direction: "OUTBOUND", body: "Hi Emily — great news, October 17 is open! Our Wedding Essentials package runs $1,800–$2,200..." } ] },
    expect: { availability: ["affirmed", "not_addressed"], maxWords: 110, mustInclude: [/Emily/] },
  },
  {
    name: "followup-step2-still-short",
    request: { ...base, sequenceStep: 2, lead: { source: "THE_KNOT", clientName: "Priya", eventType: "wedding", eventDate: "2027-02-20", message: "Interested in your DJ services for our wedding." }, availability: { state: "free" }, thread: [ { direction: "INBOUND", body: "Interested in your DJ services for our wedding." }, { direction: "OUTBOUND", body: "Hi Priya — thanks for reaching out! Feb 20 is open..." }, { direction: "OUTBOUND", body: "Hi Priya — just floating this back up..." } ] },
    expect: { availability: ["affirmed", "not_addressed"], maxWords: 110 },
  },
  {
    name: "engaged-price-question-exact-answer",
    request: { ...base, lead: { source: "WEBSITE_FORM", clientName: "Aisha", eventType: "wedding", eventDate: "2026-11-07", message: "Does the photo booth package include prints?" }, availability: { state: "free" }, thread: [ { direction: "INBOUND", body: "Do you also do photo booths?" }, { direction: "OUTBOUND", body: "Hi Aisha — yes! Our Wedding + Photo Booth package is $2,500–$2,900..." }, { direction: "INBOUND", body: "Does the photo booth package include prints?" } ] },
    expect: { availability: "affirmed", mustInclude: [/Aisha/] },
  },
  {
    name: "conflict-with-question-still-honest",
    request: { ...base, lead: { source: "PLAIN_EMAIL", clientName: "Leo", eventType: "wedding", eventDate: "2026-07-10", message: "Are you free July 10? Also do you bring your own sound system?" }, availability: { state: "conflict", bookedTitles: ["Miller wedding"] } },
    expect: { availability: "conflicted", mustNotInclude: [/we('| a)re available/i, /date is open/i], mustInclude: [/sound/i] },
  },
];
