import type { LeadSource } from "@/app/generated/prisma/enums";

/** Provider-agnostic inbound email. The webhook adapter maps Postmark's JSON to this. */
export interface InboundEmail {
  from: string; // sender address
  fromName?: string;
  to: string; // the leads@{slug}.in.brightears.io address it arrived at
  subject: string;
  textBody: string;
  htmlBody?: string;
  headers?: Record<string, string>;
  providerMessageId?: string;
  receivedAt?: string; // ISO
}

/** Normalized extraction result. Parsers fill what they find; never invent. */
export interface ParsedLead {
  source: LeadSource;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  eventType?: string; // lowercase: "wedding", "corporate", "birthday", ...
  eventDate?: string; // ISO date YYYY-MM-DD when determinable
  venue?: string;
  guestCount?: number;
  budgetHint?: string;
  notes?: string; // other useful free text (e.g. message body excerpt)
  confidence: number; // 0-1: how sure the parser is this is a real lead of this source
}

/**
 * Contract for deterministic source parsers (The Knot, WeddingWire, Bark, GigSalad).
 * match() is a cheap test (sender domain / subject markers); parse() returns null
 * if the email doesn't actually fit, letting the pipeline fall through to the
 * LLM fallback parser.
 */
export interface SourceParser {
  source: LeadSource;
  match(email: InboundEmail): boolean;
  parse(email: InboundEmail): ParsedLead | null;
}
