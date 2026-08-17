import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const LEGAL_PAGES = [
  "app/(marketing)/privacy/page.tsx",
  "app/(marketing)/terms/page.tsx",
  "app/(marketing)/cookies/page.tsx",
  "app/(marketing)/dpa/page.tsx",
  "app/(marketing)/acceptable-use/page.tsx",
] as const;

function source(path: string): string {
  return readFileSync(path, "utf8");
}

describe("effective legal release", () => {
  it("publishes every legal page without draft or noindex metadata", () => {
    for (const path of LEGAL_PAGES) {
      const page = source(path);
      expect(page, path).not.toMatch(/\(draft\)|pending legal review|index:\s*false/i);
      expect(page, path).toMatch(/robots:\s*\{\s*index:\s*true,\s*follow:\s*true\s*\}/);
    }

    const frame = source("components/legal-page.tsx");
    expect(frame).toContain('LAST_UPDATED = "August 17, 2026"');
    expect(frame).toContain("Effective August 17, 2026");
    expect(frame).not.toMatch(/not yet effective|DraftBanner/);
  });

  it("publishes the verified Bright Ears registered office", () => {
    const company = source("lib/legal/company.ts");
    expect(company).toContain("Bright Ears Co., Ltd. (Head Office)");
    expect(company).toContain("11/10, Moo 17, Soi Panjit 3, Garden Home Village");
    expect(company).toContain("Pathum Thani 12130, Thailand");
  });

  it("records the founder-approved controlled-launch LIA restrictions", () => {
    const lia = source("docs/HUNT-LIA.md");
    expect(lia).toContain("approved for controlled launch");
    expect(lia).toContain("Norbert Platzer, founder");
    expect(lia).toContain("GB, CA, DE, AT and unknown countries remain consent/manual-only");
    expect(lia).toContain("Independent legal opinion | Not commissioned");
  });
});
