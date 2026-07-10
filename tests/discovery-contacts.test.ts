import { beforeEach, describe, expect, it, vi } from "vitest";

// Pure helpers + the DB pass — DB always mocked (vi.hoisted: vi.mock is
// hoisted above the const otherwise).
const mockDb = vi.hoisted(() => ({
  business: { findUniqueOrThrow: vi.fn() },
  venue: { findMany: vi.fn(), update: vi.fn() },
  outreachSuppression: { findUnique: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));

import {
  contactQueryFor,
  discoverVenueContact,
  emailRank,
  extractEmails,
  pickBestEmail,
  pickVenueSiteUrl,
  runContactPass,
  type ContactDeps,
  CONTACT_PATHS,
  roleLabelFor,
  isExternalDomain,
} from "@/lib/discovery/contacts";

describe("extractEmails", () => {
  it("finds mailto: and plain-text emails, lowercased and deduped", () => {
    const html = `
      <a href="mailto:Events@TheVault.co.uk?subject=hi">email us</a>
      <p>or write to events@thevault.co.uk / info@thevault.co.uk</p>`;
    expect(extractEmails(html).sort()).toEqual(["events@thevault.co.uk", "info@thevault.co.uk"]);
  });

  it("ignores filename-shaped matches", () => {
    expect(extractEmails(`<img src="logo@2x.png"> hero@image.webp`)).toEqual([]);
  });
});

describe("email preference (never guess)", () => {
  it("prefers events@/bookings@ over info@ over anything else", () => {
    expect(pickBestEmail(["info@v.com", "bookings@v.com", "bob@v.com"])).toBe("bookings@v.com");
    expect(pickBestEmail(["bob@v.com", "info@v.com"])).toBe("info@v.com");
    expect(pickBestEmail(["bob@v.com"])).toBe("bob@v.com");
    expect(emailRank("events@v.com")).toBeGreaterThan(emailRank("info@v.com"));
  });

  it("rejects noreply/careers-class addresses — null over a bad guess", () => {
    expect(pickBestEmail(["noreply@v.com", "careers@v.com", "jobs@v.com", "press@v.com"])).toBeNull();
    expect(pickBestEmail([])).toBeNull();
  });
});

describe("pickVenueSiteUrl", () => {
  it("skips aggregators and prefers a domain matching the venue name", () => {
    const results = [
      { link: "https://www.facebook.com/thevaultmcr" },
      { link: "https://www.tripadvisor.co.uk/Restaurant_Review-the-vault" },
      { link: "https://www.manchesterbars.example/guide" },
      { link: "https://thevaultmanchester.co.uk/about" },
    ];
    expect(pickVenueSiteUrl(results, "The Vault")).toBe("https://thevaultmanchester.co.uk/about");
  });

  it("falls back to the first non-aggregator hit, or null when only aggregators exist", () => {
    expect(
      pickVenueSiteUrl([{ link: "https://instagram.com/x" }, { link: "https://someblog.example/post" }], "The Vault"),
    ).toBe("https://someblog.example/post");
    expect(pickVenueSiteUrl([{ link: "https://instagram.com/x" }], "The Vault")).toBeNull();
  });
});

describe("discoverVenueContact", () => {
  const venue = { name: "The Vault", city: "Manchester" };

  it("uses exactly one search query and stops fetching once a top-rank email is found", async () => {
    const fetched: string[] = [];
    const deps: ContactDeps = {
      serperSearch: vi.fn(async () => [{ link: "https://thevault.example/" }]),
      fetchPage: async (url) => {
        fetched.push(url);
        if (url.endsWith("/contact")) return `<a href="mailto:events@thevault.example">events</a>`;
        return "<p>no emails here</p>";
      },
    };
    const hit = await discoverVenueContact(venue, deps);
    expect(deps.serperSearch).toHaveBeenCalledTimes(1);
    expect(deps.serperSearch).toHaveBeenCalledWith(contactQueryFor("The Vault", "Manchester"));
    expect(hit).toEqual({
      email: "events@thevault.example",
      source: "venue site /contact — events/bookings contact",
    });
    expect(fetched[fetched.length - 1]).toMatch(/\/contact$/); // stopped at /contact
  });

  it("upgrades from info@ to bookings@ across pages but keeps info@ when that's all there is", async () => {
    const deps: ContactDeps = {
      serperSearch: async () => [{ link: "https://thevault.example/" }],
      fetchPage: async (url) => {
        if (url === "https://thevault.example/") return "info@thevault.example";
        if (url.endsWith("/private-hire")) return "bookings@thevault.example";
        return null; // 403/404 — skipped
      },
    };
    const hit = await discoverVenueContact(venue, deps);
    expect(hit).toEqual({
      email: "bookings@thevault.example",
      source: "venue site /private-hire — events/bookings contact",
    });
  });

  it("returns null when no email is on the site — NEVER guesses", async () => {
    const deps: ContactDeps = {
      serperSearch: async () => [{ link: "https://thevault.example/" }],
      fetchPage: async () => "<p>call us!</p>",
    };
    expect(await discoverVenueContact(venue, deps)).toBeNull();
  });

  it("returns null when search yields no usable venue site", async () => {
    const deps: ContactDeps = {
      serperSearch: async () => [{ link: "https://facebook.com/thevault" }],
      fetchPage: vi.fn(),
    };
    expect(await discoverVenueContact(venue, deps)).toBeNull();
    expect(deps.fetchPage).not.toHaveBeenCalled();
  });
});

describe("runContactPass", () => {
  const dbVenue = (id: string, name: string) => ({
    id,
    name,
    city: "Manchester",
    country: "GB",
    kind: "BAR",
    signals: [{ type: "NEW_OPENING", observedAt: new Date("2026-06-01") }],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.business.findUniqueOrThrow.mockResolvedValue({
      genres: ["house"],
      eventTypes: ["club nights"],
      serviceCities: ["Manchester"],
    });
    mockDb.outreachSuppression.findUnique.mockResolvedValue(null);
    mockDb.venue.update.mockResolvedValue({});
  });

  it("writes bookingEmail + contactSource and re-scores; suppressed emails are never written", async () => {
    mockDb.venue.findMany.mockResolvedValue([dbVenue("v1", "The Vault"), dbVenue("v2", "Banned Bar")]);
    mockDb.outreachSuppression.findUnique.mockImplementation(async ({ where }: { where: { businessId_email: { email: string } } }) =>
      where.businessId_email.email === "events@banned.example" ? { id: "s1" } : null,
    );
    const deps: ContactDeps = {
      serperSearch: async (q) => [
        { link: q.includes("Banned") ? "https://banned.example/" : "https://thevault.example/" },
      ],
      fetchPage: async (url) =>
        url.startsWith("https://banned.example") ? "events@banned.example" : "Events@TheVault.example",
    };

    const result = await runContactPass("biz1", { now: new Date("2026-06-12"), deps });

    expect(result.found).toEqual([
      { venueId: "v1", name: "The Vault", email: "events@thevault.example", source: expect.stringContaining("venue site") },
    ]);
    expect(result.suppressed).toEqual([{ venueId: "v2", name: "Banned Bar", email: "events@banned.example" }]);
    expect(mockDb.venue.update).toHaveBeenCalledTimes(1);
    const update = mockDb.venue.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: "v1" });
    expect(update.data.bookingEmail).toBe("events@thevault.example");
    expect(update.data.contactSource).toContain("venue site");
    expect(update.data.fitScore).toBeGreaterThan(0); // re-scored with pitchability points
  });

  it("selects only DISCOVERED venues missing an email with score >= 60, capped at 5", async () => {
    mockDb.venue.findMany.mockResolvedValue([]);
    await runContactPass("biz1", { deps: { serperSearch: async () => [], fetchPage: async () => null } });
    const where = mockDb.venue.findMany.mock.calls[0][0];
    expect(where.where).toMatchObject({ bookingEmail: null, status: "DISCOVERED", fitScore: { gte: 60 } });
    expect(where.take).toBe(5);
  });
});

describe("right-contact improvements (P12.8)", () => {
  it("events/booking pages come before generic contact pages", () => {
    expect(CONTACT_PATHS.indexOf("/events")).toBeLessThan(CONTACT_PATHS.indexOf("/contact"));
    expect(CONTACT_PATHS.indexOf("/private-hire")).toBeLessThan(CONTACT_PATHS.indexOf("/contact-us"));
  });

  it("labels roles by address class and flags external promoter domains", () => {
    expect(roleLabelFor("events@thevault.example", "www.thevault.example")).toBe(
      "events/bookings contact",
    );
    expect(roleLabelFor("info@thevault.example", "thevault.example")).toBe("general contact");
    expect(roleLabelFor("bookings@nightpromo.example", "thevault.example")).toBe(
      "events/bookings contact — external promoter/agency (nightpromo.example)",
    );
  });

  it("free-mail inboxes are personal, never 'external agency'", () => {
    expect(isExternalDomain("thevaultbar@gmail.com", "thevault.example")).toBe(false);
    expect(isExternalDomain("bookings@nightpromo.example", "thevault.example")).toBe(true);
    expect(isExternalDomain("events@events.thevault.example", "thevault.example")).toBe(false);
  });
});
