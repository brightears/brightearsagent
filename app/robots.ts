import type { MetadataRoute } from "next";

/** Canonical origin: APP_URL on the temporary Render deploy, brightears.io after cutover. */
const BASE = process.env.APP_URL ?? "https://brightears.io";

/** App-private surfaces; everything marketing-facing stays crawlable. */
const PRIVATE = ["/dashboard/", "/api/"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE,
      },
      // AI crawlers, explicitly welcome (AEO): being quotable by assistants is
      // part of the marketing plan, so don't leave their access to the wildcard.
      {
        userAgent: ["GPTBot", "ClaudeBot", "Claude-Web", "PerplexityBot", "OAI-SearchBot"],
        allow: "/",
        disallow: PRIVATE,
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
