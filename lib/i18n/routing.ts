// Crawlable language URLs for the agency marketing pages.
//
// Before November 2026 the Thai copy was content-negotiated on one URL (cookie
// or Accept-Language), so search engines only ever saw English and every Thai
// render declared the English URL as canonical. Thai now lives under a /th
// prefix: proxy.ts rewrites /th/<page> to the existing route and tells the
// render which language the URL asked for through LOCALE_HEADER.
//
// Why a prefix and not ?lang=th: a path is part of the URL people copy, share
// and bookmark, and usePathname()/Link keep it without extra plumbing; query
// strings get dropped by link sharing, analytics and our own returnTo handling,
// and invite unbounded ?lang= variants of every page. Subdirectories are also
// the form search engines document for language versions.
//
// Pure functions, no Next imports, so proxy, pages, sitemap and tests share
// one definition of which pages have a Thai version.

import { DEFAULT_LOCALE, isLocale, localeFromAcceptLanguage, type Locale } from "@/lib/i18n/config";

/** Request header proxy.ts sets on localized pages; getRequestLocale trusts it first. */
export const LOCALE_HEADER = "x-be-url-locale";

export const THAI_PREFIX = "/th";

const LOCALIZED_EXACT = new Set([
  "/",
  "/venues",
  "/events",
  "/venues/bangkok",
  "/venues/pattaya",
  "/events/new-years-eve",
  "/acts",
  "/artists",
  "/join",
]);

/** Artist profile and its promotion kit; the id is one segment. */
const LOCALIZED_ARTIST = /^\/artists\/[^/]+(?:\/kit)?$/;

/** Marketing pages that have real Thai copy and therefore a /th URL. */
export function isLocalizedPath(pathname: string): boolean {
  return LOCALIZED_EXACT.has(pathname) || LOCALIZED_ARTIST.test(pathname);
}

/** Split a browser path into the language its URL names and the route path. */
export function splitLocalePath(pathname: string): { locale: Locale; path: string } {
  if (pathname === THAI_PREFIX) return { locale: "th", path: "/" };
  if (pathname.startsWith(`${THAI_PREFIX}/`)) return { locale: "th", path: pathname.slice(THAI_PREFIX.length) };
  return { locale: DEFAULT_LOCALE, path: pathname };
}

/**
 * The URL of `href` in `locale`. Only same-site paths with a Thai version gain
 * the prefix; anchors, external links and English-only pages pass through.
 * Query strings and fragments are kept: "/?artists=x#brief" -> "/th?artists=x#brief".
 */
export function localizedPath(href: string, locale: Locale): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const cut = href.search(/[?#]/);
  const pathname = cut === -1 ? href : href.slice(0, cut);
  const rest = cut === -1 ? "" : href.slice(cut);
  const { path } = splitLocalePath(pathname);
  if (locale === DEFAULT_LOCALE || !isLocalizedPath(path)) return path + rest;
  return (path === "/" ? THAI_PREFIX : THAI_PREFIX + path) + rest;
}

/**
 * Metadata alternates for a localized page: a self-referencing canonical for
 * the language being rendered, plus hreflang links to both versions. The
 * English URL doubles as x-default because it still sends a visitor who chose
 * Thai to the Thai page.
 */
export function localeAlternates(path: string, locale: Locale) {
  const en = localizedPath(path, "en");
  const th = localizedPath(path, "th");
  return {
    canonical: locale === "th" ? th : en,
    languages: { en, th, "x-default": en },
  };
}

export type LocaleRoute =
  /** Serve `pathname` and render it in `locale`. */
  | { action: "rewrite"; pathname: string; locale: Locale }
  /** Serve the request as is, rendered in `locale`. */
  | { action: "tag"; locale: Locale }
  /** Send the visitor to their chosen language's URL. */
  | { action: "redirect"; pathname: string }
  /** Not a localized page: existing cookie/Accept-Language behaviour applies. */
  | { action: "pass" };

/**
 * Decide how proxy.ts treats a request.
 *
 * - /th/<localized page> renders Thai, whatever cookie the visitor holds: the
 *   URL is the language, so shared links and crawlers see one stable version.
 * - An unprefixed localized page renders English, except that a GET from a
 *   visitor who chose Thai (be_locale cookie) or whose browser asks for Thai
 *   (no cookie) is sent to the /th URL. Crawlers send neither and stay on
 *   English; hreflang tells them where the Thai version is.
 * - /th/<anything else> is left alone and 404s: there is no Thai version.
 */
export function resolveLocaleRoute(input: {
  method: string;
  pathname: string;
  cookieLocale: string | undefined;
  acceptLanguage: string | null;
}): LocaleRoute {
  const { locale, path } = splitLocalePath(input.pathname);
  if (!isLocalizedPath(path)) return { action: "pass" };
  if (locale === "th") return { action: "rewrite", pathname: path, locale };

  const navigation = input.method === "GET" || input.method === "HEAD";
  const preferred = isLocale(input.cookieLocale) ? input.cookieLocale : localeFromAcceptLanguage(input.acceptLanguage);
  if (navigation && preferred === "th") return { action: "redirect", pathname: localizedPath(path, "th") };
  return { action: "tag", locale: DEFAULT_LOCALE };
}
