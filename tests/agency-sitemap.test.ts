import { beforeEach, describe, expect, it, vi } from "vitest";

const roster = vi.hoisted(() => vi.fn());
vi.mock("@/lib/agency/roster", () => ({ getAgencyRoster: roster }));
vi.mock("@/lib/app-url", () => ({ appUrlLenient: () => "https://brightears.io" }));
import sitemap from "@/app/sitemap";

describe("agency sitemap", () => {
  beforeEach(() => roster.mockReset());

  it("indexes the current public roster alongside the agency buying paths", async () => {
    roster.mockResolvedValue([{ id: "dj-benji" }, { id: "dj-ufo" }]);
    const urls = (await sitemap()).map(entry => entry.url);
    expect(urls).toEqual([
      "https://brightears.io",
      "https://brightears.io/venues",
      "https://brightears.io/events",
      "https://brightears.io/artists",
      "https://brightears.io/artists/dj-benji",
      "https://brightears.io/artists/dj-ufo",
    ]);
    expect(urls.some(url => /assistant|portal|feedback|dashboard/.test(url))).toBe(false);
  });

  it("keeps public buying pages available when the roster is unavailable", async () => {
    roster.mockResolvedValue([]);
    const entries = await sitemap();
    expect(entries).toHaveLength(4);
    expect(entries.every(entry => !entry.lastModified)).toBe(true);
  });
});
