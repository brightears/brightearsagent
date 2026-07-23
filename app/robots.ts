import type { MetadataRoute } from "next";
import { appUrlLenient } from "@/lib/app-url";

/** Canonical origin: APP_URL on the temporary Render deploy, brightears.io after cutover. */
const BASE = appUrlLenient();

/** App-private surfaces; everything marketing-facing stays crawlable. */
const PRIVATE = ["/dashboard/", "/api/"];

/**
 * Staging must never become the canonical "Bright Ears" in the index (audit
 * 2026-07: the onrender.com host was fully crawlable with no canonical
 * strategy — Google could keep it as THE site after cutover). Env-gated so
 * this flips itself at cutover, when APP_URL becomes the real domain. A
 * MISSING APP_URL reads as staging too — the safe failure mode is disallow,
 * never an indexed staging host.
 */
const IS_STAGING = !process.env.APP_URL || BASE.includes("onrender.com");

export default function robots(): MetadataRoute.Robots {
  if (IS_STAGING) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }
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
