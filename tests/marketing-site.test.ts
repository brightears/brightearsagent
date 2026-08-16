import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pageMeta } from "@/lib/marketing/site";

const MARKETING_LINK_FILES = [
  "app/(marketing)/compare/[slug]/page.tsx",
  "app/(marketing)/compare/page.tsx",
  "app/(marketing)/layout.tsx",
  "app/(marketing)/page.tsx",
  "app/(marketing)/pricing/page.tsx",
  "app/(marketing)/story/page.tsx",
  "app/(marketing)/tools/inquiry-reply-generator/page.tsx",
  "app/(marketing)/tools/lead-roi-calculator/page.tsx",
  "app/(marketing)/tools/templates/page.tsx",
  "components/demo-widget.tsx",
  "components/lead-roi-calculator.tsx",
  "components/marketing-mobile-menu.tsx",
] as const;

const PUBLIC_MAGENTA_FILES = [
  ...MARKETING_LINK_FILES,
  "components/booking-signal-stage.tsx",
  "components/epk-inquiry-form.tsx",
  "components/ui.tsx",
] as const;

function source(path: string): string {
  return readFileSync(path, "utf8");
}

function relativeLuminance(hex: string): number {
  const channels = hex
    .replace("#", "")
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (left, right) => right - left,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

describe("public marketing guardrails", () => {
  it("uses AA-contrast ink text on the neon-magenta action colour", () => {
    expect(contrastRatio("#ff2dae", "#17161f")).toBeGreaterThanOrEqual(4.5);

    for (const path of PUBLIC_MAGENTA_FILES) {
      expect(source(path), path).not.toMatch(
        /(?:bg-neon-magenta[^"'`\n]*text-white|text-white[^"'`\n]*bg-neon-magenta)/,
      );
    }
  });

  it("keeps the setup steps as direct list items", () => {
    const homepage = source("app/(marketing)/page.tsx");
    const setupList = homepage.match(
      /<ol className="relative grid gap-6 lg:grid-cols-3">([\s\S]*?)<\/ol>/,
    )?.[1];

    expect(setupList).toBeDefined();
    expect(setupList).toMatch(/SETUP_STEPS\.map[\s\S]*?<li key=\{step\.number\}/);
    expect(setupList).not.toMatch(/<RevealOnScroll[^>]*>\s*<li/);
    expect(setupList).not.toMatch(/<div\s+aria-hidden/);
  });

  it("does not prefetch auth-protected routes from public pages", () => {
    let protectedLinkCount = 0;

    for (const path of MARKETING_LINK_FILES) {
      const linkTags = source(path).match(/<Link\b[\s\S]*?>/g) ?? [];
      for (const tag of linkTags) {
        if (!/href=(?:"\/(?:onboarding|dashboard)"|\{`\/onboarding[^`]*`\})/.test(tag)) {
          continue;
        }
        protectedLinkCount += 1;
        expect(tag, `${path}: ${tag}`).toContain("prefetch={false}");
      }
    }

    expect(protectedLinkCount).toBeGreaterThan(0);
  });

  it("emits a route-relative canonical Open Graph URL", () => {
    const metadata = pageMeta("Title", "Description");
    expect(metadata.openGraph).toMatchObject({ url: "./" });
  });
});
