/**
 * HTML→text for HTML-only inbound email (10.9). Some form systems and mail
 * clients give Postmark no TextBody at all — before this, those inquiries hit
 * every parser, triage, the thread view, and the drafter as an empty string
 * (or raw markup). processInbound strips ONCE at the door so every consumer
 * sees words. Deliberately dependency-free: block tags become line breaks,
 * script/style/head vanish, entities decode, whitespace collapses.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      // Whole subtrees that are never content.
      .replace(/<(script|style|head|title)\b[\s\S]*?<\/\1>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      // Line-break-ish tags → newlines BEFORE stripping the rest, so
      // "<p>Name: Jo</p><p>Email: jo@x.com</p>" keeps its field-per-line shape
      // (the labeled-field shape the fallback parser's prompt relies on).
      .replace(/<(br|hr)\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|tr|li|h[1-6]|blockquote|table|section)>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "- ")
      // Everything else just disappears.
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
