import type { MetadataRoute } from "next";
import { COMPARISON_SLUGS } from "@/lib/marketing/comparisons";

/** Canonical origin: APP_URL on the temporary Render deploy, brightears.io after cutover. */
const BASE = process.env.APP_URL ?? "https://brightears.io";

// What belongs here (audit 2026-07 — the old list was inverted): the six
// /compare/[slug] head-to-heads are the highest-intent SEO pages and were
// MISSING; /onboarding (auth-gated 307) and the noindexed legal pages were
// listed and are gone. A sitemap should only name pages we want ranked.
const ROUTES: { path: string; changeFrequency: "weekly" | "monthly" | "yearly"; priority: number }[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/pricing", changeFrequency: "monthly", priority: 0.9 },
  { path: "/compare", changeFrequency: "monthly", priority: 0.8 },
  ...COMPARISON_SLUGS.map((slug) => ({
    path: `/compare/${slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  })),
  { path: "/roadmap", changeFrequency: "monthly", priority: 0.5 },
  { path: "/story", changeFrequency: "yearly", priority: 0.7 },
  { path: "/tools/inquiry-reply-generator", changeFrequency: "monthly", priority: 0.8 },
  { path: "/tools/templates", changeFrequency: "monthly", priority: 0.8 },
  { path: "/tools/lead-roi-calculator", changeFrequency: "monthly", priority: 0.8 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map((r) => ({
    url: `${BASE}${r.path === "/" ? "" : r.path}`,
    lastModified,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
