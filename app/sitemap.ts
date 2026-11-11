import type { MetadataRoute } from "next";
import { appUrlLenient } from "@/lib/app-url";
import { getAgencyRoster } from "@/lib/agency/roster";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";
import { localeAlternates } from "@/lib/i18n/routing";

export const revalidate = 300;

type Page = { path: string; changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>; priority: number };

/** Public agency services and visible artists only. No account, private
 * feedback, or retired assistant acquisition routes belong in this index.
 * Every page here has a Thai version at /th<path>; each language gets its own
 * entry, and both carry the same hreflang set (en, th, x-default). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = appUrlLenient();
  const artists = await getAgencyRoster();
  const pages: Page[] = [
    { path: "/", changeFrequency: "monthly", priority: 1 },
    { path: "/venues", changeFrequency: "monthly", priority: 0.9 },
    { path: "/events", changeFrequency: "monthly", priority: 0.9 },
    { path: "/venues/bangkok", changeFrequency: "monthly", priority: 0.8 },
    { path: "/venues/pattaya", changeFrequency: "monthly", priority: 0.8 },
    { path: "/events/new-years-eve", changeFrequency: "weekly", priority: 0.8 },
    { path: "/acts", changeFrequency: "monthly", priority: 0.8 },
    { path: "/artists", changeFrequency: "weekly", priority: 0.8 },
    ...artists.map(artist => ({
      path: `/artists/${encodeURIComponent(artist.id)}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { path: "/join", changeFrequency: "monthly", priority: 0.5 },
  ];
  // The English home stays the bare origin (no trailing slash), as before.
  const absolute = (path: string) => (path === "/" ? origin : `${origin}${path}`);
  return pages.flatMap(page => {
    const { languages } = localeAlternates(page.path, "en");
    const alternates = {
      languages: Object.fromEntries(Object.entries(languages).map(([tag, path]) => [tag, absolute(path)])),
    };
    return SUPPORTED_LOCALES.map(locale => ({
      url: absolute(localeAlternates(page.path, locale).canonical),
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates,
    }));
  });
}
