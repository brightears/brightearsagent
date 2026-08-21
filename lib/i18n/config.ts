export const SUPPORTED_LOCALES = ["en", "th"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "be_locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && SUPPORTED_LOCALES.includes(value as Locale);
}

export function normalizeLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Match the languages Bright Ears supports without adding a negotiation
 * dependency. Thai regional tags (th-TH, th-LA, etc.) all resolve to Thai;
 * everything else safely falls back to English.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;

  const preferences = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const quality = params
        .map((param) => param.trim().match(/^q=([0-9.]+)$/i)?.[1])
        .find(Boolean);
      return { tag: tag.toLowerCase(), quality: quality ? Number(quality) : 1 };
    })
    .filter(({ quality }) => Number.isFinite(quality) && quality > 0)
    .sort((a, b) => b.quality - a.quality);

  return preferences.some(({ tag }) => tag === "th" || tag.startsWith("th-"))
    ? "th"
    : DEFAULT_LOCALE;
}

export function languageTag(locale: Locale): "en-US" | "th-TH" {
  return locale === "th" ? "th-TH" : "en-US";
}
