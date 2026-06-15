import type { MetadataRoute } from "next";

/** Canonical origin: APP_URL on the temporary Render deploy, brightears.io after cutover. */
const BASE = process.env.APP_URL ?? "https://brightears.io";

const ROUTES: { path: string; changeFrequency: "weekly" | "monthly" | "yearly"; priority: number }[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/pricing", changeFrequency: "monthly", priority: 0.9 },
  { path: "/compare", changeFrequency: "monthly", priority: 0.8 },
  { path: "/story", changeFrequency: "yearly", priority: 0.7 },
  { path: "/tools/inquiry-reply-generator", changeFrequency: "monthly", priority: 0.8 },
  { path: "/tools/templates", changeFrequency: "monthly", priority: 0.8 },
  { path: "/tools/lead-roi-calculator", changeFrequency: "monthly", priority: 0.8 },
  { path: "/onboarding", changeFrequency: "monthly", priority: 0.6 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/acceptable-use", changeFrequency: "yearly", priority: 0.3 },
  { path: "/cookies", changeFrequency: "yearly", priority: 0.3 },
  { path: "/dpa", changeFrequency: "yearly", priority: 0.3 },
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
