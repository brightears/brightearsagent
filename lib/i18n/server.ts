import "server-only";

import { cookies, headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  localeFromAcceptLanguage,
  type Locale,
} from "@/lib/i18n/config";
import { translator } from "@/lib/i18n/messages";
import { LOCALE_HEADER } from "@/lib/i18n/routing";

/**
 * The language to render. On localized marketing pages the URL decides (proxy
 * sets LOCALE_HEADER from /th or its absence); everywhere else the visitor's
 * cookie, then their browser preference.
 */
export async function getRequestLocale(): Promise<Locale> {
  const requestHeaders = await headers();
  const urlLocale = requestHeaders.get(LOCALE_HEADER);
  if (isLocale(urlLocale)) return urlLocale;

  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;

  const acceptLanguage = requestHeaders.get("accept-language");
  return localeFromAcceptLanguage(acceptLanguage) ?? DEFAULT_LOCALE;
}

export async function getTranslations() {
  const locale = await getRequestLocale();
  return { locale, t: translator(locale) };
}
