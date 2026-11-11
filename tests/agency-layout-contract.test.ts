import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Layout contracts found in the 10 November 2026 design QA
// (records root team/web/design-qa-2026-11-10.md). They guard causes, not
// pixels: each rule below produced a visible collision or clipped text on the
// live site before it was fixed.
const root = path.resolve(__dirname, "..");
const css = (file: string) => readFileSync(path.join(root, file), "utf8");
const rules = (source: string, selector: string) =>
  [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, sel]) => sel.split(",").some(s => s.trim().replace(/^@media[^{]*/, "").trim() === selector))
    .map(([, , body]) => body);

const agency = css("app/(marketing)/agency.module.css");
const services = css("app/(marketing)/services.module.css");

describe("home hero layout", () => {
  it("never pins the tagline strip over the hero copy", () => {
    // The strip was position:absolute at the bottom of a viewport-height hero
    // whose headline scales with width, so short laptop windows and 200% text
    // put "FROM THE FIRST DRINK TO THE LAST TRACK" across the buttons.
    for (const body of rules(agency, ".heroBase")) {
      expect(body).not.toMatch(/position:\s*(absolute|fixed)/);
      expect(body).not.toMatch(/(^|;)\s*(bottom|top):/);
    }
  });

  it("lets the hero grow with its content instead of a fixed height", () => {
    const hero = rules(agency, ".nocturneHero");
    expect(hero.length).toBeGreaterThan(0);
    for (const body of hero) {
      expect(body).not.toMatch(/(^|;)\s*(height|max-height):/);
    }
    expect(hero[0]).toMatch(/flex-direction:\s*column/);
  });
});

describe("home hero on short windows (option B, decided 10 Nov 2026)", () => {
  it("scales the headline with window height only on wide, short windows", () => {
    // Phones (<=800px) and windows 900px or taller keep the original sizes.
    const block = agency.match(/@media\(min-width:801px\) and \(max-height:899px\)\{(.*?)\}\s*\n/)?.[1] ?? "";
    expect(block).toMatch(/\.nocturneCopy h1\{[^}]*font-size:clamp\(5rem,min\(10\.2vw,calc\(\(100svh - 400px\)\*var\(--hero-fit\)\)\),10\.5rem\)/);
    expect(block).toMatch(/\.nocturneHero\{min-height:calc\(100svh - 88px\)\}/);
    expect(agency).toMatch(/\.nocturneCopy\{--hero-fit:\.48\}/);
    expect(agency).toMatch(/\.shell:lang\(th\) \.nocturneCopy\{--hero-fit:\.38\}/);
  });
});

describe("panels that hold text", () => {
  it("use a minimum height so enlarged text is not clipped", () => {
    for (const body of rules(agency, ".servicePanel")) {
      expect(body).not.toMatch(/(^|;)\s*height:/);
    }
  });

  it("single-column grids can shrink below their longest word", () => {
    for (const selector of [".approach", ".hero", ".questions", ".planner"]) {
      for (const body of rules(services, selector)) {
        expect(body).not.toMatch(/grid-template-columns:\s*1fr\s*(;|$)/);
      }
    }
  });
});

describe("legal effective-date notice", () => {
  it("does not use light text on the cream card", () => {
    const legal = css("components/legal-page.tsx");
    const banner = legal.slice(legal.indexOf("export function EffectiveBanner"), legal.indexOf("export function ToBeCompleted"));
    expect(banner).not.toMatch(/text-cream/);
    expect(banner).not.toMatch(/text-brand-cyan/);
  });
});
