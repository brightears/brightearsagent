import type { MetadataRoute } from "next";
import { appUrlLenient } from "@/lib/app-url";
import { getAgencyRoster } from "@/lib/agency/roster";

export const revalidate = 300;

/** Public agency services and visible artists only. No account, private
 * feedback, or retired assistant acquisition routes belong in this index. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = appUrlLenient();
  const artists = await getAgencyRoster();
  return [
    { url: origin, changeFrequency: "monthly", priority: 1 },
    { url: `${origin}/venues`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${origin}/events`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${origin}/artists`, changeFrequency: "weekly", priority: 0.8 },
    ...artists.map(artist => ({
      url: `${origin}/artists/${encodeURIComponent(artist.id)}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
