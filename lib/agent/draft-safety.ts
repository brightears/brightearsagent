import type { DraftRequest, DraftResult, PackageInfo } from "@/lib/agent/types";

const REFUSAL_LANGUAGE =
  /(already (?:fully |all )?(?:booked|taken|committed)|booked (?:up|that|solid)|can'?t (?:make|do) (?:(?:that|the|your) date)|(?:that|the|your) date is (?:already )?(?:booked|taken)|fully committed)/i;
const AMBIGUOUS_REFUSAL_LANGUAGE =
  /\b(?:not available|unavailable|won'?t be able|(?:i|we) can'?t (?:make|do) it)\b/i;

const AFFIRM_LANGUAGE = new RegExp(
  [
    // "We're available", "we are absolutely free", "I'm free that evening".
    "\\b(?:i(?:'m| am)|we(?:'re| are))(?:\\s+(?:absolutely|definitely|certainly|happily|completely|fully|still))?\\s+(?:free|available|open)\\b(?!\\s+to\\b)",
    // "I do have Aug 21 open", "we have your date free".
    "\\b(?:i|we)(?:\\s+do)?\\s+have\\s+(?:(?:that|the|your)\\s+date|[a-z]+\\s+\\d{1,2}(?:st|nd|rd|th)?)(?:\\s+still)?\\s+(?:open|free|available)\\b",
    // "your date is still open" / "that evening is free".
    "\\b(?:that|the|your)\\s+(?:date|day|evening|night)\\s+is\\s+(?:still\\s+)?(?:open|free|available)\\b",
    // "Aug 21 is open".
    "\\b[a-z]+\\s+\\d{1,2}(?:st|nd|rd|th)?\\s+is\\s+(?:still\\s+)?(?:open|free|available)\\b",
    "\\b(?:that|the|your) date works(?: (?:perfectly|well))?(?: for (?:me|us)| on (?:my|our) (?:side|end))?\\b",
    "\\b[a-z]+\\s+\\d{1,2}(?:st|nd|rd|th)? works(?: (?:perfectly|well))? for (?:me|us)\\b",
    "\\b(?:i|we) can (?:do|make|take) (?:(?:that|the|your) date)\\b",
    "\\b(?:i(?:'m| am)|we(?:'re| are)) good for (?:it|that date|the date|[a-z]+\\s+\\d{1,2}(?:st|nd|rd|th)?)\\b",
    "\\b(?:i|we) can be there\\b",
  ].join("|"),
  "i",
);
const AMBIGUOUS_AFFIRM_LANGUAGE =
  /\b(?:i|we) can (?:do|make|take) it\b/i;
const AMBIGUOUS_FINANCIAL_LANGUAGE =
  /\b(?:budget|price|pricing|cost|rate|fee|quote|discount|package|make it work)\b|(?:US\$|CA\$|A\$|NZ\$|S\$|HK\$|\$|£|€|฿|¥|₹|₩|₫|₱|₽)\s*\d/i;

function availabilityText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[‘’‛]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function ambiguousCalendarLanguage(text: string, pattern: RegExp): boolean {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .some((sentence) => pattern.test(sentence) && !AMBIGUOUS_FINANCIAL_LANGUAGE.test(sentence));
}

function hasRefusalLanguage(body: string): boolean {
  const text = availabilityText(body);
  return REFUSAL_LANGUAGE.test(text) || ambiguousCalendarLanguage(text, AMBIGUOUS_REFUSAL_LANGUAGE);
}

function hasAffirmLanguage(body: string): boolean {
  const text = availabilityText(body);
  return AFFIRM_LANGUAGE.test(text) || ambiguousCalendarLanguage(text, AMBIGUOUS_AFFIRM_LANGUAGE);
}

const PRICE_LANGUAGE =
  /(price|pricing|cost|costs|rate\b|rates|quote|quotation|\bfee\b|\bfees\b|budget|how much|charge|per hour|per night|\$|฿|€|£)/i;
const PROFILE_LANGUAGE =
  /(profile|press[\s-]?kit|\bepk\b|portfolio|examples?|demo|samples?|more (info|details|information)|tell me more|what do you (do|offer)|hear (you|your)|see (you|your)|send (me )?(more|your|some))/i;

const WHITE_LABEL =
  /\b(AI|artificial intelligence|automated|automation|chatbot|language model|virtual assistant|software agent)\b/i;
const PLACEHOLDER = /\[[a-z][a-z _-]{1,40}\]|\{\{[^}]{1,50}\}\}|<\s*(?:name|date|venue|price|link)\s*>/i;
const SPEC_LEAK =
  /\b(?:hard rules?|system prompt|word count|call to action|availability statement|wants profile|wants quote|return only|do not mention ai|no placeholders?|task:\s*write|client-facing copy)\b/i;

function normalizedWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word));
}

function phraseMatches(haystack: string, phrase: string): boolean {
  const haystackWords = normalizedWords(haystack);
  const phraseWords = normalizedWords(phrase);
  if (phraseWords.length === 0) return false;
  const normalizedHaystack = ` ${haystackWords.join(" ")} `;
  const normalizedPhrase = ` ${phraseWords.join(" ")} `;
  return normalizedHaystack.includes(normalizedPhrase);
}

/**
 * Only packages that match the actual event are visible to the model. A rate
 * card for a wedding must never become the answer to a prom or restaurant
 * inquiry merely because both rows belong to the same artist.
 */
export function selectRelevantPackages(req: DraftRequest): PackageInfo[] {
  const eventContext = [req.lead.eventType, req.lead.subject, req.lead.message]
    .filter(Boolean)
    .join(" \n ");
  return req.packages.filter(
    (pkg) =>
      pkg.eventTypes.length === 0 ||
      pkg.eventTypes.some((eventType) => phraseMatches(eventContext, eventType)),
  );
}

function normalizeNumber(raw: string, suffix?: string): number | null {
  let value = raw.replace(/\s/g, "");
  if (value.includes(",") && value.includes(".")) {
    value = value.replace(/,/g, "");
  } else if (value.includes(",")) {
    const tail = value.split(",").at(-1) ?? "";
    value = tail.length === 3 ? value.replace(/,/g, "") : value.replace(",", ".");
  } else if (/\.\d{3}$/.test(value)) {
    value = value.replace(/\./g, "");
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * (suffix?.toLowerCase() === "k" ? 1_000 : 1));
}

export type MoneyEntity = "artist" | "client" | "unknown";
export type MoneyMention = {
  amount: number;
  currency: string;
  entity: MoneyEntity;
};

const CURRENCY_TOKEN =
  "(?:US\\$|CA\\$|A\\$|NZ\\$|S\\$|HK\\$|\\$|£|€|฿|¥|₹|₩|₫|₱|₽|USD|GBP|EUR|THB|JPY|INR|KRW|VND|PHP|RUB|CAD|AUD|NZD|SGD|HKD|dollars?|pounds?|euros?|baht|yen|rupees?|won|dong|pesos?|rubles?)";
const MONEY_NUMBER = "([0-9]+(?:[.,\\s][0-9]+)*)([kK])?";

function currencyForToken(raw: string, defaultCurrency: string): string {
  const token = raw.trim().toLowerCase();
  const dollarDefault = /^(?:USD|CAD|AUD|NZD|SGD|HKD)$/i.test(defaultCurrency)
    ? defaultCurrency.toUpperCase()
    : "USD";
  const aliases: Record<string, string> = {
    "$": dollarDefault,
    "us$": "USD",
    "ca$": "CAD",
    "a$": "AUD",
    "nz$": "NZD",
    "s$": "SGD",
    "hk$": "HKD",
    "£": "GBP",
    "€": "EUR",
    "฿": "THB",
    "¥": "JPY",
    "₹": "INR",
    "₩": "KRW",
    "₫": "VND",
    "₱": "PHP",
    "₽": "RUB",
    dollar: "USD",
    dollars: "USD",
    pound: "GBP",
    pounds: "GBP",
    euro: "EUR",
    euros: "EUR",
    baht: "THB",
    yen: "JPY",
    rupee: "INR",
    rupees: "INR",
    won: "KRW",
    dong: "VND",
    peso: "PHP",
    pesos: "PHP",
    ruble: "RUB",
    rubles: "RUB",
  };
  return aliases[token] ?? token.toUpperCase();
}

function moneyEntity(
  text: string,
  start: number,
  end: number,
  fallback: MoneyEntity,
): MoneyEntity {
  const before = availabilityText(text.slice(Math.max(0, start - 90), start)).toLowerCase();
  const after = availabilityText(text.slice(end, Math.min(text.length, end + 90))).toLowerCase();

  // Classify from the grammatical cue nearest THIS occurrence. A broad
  // sentence/window bag labels every number in
  //   "our package is $1,800-$2,200, near your $2,000 budget"
  // as client money. Anchoring at the amount keeps the range artist-owned and
  // the final budget client-owned.
  const directArtistCue =
    /\b(?:our|my|the|this|that|your)\b[^.!?\n\d$£€฿¥₹₩₫₱₽]{0,55}\b(?:price|pricing|rate|fee|quote|package|total|minimum|starting price)(?:\s+(?:is|was|would be|will be|comes? to|starts? at|runs?|of|at))?\s*$/.test(
      before,
    ) ||
    /\b(?:price|pricing|rate|fee|quote|package|total|minimum|starting price)\s+(?:is|was|would be|will be|comes? to|starts? at|runs?|of|at)\s*$/.test(
      before,
    ) ||
    /\b(?:i|we)(?:'d|'ll|\s+(?:can|could|would|will))?\s+(?:charge|quote|offer|accept|do|make|work|stay|accommodate|tailor|come)\b[^.!?\n]{0,38}$/.test(
      before,
    ) ||
    /\b(?:costs?|runs?|starts? at|priced at|comes? to|would be)\s*$/.test(before) ||
    /^\s*(?:(?:works?|would work|is (?:fine|doable|acceptable))\s+(?:for\s+)?(?:me|us)\b|(?:our|my)\s+(?:price|rate|fee|package|total)\b|(?:flat\s+)?(?:fee|rate|package|total)\b)/.test(
      after,
    );
  if (directArtistCue) return "artist";

  const directClientCue =
    /\b(?:your|their|the client'?s)\s+(?:budget|maximum|max|cap|limit|spending limit)(?:\s+(?:is|was|of|at|around|about|up to))?\s*$/.test(
      before,
    ) ||
    /\b(?:you|they)\s+(?:mentioned|said|noted|have|only have|can spend|set aside|budgeted)(?:\s+(?:a|about|around|up to))?\s*$/.test(
      before,
    ) ||
    /\b(?:budget|maximum|max|cap|limit|spending limit)(?:\s+(?:is|was|of|at|around|about|up to))?\s*$/.test(
      before,
    ) ||
    /^\s*(?:budget|maximum|max|cap|limit|spending limit)\b/.test(after) ||
    (/\b(?:your|their|client'?s)\s*$/.test(before) &&
      /^\s*(?:budget|maximum|max|cap|limit|spending limit)\b/.test(after));
  return directClientCue ? "client" : fallback;
}

/**
 * Currency- and speaker-aware money extraction. Explicit symbols/codes/words
 * retain their currency; fee-shaped bare amounts inherit the artist's ISO
 * currency. Ordinary dates and guest counts are deliberately ignored.
 */
export function extractMoneyMentions(
  text: string,
  opts: { defaultCurrency?: string; defaultEntity?: MoneyEntity } = {},
): MoneyMention[] {
  const defaultCurrency = (opts.defaultCurrency ?? "USD").toUpperCase();
  const defaultEntity = opts.defaultEntity ?? "unknown";
  const mentions = new Map<string, MoneyMention>();
  const coveredSpans: Array<{ start: number; end: number }> = [];
  const overlapsCovered = (start: number, end: number) =>
    coveredSpans.some((span) => start < span.end && end > span.start);
  const cover = (start: number, end: number) => coveredSpans.push({ start, end });
  const add = (
    rawAmount: string,
    suffix: string | undefined,
    currency: string,
    start: number,
    end: number,
  ) => {
    const amount = normalizeNumber(rawAmount, suffix);
    if (amount === null) return;
    const entity = moneyEntity(text, start, end, defaultEntity);
    const mention = { amount, currency: currency.toUpperCase(), entity } as const;
    mentions.set(`${mention.amount}|${mention.currency}|${mention.entity}`, mention);
  };

  // Resolve ranges first and cover their source span. Otherwise the single
  // token passes below classify each endpoint again with a different, wider
  // context (the live failure produced both an artist and a client copy of the
  // same configured endpoint).
  const repeatedCurrencyRange = new RegExp(
    `(${CURRENCY_TOKEN})\\s*${MONEY_NUMBER}\\s*[–—-]\\s*(${CURRENCY_TOKEN})\\s*${MONEY_NUMBER}`,
    "gi",
  );
  for (const match of text.matchAll(repeatedCurrencyRange)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    add(match[2], match[3], currencyForToken(match[1], defaultCurrency), start, end);
    add(match[5], match[6], currencyForToken(match[4], defaultCurrency), start, end);
    cover(start, end);
  }

  // In "$1,800–2,200", the second endpoint inherits the first currency.
  const inheritedRange = new RegExp(
    `(${CURRENCY_TOKEN})\\s*${MONEY_NUMBER}\\s*[–—-]\\s*${MONEY_NUMBER}`,
    "gi",
  );
  for (const match of text.matchAll(inheritedRange)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (overlapsCovered(start, end)) continue;
    const currency = currencyForToken(match[1], defaultCurrency);
    add(match[2], match[3], currency, start, end);
    add(match[4], match[5], currency, start, end);
    cover(start, end);
  }

  const before = new RegExp(`(${CURRENCY_TOKEN})\\s*${MONEY_NUMBER}`, "gi");
  for (const match of text.matchAll(before)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (overlapsCovered(start, end)) continue;
    add(
      match[2],
      match[3],
      currencyForToken(match[1], defaultCurrency),
      start,
      end,
    );
    cover(start, end);
  }
  const after = new RegExp(`${MONEY_NUMBER}\\s*(${CURRENCY_TOKEN})`, "gi");
  for (const match of text.matchAll(after)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (overlapsCovered(start, end)) continue;
    add(
      match[1],
      match[2],
      currencyForToken(match[3], defaultCurrency),
      start,
      end,
    );
    cover(start, end);
  }

  // Bare numbers are monetary only when a nearby fee/budget noun says so.
  const bareBefore = new RegExp(
    `\\b(?:price|pricing|cost|rate|fee|quote|budget|charge|total)(?:\\s+(?:is|was|of|at|around|about|up to|from|starts? at|comes? to))?\\s*[:=—-]?\\s*${MONEY_NUMBER}`,
    "gi",
  );
  const bareAfter = new RegExp(
    `${MONEY_NUMBER}\\s*(?:flat\\s+)?(?:fee|rate|budget|total|per (?:hour|night|event))\\b`,
    "gi",
  );
  for (const re of [bareBefore, bareAfter]) {
    for (const match of text.matchAll(re)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (overlapsCovered(start, end)) continue;
      add(
        match[1],
        match[2],
        defaultCurrency,
        start,
        end,
      );
      cover(start, end);
    }
  }

  return [...mentions.values()];
}

/** Backward-compatible numeric view used by diagnostics and older evals. */
export function extractMoneyAmounts(text: string): number[] {
  return [...new Set(extractMoneyMentions(text).map((mention) => mention.amount))];
}

export function unsupportedFeatureQuestion(req: DraftRequest): string | null {
  const ask = req.lead.message.match(
    /(?:does|do)\b[^?.!]{0,60}\binclude(?:d|s)?\s+([^?.!]{2,60})|(?:do you|can you)\s+(?:also\s+)?(?:provide|bring|offer|have|do)\s+([^?.!]{2,60})/i,
  );
  const phrase = (ask?.[1] ?? ask?.[2])?.trim();
  if (!phrase) return null;

  const stop = new Set([
    "also",
    "and",
    "any",
    "for",
    "own",
    "our",
    "the",
    "their",
    "this",
    "with",
    "you",
    "your",
  ]);
  const askedTerms = normalizedWords(phrase).filter((word) => word.length >= 3 && !stop.has(word));
  if (askedTerms.length === 0) return null;
  const sources = [
    req.business.performerKind,
    req.business.riderNotes,
    ...selectRelevantPackages(req).flatMap((pkg) => [pkg.name, pkg.description]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const sourceTerms = normalizedWords(sources);
  if (askedTerms.every((term) => sourceTerms.includes(term))) return null;
  return phrase;
}

function unsupportedFeatureTerms(req: DraftRequest): string[] {
  const phrase = unsupportedFeatureQuestion(req);
  if (!phrase) return [];
  const stop = new Set(["also", "and", "any", "for", "own", "our", "the", "their", "this", "with", "you", "your"]);
  return normalizedWords(phrase).filter((word) => word.length >= 3 && !stop.has(word));
}

function namesUnsupportedFeature(req: DraftRequest, result: DraftResult): boolean {
  const terms = unsupportedFeatureTerms(req);
  if (terms.length === 0) return true;
  const bodyTerms = new Set(normalizedWords(result.body));
  return terms.every((term) => bodyTerms.has(term));
}

function unsupportedFeatureClaim(req: DraftRequest, result: DraftResult): boolean {
  const phrase = unsupportedFeatureQuestion(req);
  if (!phrase) return false;

  const phraseTerms = normalizedWords(phrase).filter((word) => word.length >= 3);
  const normalizedBody = availabilityText(result.body);
  const clauses = normalizedBody.split(/(?<=[.!?])\s+|\n+/);
  // An unrelated "let me confirm timing" must not launder "Yes, prints are
  // included." Only uncertainty in the feature-answer clause counts.
  const featureClauses = clauses.filter((clause) => {
    const words = normalizedWords(clause);
    return phraseTerms.some((term) => words.includes(term));
  });
  const answer = featureClauses.length > 0 ? featureClauses.join(" ") : normalizedBody;

  const certainty =
    /\b(?:yes|absolutely|certainly|of course|sure)\b|\b(?:we|i)\s+(?:do|provide|bring|offer|include|have)\b|\b(?:we|i)(?:'ll| will| can)\s+(?:provide|bring|offer|include|supply)\b|\b(?:is|are) included\b|\bcomes? with\b|\bpart of (?:the|my|our) (?:setup|package)\b|\b(?:we(?:'ve| have)|i(?:'ve| have)) got\b/i.test(
      answer,
    );
  const uncertainty =
    /\b(?:need to|let me|i(?:'ll| will)|we(?:'ll| will))\s+(?:check|confirm)\b|\b(?:can'?t|cannot|not able to) confirm\b|\bnot (?:listed|specified|sure)\b|\b(?:do not|don't) know\b/i.test(
      answer,
    );
  return certainty && !uncertainty;
}

export function isFirstReply(req: DraftRequest): boolean {
  return req.sequenceStep === 0 && !req.thread.some((message) => message.direction === "OUTBOUND");
}

function insertAfterGreeting(body: string, sentence: string): string {
  const trimmed = body.trim();
  const greeting = trimmed.match(/^((?:hi|hello|hey|dear)\b[^\n]{0,80}[,!])(?:\s*\n+|\s+)([\s\S]*)$/i);
  if (greeting) return `${greeting[1]}\n\n${sentence}\n\n${greeting[2].trimStart()}`.trim();
  return `${sentence}\n\n${trimmed}`.trim();
}

/**
 * A first reply's central promise is the calendar answer. If prose generation
 * omits that known fact, add one small, deterministic, truthful sentence. This
 * never rewrites a contradictory claim — the validator must reject that.
 */
export function groundFirstReplyAvailability(
  req: DraftRequest,
  candidate: DraftResult,
): DraftResult {
  if (!isFirstReply(req)) return candidate;
  const normalized = normalizeDraft(req, candidate);
  if (normalized.availabilityStatement !== "not_addressed") return candidate;

  const sentence =
    req.availability.state === "free" || req.availability.state === "partial"
      ? "Great news — your date is open."
      : req.availability.state === "conflict"
        ? "I’m sorry, but your date is already booked."
        : null;
  return sentence ? { ...candidate, body: insertAfterGreeting(candidate.body, sentence) } : candidate;
}

/** Derive model flags from the actual body/input before any safety verdict. */
export function normalizeDraft(req: DraftRequest, result: DraftResult): DraftResult {
  const { state } = req.availability;
  let statement = result.availabilityStatement;
  // "we can/can't do it" can answer either a date or a BUDGET question. The
  // sentence-level detector above treats it as calendar language unless the
  // same sentence carries explicit financial context.
  const refused = hasRefusalLanguage(result.body);
  const affirmed = hasAffirmLanguage(result.body);

  if (state === "conflict") {
    if (refused) statement = "conflicted";
    else if (affirmed) statement = "affirmed";
    else statement = "not_addressed";
  } else if (state === "free" || state === "partial") {
    if (affirmed) statement = "affirmed";
    else if (refused) statement = "conflicted";
    else statement = "not_addressed";
  } else if (state === "timed") {
    if (affirmed) statement = "affirmed";
    else if (refused) statement = "conflicted";
    else statement = "not_addressed";
  } else {
    if (affirmed) statement = "affirmed";
    else if (refused) statement = "conflicted";
    else statement = "not_addressed";
  }

  const clientRequest = [
    req.lead.message,
    req.lead.budgetHint,
    ...req.thread.filter((message) => message.direction === "INBOUND").map((message) => message.body),
  ]
    .filter(Boolean)
    .join("\n");
  return {
    ...result,
    availabilityStatement: statement,
    // Attachment autonomy is driven by the buyer's actual words, never by a
    // model self-report that can silently miss an obvious quote/profile ask.
    wantsQuote: PRICE_LANGUAGE.test(clientRequest),
    wantsProfile: PROFILE_LANGUAGE.test(clientRequest),
  };
}

export type DraftValidation = { result: DraftResult; issues: string[] };

/** Pure, production-grade safety verdict shared by generation, eval, and send. */
export function validateDraft(req: DraftRequest, candidate: DraftResult): DraftValidation {
  const result = normalizeDraft(req, candidate);
  const issues: string[] = [];
  const combined = `${result.subject}\n${result.body}`;

  if (!result.subject.trim()) issues.push("subject is empty");
  if (result.subject.length > 160) issues.push("subject is longer than 160 characters");
  if (/[\x00-\x1F\x7F]/.test(result.subject)) issues.push("subject contains a control character");
  if (/^\s*re:\s*re:/i.test(result.subject)) issues.push("subject contains duplicate Re:");
  if (WHITE_LABEL.test(combined)) issues.push("mentions AI, automation, or an assistant");
  if (PLACEHOLDER.test(combined)) issues.push("contains an unresolved placeholder");
  if (SPEC_LEAK.test(combined)) issues.push("leaks writing instructions");

  if (
    isFirstReply(req) &&
    req.availability.state === "conflict" &&
    result.availabilityStatement !== "conflicted"
  ) {
    issues.push("does not clearly disclose the booked date");
  }
  if (
    isFirstReply(req) &&
    (req.availability.state === "free" || req.availability.state === "partial") &&
    result.availabilityStatement !== "affirmed"
  ) {
    issues.push("does not clearly affirm the open date");
  }
  if (req.availability.state === "conflict" && hasAffirmLanguage(result.body)) {
    issues.push("claims a booked date is available");
  }
  if (
    (req.availability.state === "unknown" || req.availability.state === "timed") &&
    result.availabilityStatement !== "not_addressed"
  ) {
    issues.push("claims availability that is not known");
  }
  if (
    (req.availability.state === "free" || req.availability.state === "partial") &&
    result.availabilityStatement === "conflicted"
  ) {
    issues.push("claims a real opening is unavailable");
  }

  const businessCurrency = req.business.currency.toUpperCase();
  const allowedArtistPrices = new Set<string>();
  for (const pkg of selectRelevantPackages(req)) {
    allowedArtistPrices.add(`${Math.round(pkg.priceMin / 100)}|${businessCurrency}`);
    if (pkg.priceMax !== null) {
      allowedArtistPrices.add(`${Math.round(pkg.priceMax / 100)}|${businessCurrency}`);
    }
  }
  const conversationMoney: MoneyMention[] = [
    ...extractMoneyMentions(req.lead.message, {
      defaultCurrency: businessCurrency,
      defaultEntity: "client",
    }),
    ...extractMoneyMentions(req.lead.budgetHint ?? "", {
      defaultCurrency: businessCurrency,
      defaultEntity: "client",
    }),
    ...req.thread.flatMap((message) =>
      extractMoneyMentions(message.body, {
        defaultCurrency: businessCurrency,
        defaultEntity: message.direction === "OUTBOUND" ? "artist" : "client",
      }),
    ),
  ];
  const allowedClientMoney = new Set(
    conversationMoney
      .filter((mention) => mention.entity === "client")
      .map((mention) => `${mention.amount}|${mention.currency}`),
  );
  const allowedConversationArtistMoney = new Set(
    conversationMoney
      .filter((mention) => mention.entity === "artist")
      .map((mention) => `${mention.amount}|${mention.currency}`),
  );
  const invented = extractMoneyMentions(result.body, {
    defaultCurrency: businessCurrency,
    defaultEntity: "unknown",
  }).filter((mention) => {
    const key = `${mention.amount}|${mention.currency}`;
    const groundedArtistMoney =
      allowedArtistPrices.has(key) || allowedConversationArtistMoney.has(key);
    if (mention.entity === "artist") return !groundedArtistMoney;
    if (mention.entity === "client") return !allowedClientMoney.has(key);
    // Neutral phrasing may safely echo an exact buyer amount ("with $2,000 to
    // work with") or a grounded package endpoint. Direct quote/discount and
    // direct client-attribution wording were classified above, so provenance
    // cannot swap speakers merely because the numbers happen to match.
    return !allowedClientMoney.has(key) && !groundedArtistMoney;
  });
  if (invented.length > 0) {
    const labels = invented.map(
      (mention) => `${mention.currency} ${mention.amount} (${mention.entity})`,
    );
    issues.push(
      `contains ungrounded price${invented.length === 1 ? "" : "s"}: ${labels.join(", ")}`,
    );
  }

  if (!namesUnsupportedFeature(req, result)) {
    issues.push("does not name the unsupported feature being checked");
  }
  if (unsupportedFeatureClaim(req, result)) {
    issues.push("confidently promises a feature that is not in the profile or matching package");
  }

  return { result, issues };
}
