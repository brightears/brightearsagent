import { beforeEach, describe, expect, it, vi } from "vitest";

const roster = vi.hoisted(() => vi.fn());
vi.mock("@/lib/agency/roster", () => ({ getAgencyRoster: roster }));
vi.mock("@/lib/app-url", () => ({ appUrlLenient: () => "https://brightears.io" }));
import sitemap from "@/app/sitemap";

const ORIGIN = "https://brightears.io";
const ENGLISH = [
  ORIGIN,
  `${ORIGIN}/venues`,
  `${ORIGIN}/events`,
  `${ORIGIN}/venues/bangkok`,
  `${ORIGIN}/venues/pattaya`,
  `${ORIGIN}/events/new-years-eve`,
  `${ORIGIN}/acts`,
  `${ORIGIN}/artists`,
  `${ORIGIN}/artists/dj-benji`,
  `${ORIGIN}/artists/dj-ufo`,
  `${ORIGIN}/join`,
];
const thai = (url: string) => (url === ORIGIN ? `${ORIGIN}/th` : url.replace(ORIGIN, `${ORIGIN}/th`));

describe("agency sitemap", () => {
  beforeEach(() => roster.mockReset());

  it("indexes the current public roster alongside the agency buying paths, in English and Thai", async () => {
    roster.mockResolvedValue([{ id: "dj-benji" }, { id: "dj-ufo" }]);
    const urls = (await sitemap()).map(entry => entry.url);
    expect(urls).toEqual(ENGLISH.flatMap(url => [url, thai(url)]));
    expect(urls.some(url => /assistant|portal|feedback|dashboard|privacy/.test(url))).toBe(false);
  });

  it("links each language version to the other with hreflang and an English x-default", async () => {
    roster.mockResolvedValue([{ id: "dj-ufo" }]);
    const entries = await sitemap();
    const byUrl = new Map(entries.map(entry => [entry.url, entry]));
    for (const url of [ORIGIN, `${ORIGIN}/venues/bangkok`, `${ORIGIN}/artists/dj-ufo`]) {
      const languages = { en: url, th: thai(url), "x-default": url };
      expect(byUrl.get(url)?.alternates).toEqual({ languages });
      expect(byUrl.get(thai(url))?.alternates).toEqual({ languages });
      expect(byUrl.get(thai(url))?.priority).toBe(byUrl.get(url)?.priority);
    }
  });

  it("keeps public buying pages available when the roster is unavailable", async () => {
    roster.mockResolvedValue([]);
    const entries = await sitemap();
    expect(entries).toHaveLength(18);
    expect(entries.every(entry => !entry.lastModified)).toBe(true);
  });
});
