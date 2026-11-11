import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isLocalizedPath,
  localeAlternates,
  localizedPath,
  resolveLocaleRoute,
  splitLocalePath,
} from "@/lib/i18n/routing";

// Thai copy used to be content-negotiated on one URL, so crawlers only saw
// English. These pin the /th URL scheme that proxy.ts, the pages and the
// sitemap share.

describe("localized marketing paths", () => {
  it.each(["/", "/venues", "/events", "/venues/bangkok", "/venues/pattaya", "/events/new-years-eve", "/acts", "/artists", "/artists/dj-ufo", "/artists/dj-ufo/kit", "/join"])(
    "%s has a Thai version",
    path => expect(isLocalizedPath(path)).toBe(true),
  );

  it.each(["/privacy", "/terms", "/discover", "/assistant", "/pricing", "/dashboard", "/api/agency", "/artists/a/b", "/venues/phuket"])(
    "%s stays English-only or negotiated",
    path => expect(isLocalizedPath(path)).toBe(false),
  );

  it("splits the /th prefix from the route path", () => {
    expect(splitLocalePath("/th")).toEqual({ locale: "th", path: "/" });
    expect(splitLocalePath("/th/venues/bangkok")).toEqual({ locale: "th", path: "/venues/bangkok" });
    expect(splitLocalePath("/venues")).toEqual({ locale: "en", path: "/venues" });
    expect(splitLocalePath("/thailand")).toEqual({ locale: "en", path: "/thailand" });
  });

  it("builds language URLs while keeping queries and fragments", () => {
    expect(localizedPath("/", "th")).toBe("/th");
    expect(localizedPath("/venues", "th")).toBe("/th/venues");
    expect(localizedPath("/?artists=dj-ufo#brief", "th")).toBe("/th?artists=dj-ufo#brief");
    expect(localizedPath("/#your-space", "th")).toBe("/th#your-space");
    expect(localizedPath("/acts?act=sax#brief", "th")).toBe("/th/acts?act=sax#brief");
    expect(localizedPath("/th/venues", "en")).toBe("/venues");
    expect(localizedPath("/th", "en")).toBe("/");
    expect(localizedPath("/th/venues", "th")).toBe("/th/venues");
  });

  it("leaves English-only pages, anchors and external links alone", () => {
    expect(localizedPath("/privacy", "th")).toBe("/privacy");
    expect(localizedPath("/privacy#artist-applications", "th")).toBe("/privacy#artist-applications");
    expect(localizedPath("#brief", "th")).toBe("#brief");
    expect(localizedPath("https://agency.brightears.io/th/dj-portal", "th")).toBe("https://agency.brightears.io/th/dj-portal");
    expect(localizedPath("//evil.example/venues", "th")).toBe("//evil.example/venues");
  });

  it("gives each language a self-referencing canonical and the same hreflang set", () => {
    expect(localeAlternates("/venues", "en")).toEqual({
      canonical: "/venues",
      languages: { en: "/venues", th: "/th/venues", "x-default": "/venues" },
    });
    expect(localeAlternates("/venues", "th")).toEqual({
      canonical: "/th/venues",
      languages: { en: "/venues", th: "/th/venues", "x-default": "/venues" },
    });
    expect(localeAlternates("/", "th").canonical).toBe("/th");
  });
});

describe("resolveLocaleRoute", () => {
  const route = (over: Partial<Parameters<typeof resolveLocaleRoute>[0]> = {}) =>
    resolveLocaleRoute({ method: "GET", pathname: "/venues", cookieLocale: undefined, acceptLanguage: null, ...over });

  it("serves crawlers (no cookie, no Accept-Language) English on the bare URL", () => {
    expect(route()).toEqual({ action: "tag", locale: "en" });
  });

  it("rewrites /th pages to the existing route in Thai, whatever the cookie says", () => {
    expect(route({ pathname: "/th/venues" })).toEqual({ action: "rewrite", pathname: "/venues", locale: "th" });
    expect(route({ pathname: "/th", cookieLocale: "en" })).toEqual({ action: "rewrite", pathname: "/", locale: "th" });
    expect(route({ pathname: "/th/artists/dj-ufo/kit" })).toEqual({ action: "rewrite", pathname: "/artists/dj-ufo/kit", locale: "th" });
  });

  it("rewrites server-action POSTs on /th pages too", () => {
    expect(route({ method: "POST", pathname: "/th/join" })).toEqual({ action: "rewrite", pathname: "/join", locale: "th" });
  });

  it("sends a visitor who chose Thai to the /th URL", () => {
    expect(route({ cookieLocale: "th" })).toEqual({ action: "redirect", pathname: "/th/venues" });
    expect(route({ pathname: "/", cookieLocale: "th" })).toEqual({ action: "redirect", pathname: "/th" });
  });

  it("sends a Thai browser without a cookie to the /th URL", () => {
    expect(route({ acceptLanguage: "th-TH,th;q=0.9" })).toEqual({ action: "redirect", pathname: "/th/venues" });
  });

  it("lets an English cookie win over a Thai browser", () => {
    expect(route({ cookieLocale: "en", acceptLanguage: "th-TH" })).toEqual({ action: "tag", locale: "en" });
  });

  it("never redirects a POST, which would drop the body", () => {
    expect(route({ method: "POST", cookieLocale: "th" })).toEqual({ action: "tag", locale: "en" });
  });

  it("leaves pages without a Thai version to the existing negotiation", () => {
    expect(route({ pathname: "/privacy", cookieLocale: "th" })).toEqual({ action: "pass" });
    expect(route({ pathname: "/dashboard", cookieLocale: "th" })).toEqual({ action: "pass" });
    expect(route({ pathname: "/th/pricing" })).toEqual({ action: "pass" });
    expect(route({ pathname: "/api/agency/inquiries", method: "POST" })).toEqual({ action: "pass" });
  });
});

const store = vi.hoisted(() => ({ headers: new Map<string, string>(), cookie: undefined as string | undefined }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (name: string) => store.headers.get(name.toLowerCase()) ?? null }),
  cookies: async () => ({ get: () => (store.cookie ? { value: store.cookie } : undefined) }),
}));

describe("getRequestLocale", () => {
  beforeEach(() => {
    store.headers = new Map();
    store.cookie = undefined;
  });

  it("follows the URL language the proxy set before the cookie or browser", async () => {
    const { getRequestLocale } = await import("@/lib/i18n/server");
    store.headers.set("x-be-url-locale", "th");
    store.cookie = "en";
    expect(await getRequestLocale()).toBe("th");
    store.headers.set("x-be-url-locale", "en");
    store.headers.set("accept-language", "th-TH");
    store.cookie = "th";
    expect(await getRequestLocale()).toBe("en");
  });

  it("keeps cookie, then Accept-Language, for pages without a language URL", async () => {
    const { getRequestLocale } = await import("@/lib/i18n/server");
    store.cookie = "th";
    expect(await getRequestLocale()).toBe("th");
    store.cookie = undefined;
    store.headers.set("accept-language", "th-TH,th;q=0.9");
    expect(await getRequestLocale()).toBe("th");
    store.headers.set("accept-language", "en-GB");
    expect(await getRequestLocale()).toBe("en");
  });

  it("ignores an unsupported URL language value", async () => {
    const { getRequestLocale } = await import("@/lib/i18n/server");
    store.headers.set("x-be-url-locale", "de");
    store.cookie = "th";
    expect(await getRequestLocale()).toBe("th");
  });
});
