import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Metadata } from "next";

// Every localized marketing page must declare its own language URL as
// canonical (the /th rewrite hides the prefix from Next, so "./" would point
// Thai pages at English) and link both versions with hreflang.

const locale = vi.hoisted(() => ({ current: "en" as "en" | "th" }));
vi.mock("@/lib/i18n/server", () => ({ getRequestLocale: async () => locale.current }));
vi.mock("@/lib/app-url", () => ({ appUrlLenient: () => "https://brightears.io" }));
vi.mock("@/lib/agency/roster", async importOriginal => ({
  ...(await importOriginal<typeof import("@/lib/agency/roster")>()),
  getAgencyRoster: async () => [{ id: "dj-ufo", name: "UFO", bio: "English bio", bioTh: "ประวัติภาษาไทย", genres: [], links: [] }],
}));

type MetaFn = (props: { params: Promise<{ id: string }> }) => Promise<Metadata>;
const params = { params: Promise.resolve({ id: "dj-ufo" }) };

const pages: Array<[string, () => Promise<{ generateMetadata: MetaFn }>]> = [
  ["/", () => import("@/app/(marketing)/page") as never],
  ["/venues", () => import("@/app/(marketing)/venues/page") as never],
  ["/events", () => import("@/app/(marketing)/events/page") as never],
  ["/venues/bangkok", () => import("@/app/(marketing)/venues/bangkok/page") as never],
  ["/venues/pattaya", () => import("@/app/(marketing)/venues/pattaya/page") as never],
  ["/events/new-years-eve", () => import("@/app/(marketing)/events/new-years-eve/page") as never],
  ["/acts", () => import("@/app/(marketing)/acts/page") as never],
  ["/artists", () => import("@/app/(marketing)/artists/page") as never],
  ["/artists/dj-ufo", () => import("@/app/(marketing)/artists/[id]/page") as never],
  ["/artists/dj-ufo/kit", () => import("@/app/(marketing)/artists/[id]/kit/page") as never],
  ["/join", () => import("@/app/(marketing)/join/page") as never],
];

describe("marketing page language alternates", () => {
  beforeEach(() => {
    locale.current = "en";
  });

  it.each(pages)("%s declares a self-referencing canonical and en/th/x-default", async (path, load) => {
    const { generateMetadata } = await load();
    const th = path === "/" ? "/th" : `/th${path}`;
    const languages = { en: path, th, "x-default": path };

    const english = await generateMetadata(params);
    expect(english.alternates).toEqual({ canonical: path, languages });
    expect(english.openGraph).toMatchObject({ url: path, locale: "en_US" });

    locale.current = "th";
    const thai = await generateMetadata(params);
    expect(thai.alternates).toEqual({ canonical: th, languages });
    expect(thai.openGraph).toMatchObject({ url: th, locale: "th_TH" });
    // A profile title is the artist's stage name in both languages.
    if (path !== "/artists/dj-ufo") expect(thai.title).not.toEqual(english.title);
  });

  it("describes a Thai artist profile with the Thai biography", async () => {
    const { generateMetadata } = (await import("@/app/(marketing)/artists/[id]/page")) as unknown as { generateMetadata: MetaFn };
    locale.current = "th";
    expect((await generateMetadata(params)).description).toBe("ประวัติภาษาไทย");
  });
});
