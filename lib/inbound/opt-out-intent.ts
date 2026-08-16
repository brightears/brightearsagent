/**
 * A deliberately small, deterministic consent classifier for inbound replies.
 *
 * This is not sentiment analysis: "not interested" is a commercial answer,
 * while "do not contact me again" is a compliance hard stop. Only explicit,
 * high-confidence wording is accepted here. Ambiguous negatives stay in the
 * normal reply flow for the artist to handle.
 */
export type ExplicitOptOutReason = "unsubscribe" | "cease-and-desist";

const ORIGINAL_MESSAGE_BOUNDARY = [
  /^on\s+.{1,240}\s+wrote:\s*$/i,
  /^-{2,}\s*(?:original|forwarded)\s+message\s*-{2,}$/i,
  /^begin\s+forwarded\s+message:\s*$/i,
];

function isOutlookHeaderBoundary(lines: string[], index: number): boolean {
  if (!/^from:\s*\S+/i.test(lines[index]?.trim() ?? "")) return false;
  const headerBlock = lines
    .slice(index + 1, index + 6)
    .map((line) => line.trim())
    .join("\n");
  return /^(?:sent|date):\s*.+$/im.test(headerBlock) && /^(?:to|subject):\s*.+$/im.test(headerBlock);
}

/**
 * Keep only the sender's newly-written portion of a plain-text reply.
 * Quoted history is especially dangerous here because our own compliance
 * footer contains opt-out language.
 */
export function dequoteNewReply(body: string): string {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const kept: string[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = line.trim();

    if (
      ORIGINAL_MESSAGE_BOUNDARY.some((boundary) => boundary.test(trimmed)) ||
      isOutlookHeaderBoundary(lines, index)
    ) {
      break;
    }
    // The conventional signature delimiter ends the human-authored reply.
    // This also avoids treating opt-out links in a corporate signature as the
    // sender's instruction to this artist.
    if (trimmed === "--" || trimmed === "-- ") break;
    if (/^\s*>/.test(line)) continue;
    kept.push(line);
  }

  return kept.join("\n").replace(/[ \t]+\n/g, "\n").trim();
}

const CEASE_AND_DESIST_PATTERNS = [
  /(?:^|[.!?]\s+)(?:please\s+)?cease[- ](?:and|&)[- ]desist\b/i,
  /(?:^|[.!?]\s+)(?:this\s+is|consider\s+this)\s+(?:a\s+)?cease[- ]and[- ]desist(?=$|[.!?])/i,
];

const UNSUBSCRIBE_PATTERNS = [
  /\b(?:please\s+)?unsubscribe\s+(?:me|us|this\s+(?:email|address))(?:\s+from\s+(?:(?:your|all)\s+)?(?:emails?|messages?|(?:mailing\s+|email\s+|contact\s+)?list))?(?=$|[.!?])/i,
  /(?:^|[.!?]\s+)(?:please\s+)?unsubscribe(?:\s+(?:me|us|this\s+(?:email|address)))?(?:\s+from\s+(?:(?:your|all)\s+)?(?:emails?|messages?|(?:mailing\s+|email\s+|contact\s+)?list))?(?=$|[.!?])/i,
  /\b(?:please\s+)?opt\s+(?:me|us)\s+out(?:\s+of\s+(?:your\s+)?(?:emails?|messages?|mailing\s+list|contact\s+list))?(?=$|[.!?])/i,
  /\b(?:please\s+)?(?:remove|take)\s+(?:me|us|my\s+(?:email|address)|this\s+(?:email|address))\s+(?:off|from)\s+(?:your\s+|the\s+)?(?:mailing\s+list|email\s+list|contact\s+list|database)\b/i,
  /\b(?:please\s+)?stop\s+(?:emailing|contacting|messaging)\s+(?:me|us|this\s+(?:email|address))(?:\s+again)?(?=$|[.!?])/i,
  /\b(?:please\s+)?stop\s+sending\s+(?:me|us|this\s+(?:email|address))\s+(?:emails?|messages?)(?:\s+again)?(?=$|[.!?])/i,
  /\b(?:do\s+not|don['’]?t|never)\s+(?:email|contact|message|write\s+to)\s+(?:me|us|this\s+(?:email|address))(?:\s+again)?(?=$|[.!?])/i,
  /\b(?:do\s+not|don['’]?t)\s+send\s+(?:me|us)\s+(?:any\s+)?(?:more|further)\s+(?:emails?|messages?)(?:\s+again)?(?=$|[.!?])/i,
  /\b(?:i|we)\s+(?:do\s+not|don['’]?t)\s+(?:want|wish)\s+to\s+(?:receive|get)\s+(?:any\s+)?(?:more|further)\s+(?:emails?|messages?)\b/i,
  /\bno\s+more\s+(?:emails?|messages?)(?:\s+from\s+(?:you|your\s+(?:company|business)))?\b/i,
];

// High-confidence phrases for every non-English language the venue pitcher
// advertises. These deliberately require an explicit unsubscribe, no-contact,
// or no-more-email instruction; ordinary “not interested” translations must
// stay commercial replies, not become consent events.
const MULTILINGUAL_UNSUBSCRIBE_PATTERNS = [
  // German (de)
  /\bbitte\s+(?:löschen\s+sie\s+(?:mich|uns)\s+aus\s+(?:ihrem|dem)\s+(?:e-?mail-?)?verteiler|kontaktieren\s+sie\s+(?:mich|uns)\s+nicht\s+mehr|keine\s+weiteren\s+e-?mails?\s+(?:senden|schicken))\b/iu,
  /\b(?:ich|wir)\s+möchte(?:n)?\s+keine\s+weiteren\s+e-?mails?\s+erhalten\b/iu,
  // French (fr)
  /\b(?:veuillez|merci\s+de)\s+(?:me|nous)\s+désabonner\b/iu,
  /\bne\s+(?:me|nous)\s+contactez\s+plus\b/iu,
  /\bje\s+ne\s+souhaite\s+plus\s+recevoir\s+(?:vos\s+)?(?:e-?mails?|messages?)\b/iu,
  // Spanish (es)
  /\bpor\s+favor[,]?\s+(?:denme|dénme|darme)\s+de\s+baja\b/iu,
  /\b(?:elimínenme|eliminarme)\s+de\s+(?:su|la)\s+lista\s+de\s+correo\b/iu,
  /\bno\s+(?:me|nos)\s+contacten\s+más\b/iu,
  /\bno\s+quiero\s+recibir\s+más\s+correos?(?:\s+electrónicos)?\b/iu,
  // Italian (it)
  /\bper\s+favore[,]?\s+cancellate(?:mi|ci)\s+dalla\s+vostra\s+mailing\s+list\b/iu,
  /\bnon\s+contattate(?:mi|ci)\s+più(?=$|[.!?])/iu,
  /\bnon\s+voglio\s+ricevere\s+altre\s+e-?mail\b/iu,
  // Dutch (nl)
  /\b(?:schrijf|meld)\s+(?:mij|ons)\s+(?:uit|af)\b/iu,
  /\bneem\s+geen\s+contact\s+meer\s+met\s+(?:mij|ons)\s+op\b/iu,
  /\bik\s+wil\s+geen\s+e-?mails?\s+meer\s+ontvangen\b/iu,
  // Portuguese (pt)
  /\b(?:por\s+favor[,]?\s+)?remova-(?:me|nos)\s+da\s+sua\s+lista\s+de\s+e-?mails?\b/iu,
  /\bnão\s+(?:me|nos)\s+contacte\s+mais\b/iu,
  /\bnão\s+quero\s+receber\s+mais\s+e-?mails?\b/iu,
  // Thai (th)
  /(?:กรุณา|โปรด)ยกเลิกการรับอีเมล(?:ของฉัน|ให้ฉัน)?/u,
  /(?:กรุณา|โปรด)อย่าติดต่อ(?:ฉัน|เรา)อีก/u,
  /(?:ฉัน|เรา)ไม่ต้องการรับอีเมลอีก/u,
  // Japanese (ja)
  /配信停止(?:を)?(?:お願い(?:します)?|してください)/u,
  /今後(?:は)?(?:私|当社|弊社)?(?:に)?連絡しないでください/u,
  /(?:私|当社|弊社)?(?:に)?(?:これ以上)?メールを送らないでください/u,
];

/** Return a suppression reason only for an explicit instruction to stop. */
export function detectExplicitOptOut(body: string): ExplicitOptOutReason | null {
  // Collapse whitespace so sentence patterns also work across short wrapped
  // lines, but preserve punctuation as an intent boundary.
  const fresh = dequoteNewReply(body)
    .replace(/\s*\n+\s*/g, ". ")
    .replace(/[\t ]+/g, " ")
    .replace(/[“”]/g, '"')
    .trim();
  if (!fresh) return null;

  if (CEASE_AND_DESIST_PATTERNS.some((pattern) => pattern.test(fresh))) {
    return "cease-and-desist";
  }
  if (UNSUBSCRIBE_PATTERNS.some((pattern) => pattern.test(fresh))) {
    return "unsubscribe";
  }
  if (MULTILINGUAL_UNSUBSCRIBE_PATTERNS.some((pattern) => pattern.test(fresh))) {
    return "unsubscribe";
  }
  return null;
}
