import { beforeEach, describe, expect, it, vi } from "vitest";

// Pure helpers + the DB pass — DB always mocked (vi.hoisted: vi.mock is
// hoisted above the const otherwise).
const mockDb = vi.hoisted(() => ({
  business: { findUniqueOrThrow: vi.fn() },
  venue: { findMany: vi.fn(), updateMany: vi.fn() },
  globalOutreachSuppression: { findUnique: vi.fn() },
  outreachSuppression: { findUnique: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));

import {
  contactQueryFor,
  contactAttemptState,
  contactClaimState,
  discoverVenueContact,
  emailRank,
  extractEmails,
  makeLiveDeps,
  pickBestEmail,
  pickVenueSiteUrl,
  runContactPass,
  type ContactDeps,
  CONTACT_PATHS,
  roleLabelFor,
  isExternalDomain,
  isContactAttemptDue,
  CONTACT_CLAIM_LEASE_MS,
  CONTACT_MAX_ATTEMPTS,
} from "@/lib/discovery/contacts";

describe("contact attempt queue state", () => {
  const now = new Date("2026-08-16T00:00:00.000Z");

  it("leases a claimed row before network work", () => {
    expect(contactClaimState(1, now)).toEqual({
      contactAttemptCount: 2,
      contactLastAttemptAt: now,
      contactRetryAfter: new Date(now.getTime() + CONTACT_CLAIM_LEASE_MS),
      contactExhaustedAt: null,
      contactState: "IN_PROGRESS",
    });
  });

  it("backs off misses and generic contacts, but settles direct and suppressed contacts", () => {
    expect(contactAttemptState(1, "NOT_FOUND", now).contactRetryAfter).toEqual(
      new Date("2026-08-23T00:00:00.000Z"),
    );
    expect(contactAttemptState(1, "FOUND_GENERIC", now).contactRetryAfter).toEqual(
      new Date("2026-09-15T00:00:00.000Z"),
    );
    expect(contactAttemptState(1, "ERROR", now).contactRetryAfter).toEqual(
      new Date("2026-08-17T00:00:00.000Z"),
    );
    expect(contactAttemptState(1, "FOUND_DIRECT", now).contactRetryAfter).toBeNull();
    expect(contactAttemptState(1, "SUPPRESSED", now).contactExhaustedAt).toEqual(now);
  });

  it("exhausts the automatic queue after the bounded final attempt", () => {
    const state = contactAttemptState(CONTACT_MAX_ATTEMPTS, "NOT_FOUND", now);
    expect(state.contactRetryAfter).toBeNull();
    expect(state.contactExhaustedAt).toEqual(now);
    expect(isContactAttemptDue(state, new Date("2027-08-16"))).toBe(false);
  });

  it("treats a crashed claim as due after its lease", () => {
    const claim = contactClaimState(0, now);
    expect(isContactAttemptDue(claim, new Date(now.getTime() + CONTACT_CLAIM_LEASE_MS - 1))).toBe(false);
    expect(isContactAttemptDue(claim, new Date(now.getTime() + CONTACT_CLAIM_LEASE_MS))).toBe(true);
  });
});

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

  it("rejects unrelated non-aggregator hits and returns null when no hostname matches", () => {
    expect(
      pickVenueSiteUrl([{ link: "https://instagram.com/x" }, { link: "https://someblog.example/post" }], "The Vault"),
    ).toBeNull();
    expect(pickVenueSiteUrl([{ link: "https://instagram.com/x" }], "The Vault")).toBeNull();
  });

  it("selects Above Eleven's official site from a realistic broad result set", () => {
    const results = [
      { link: "https://www.tripadvisor.com/Restaurant_Review-above-eleven" },
      { link: "https://www.timeout.com/bangkok/bars/above-eleven" },
      { link: "https://aboveeleven.com/bangkok/" },
    ];
    expect(pickVenueSiteUrl(results, "Above Eleven")).toBe("https://aboveeleven.com/bangkok/");
  });
});

describe("contactQueryFor", () => {
  it("uses one exact-name clause instead of the Serper-empty OR-heavy form", () => {
    const query = contactQueryFor("Above Eleven", "Bangkok");
    expect(query).toBe('"Above Eleven" Bangkok contact email');
    expect(query).not.toMatch(/\sOR\s/);
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

  it("marks a near-exact venue local-part from the official site as direct", async () => {
    const hitUrl = "https://bangkokisland.com/contact/";
    const deps: ContactDeps = {
      serperSearch: vi.fn(async () => [{ link: hitUrl }]),
      fetchPage: vi.fn(async (url) =>
        url === hitUrl ? "Email us at bangkokislands@gmail.com" : null,
      ),
    };

    expect(
      await discoverVenueContact({ name: "Bangkok Island", city: "Bangkok" }, deps),
    ).toEqual({
      email: "bangkokislands@gmail.com",
      source: "venue site /contact — venue-bound contact (gmail.com)",
      direct: true,
    });
    expect(deps.serperSearch).toHaveBeenCalledTimes(1);
  });

  it("uses a distinctive multi-word core when a trailing venue type is absent from the address", async () => {
    const hitUrl = "https://satosanrooftop.example/contact-location";
    const deps: ContactDeps = {
      serperSearch: vi.fn(async () => [{ link: hitUrl }]),
      fetchPage: vi.fn(async (url) =>
        url === hitUrl
          ? "info@voidacoustics.com moxy.bkkox.satosan@moxyhotels.com"
          : null,
      ),
    };

    expect(
      await discoverVenueContact({ name: "Sato San Rooftop", city: "Bangkok" }, deps),
    ).toEqual({
      email: "moxy.bkkox.satosan@moxyhotels.com",
      source: "venue site /contact-location — venue-bound contact (moxyhotels.com)",
      direct: true,
    });
  });

  it("does not promote identity-looking emails from loosely token-matched publisher hosts", async () => {
    const scenarios = [
      {
        venue: { name: "Bangkok Island", city: "Bangkok" },
        url: "https://bangkokevents.example/article",
        email: "bangkokislandtips@publisher.example",
      },
      {
        venue: { name: "Sato San Rooftop", city: "Bangkok" },
        url: "https://rooftopguide.example/sato-san",
        email: "newsletter.satosan@publisher.example",
      },
    ];

    for (const { venue: currentVenue, url, email } of scenarios) {
      const fetchPage = vi.fn(async (fetchedUrl: string) =>
        fetchedUrl === url ? email : null,
      );
      const hit = await discoverVenueContact(currentVenue, {
        serperSearch: async () => [{ link: url }],
        fetchPage,
      });

      expect(hit).toEqual(expect.objectContaining({ email }));
      expect(hit).not.toHaveProperty("direct");
      expect(fetchPage).toHaveBeenCalledWith(url);
    }
  });

  it("does not treat a corporate acronym or generic publisher address as venue identity", async () => {
    const scenarios = [
      {
        venue: { name: "Centara Grand", city: "Bangkok" },
        url: "https://centarahotelsresorts.example/contact",
        email: "cgcw@chr.co.th",
      },
      {
        venue: { name: "Sato San Rooftop", city: "Bangkok" },
        url: "https://satosanrooftop.example/contact-location",
        email: "info@voidacoustics.com",
      },
      {
        venue: { name: "Sato San Rooftop", city: "Bangkok" },
        url: "https://satosanrooftop.example/contact-location",
        email: "moxy.bkkox@moxyhotels.com",
      },
    ];

    for (const { venue: currentVenue, url, email } of scenarios) {
      const hit = await discoverVenueContact(currentVenue, {
        serperSearch: async () => [{ link: url }],
        fetchPage: async (fetchedUrl) => (fetchedUrl === url ? email : null),
      });
      expect(hit).toEqual(expect.objectContaining({ email }));
      expect(hit).not.toHaveProperty("direct");
    }
  });

  it("accepts a venue-bound email on an exact parent-brand Bar.Yard page", async () => {
    const hitUrl = "https://www.kimptonmaalaibangkok.com/bangkok-restaurants/baryard-rooftop-bar/";
    const deps: ContactDeps = {
      serperSearch: vi.fn(async () => [
        {
          link: hitUrl,
          title: "Bar.Yard – Bangkok's Best Rooftop Bar | Kimpton Maa-Lai Bangkok",
        },
      ]),
      fetchPage: vi.fn(async () => `
        <p>Email: BarYard.Kimptonmaalai@ihg.com</p>
        <footer>kimptonmaalaibangkok@ihg.com</footer>
      `),
    };

    expect(await discoverVenueContact({ name: "Bar.Yard", city: "Bangkok" }, deps)).toEqual({
      email: "baryard.kimptonmaalai@ihg.com",
      source: expect.stringContaining("venue-branded search page"),
      direct: true,
    });
    expect(deps.serperSearch).toHaveBeenCalledTimes(1);
    expect(deps.fetchPage).toHaveBeenCalledOnce();
    expect(deps.fetchPage).toHaveBeenCalledWith(hitUrl);
  });

  it("rejects a Void Acoustics publisher address and tries a later bounded candidate", async () => {
    const voidUrl = "https://voidacoustics.com/case-studies/bar-yard-bangkok/";
    const kimptonUrl = "https://www.kimptonmaalaibangkok.com/dining/baryard-bangkok/";
    const deps: ContactDeps = {
      serperSearch: vi.fn(async () => [
        { link: voidUrl, title: "Bar.Yard Bangkok | Void Acoustics" },
        { link: kimptonUrl, title: "Bar.Yard Bangkok | Kimpton Maa-Lai" },
      ]),
      fetchPage: vi.fn(async (url) =>
        url === voidUrl ? "info@voidacoustics.com" : "BarYard.Kimptonmaalai@ihg.com",
      ),
    };

    expect(await discoverVenueContact({ name: "Bar.Yard", city: "Bangkok" }, deps)).toEqual(
      expect.objectContaining({ email: "baryard.kimptonmaalai@ihg.com" }),
    );
    expect(deps.serperSearch).toHaveBeenCalledTimes(1);
    expect(deps.fetchPage).toHaveBeenCalledTimes(2);
    expect(deps.fetchPage).toHaveBeenNthCalledWith(1, voidUrl);
    expect(deps.fetchPage).toHaveBeenNthCalledWith(2, kimptonUrl);
  });

  it("rejects a general hotel email on a weak parent-brand page", async () => {
    const hitUrl = "https://www.kimptonmaalaibangkok.com/dining/baryard-bangkok/";
    const deps: ContactDeps = {
      serperSearch: vi.fn(async () => [
        { link: hitUrl, title: "Bar.Yard Bangkok | Kimpton Maa-Lai" },
      ]),
      fetchPage: vi.fn(async () => "kimptonmaalaibangkok@ihg.com"),
    };

    expect(await discoverVenueContact({ name: "Bar.Yard", city: "Bangkok" }, deps)).toBeNull();
    expect(deps.fetchPage).toHaveBeenCalledOnce();
    expect(deps.fetchPage).toHaveBeenCalledWith(hitUrl);
  });

  it("prefers a later hostname-grounded site over an earlier weak parent-brand result", async () => {
    const weakUrl = "https://www.kimptonmaalaibangkok.com/dining/baryard-bangkok/";
    const strongUrl = "https://baryard.example/contact";
    const deps: ContactDeps = {
      serperSearch: vi.fn(async () => [
        { link: weakUrl, title: "Bar.Yard Bangkok | Kimpton Maa-Lai" },
        { link: strongUrl, title: "Bar.Yard Bangkok" },
      ]),
      fetchPage: vi.fn(async (url) =>
        url === strongUrl ? "events@baryard.example" : "BarYard.Kimptonmaalai@ihg.com",
      ),
    };

    expect(await discoverVenueContact({ name: "Bar.Yard", city: "Bangkok" }, deps)).toEqual(
      expect.objectContaining({ email: "events@baryard.example" }),
    );
    expect(deps.fetchPage).not.toHaveBeenCalledWith(weakUrl);
  });

  it("falls back to a weak parent-brand page after an empty strong-host crawl", async () => {
    const strongUrl = "https://baryard.example/";
    const weakUrl = "https://www.kimptonmaalaibangkok.com/dining/baryard-bangkok/";
    const fetchPage = vi.fn(async (url: string) =>
      url === weakUrl ? "BarYard.Kimptonmaalai@ihg.com" : null,
    );
    const deps: ContactDeps = {
      serperSearch: vi.fn(async () => [
        { link: strongUrl, title: "Bar.Yard Bangkok" },
        { link: weakUrl, title: "Bar.Yard Bangkok | Kimpton Maa-Lai" },
      ]),
      fetchPage,
    };

    expect(await discoverVenueContact({ name: "Bar.Yard", city: "Bangkok" }, deps)).toEqual(
      expect.objectContaining({ email: "baryard.kimptonmaalai@ihg.com" }),
    );
    expect(deps.serperSearch).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(weakUrl);
    expect(fetchPage.mock.calls.filter(([url]) => url === strongUrl)).toHaveLength(1);
  });
});

describe("runContactPass", () => {
  const dbVenue = (id: string, name: string) => ({
    id,
    name,
    createdAt: new Date("2026-06-01"),
    city: "Manchester",
    country: "GB",
    kind: "BAR",
    fitScore: 80,
    bookingEmail: null,
    contactSource: null,
    contactAttemptCount: 0,
    contactLastAttemptAt: null,
    contactRetryAfter: null,
    contactExhaustedAt: null,
    contactState: null,
    travelWindowId: null,
    signals: [{ type: "NEW_OPENING", observedAt: new Date("2026-06-01") }],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.venue.findMany.mockResolvedValue([]);
    mockDb.business.findUniqueOrThrow.mockResolvedValue({
      genres: ["house"],
      eventTypes: ["club nights"],
      serviceCities: ["Manchester"],
    });
    mockDb.globalOutreachSuppression.findUnique.mockResolvedValue(null);
    mockDb.outreachSuppression.findUnique.mockResolvedValue(null);
    mockDb.venue.updateMany.mockResolvedValue({ count: 1 });
  });

  it("writes bookingEmail + contactSource and re-scores; suppressed emails are never written", async () => {
    mockDb.venue.findMany
      .mockResolvedValueOnce([dbVenue("v1", "The Vault"), dbVenue("v2", "Banned Bar")])
      .mockResolvedValueOnce([]);
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
    const savedContact = mockDb.venue.updateMany.mock.calls
      .map(([call]) => call)
      .find((call) => call.data.bookingEmail === "events@thevault.example");
    expect(savedContact).toBeDefined();
    const update = savedContact!;
    expect(update.where).toMatchObject({ id: "v1", businessId: "biz1", contactState: "IN_PROGRESS" });
    expect(update.data.bookingEmail).toBe("events@thevault.example");
    expect(update.data.contactSource).toContain("venue site");
    expect(update.data.fitScore).toBeGreaterThan(0); // re-scored with pitchability points
    expect(update.data.contactState).toBe("FOUND_DIRECT");

    const suppressed = mockDb.venue.updateMany.mock.calls
      .map(([call]) => call)
      .find((call) => call.data.status === "SUPPRESSED");
    expect(suppressed?.data).toMatchObject({
      contactState: "SUPPRESSED",
      suppressedReason: "CONTACT_SUPPRESSED",
    });
  });

  it("blocks a product-wide suppressed recipient for every tenant before contact write", async () => {
    mockDb.venue.findMany
      .mockResolvedValueOnce([dbVenue("v1", "Global Stop")])
      .mockResolvedValueOnce([]);
    mockDb.globalOutreachSuppression.findUnique.mockResolvedValue({ id: "global-1" });
    const deps: ContactDeps = {
      serperSearch: async () => [{ link: "https://global-stop.example/" }],
      fetchPage: async () => "Bookings@Global-Stop.example",
    };

    const result = await runContactPass("different-tenant", {
      now: new Date("2026-06-12"),
      deps,
    });

    expect(result.found).toEqual([]);
    expect(result.suppressed).toEqual([
      {
        venueId: "v1",
        name: "Global Stop",
        email: "bookings@global-stop.example",
      },
    ]);
    expect(mockDb.globalOutreachSuppression.findUnique).toHaveBeenCalledWith({
      where: { email: "bookings@global-stop.example" },
      select: { id: true },
    });
    expect(mockDb.outreachSuppression.findUnique).not.toHaveBeenCalled();
    expect(
      mockDb.venue.updateMany.mock.calls.some(
        ([call]) => call.data.bookingEmail === "bookings@global-stop.example",
      ),
    ).toBe(false);
  });

  it("selects only DISCOVERED venues missing an email with score >= 60, capped at 5", async () => {
    mockDb.venue.findMany.mockResolvedValue([]);
    await runContactPass("biz1", { deps: { serperSearch: async () => [], fetchPage: async () => null } });
    const where = mockDb.venue.findMany.mock.calls[0][0];
    expect(where.where).toMatchObject({
      bookingEmail: null,
      status: "DISCOVERED",
      fitScore: { gte: 60 },
      contactAttemptCount: 0,
    });
    expect(where.take).toBe(5);
  });

  it("fills spare slots with oldest due retries while fresh venues stay first", async () => {
    const fresh = dbVenue("fresh", "Fresh Room");
    const retry = {
      ...dbVenue("retry", "Retry Room"),
      contactAttemptCount: 1,
      contactLastAttemptAt: new Date("2026-07-01"),
      contactRetryAfter: new Date("2026-07-08"),
      contactState: "NOT_FOUND",
    };
    mockDb.venue.findMany.mockResolvedValueOnce([fresh]).mockResolvedValueOnce([retry]);
    const deps: ContactDeps = { serperSearch: async () => [], fetchPage: async () => null };

    const result = await runContactPass("biz1", { now: new Date("2026-08-16"), deps, limit: 2 });

    expect(result.attempted).toBe(2);
    expect(result.serperQueries).toBe(2);
    expect(mockDb.venue.findMany.mock.calls[1][0]).toMatchObject({
      where: {
        contactAttemptCount: { gt: 0, lt: CONTACT_MAX_ATTEMPTS },
        contactRetryAfter: { lte: new Date("2026-08-16") },
      },
      take: 2,
    });
  });

  it("reserves a retry slot even when fresh venues fill the daily queue", async () => {
    const fresh = Array.from({ length: 5 }, (_, index) =>
      dbVenue(`fresh-${index}`, `Fresh Room ${index}`),
    );
    const retry = {
      ...dbVenue("retry", "Retry Room"),
      contactAttemptCount: 1,
      contactLastAttemptAt: new Date("2026-07-01"),
      contactRetryAfter: new Date("2026-07-08"),
      contactState: "NOT_FOUND",
    };
    mockDb.venue.findMany.mockResolvedValueOnce(fresh).mockResolvedValueOnce([retry]);
    const queries: string[] = [];
    const deps: ContactDeps = {
      serperSearch: async (query) => {
        queries.push(query);
        return [];
      },
      fetchPage: async () => null,
    };

    const result = await runContactPass("biz1", {
      now: new Date("2026-08-16"),
      deps,
      limit: 5,
    });

    expect(result.attempted).toBe(5);
    expect(queries.some((query) => query.includes("Retry Room"))).toBe(true);
    expect(queries.filter((query) => query.includes("Fresh Room"))).toHaveLength(4);
  });

  it("does not spend a query when another worker wins the atomic claim", async () => {
    mockDb.venue.findMany.mockResolvedValueOnce([dbVenue("v1", "The Vault")]);
    mockDb.venue.updateMany.mockResolvedValueOnce({ count: 0 });
    const deps: ContactDeps = { serperSearch: vi.fn(async () => []), fetchPage: async () => null };

    const result = await runContactPass("biz1", { deps, limit: 1 });

    expect(result.attempted).toBe(0);
    expect(result.serperQueries).toBe(0);
    expect(deps.serperSearch).not.toHaveBeenCalled();
  });

  it("keeps an acronym-only corporate contact generic and schedules a later upgrade", async () => {
    mockDb.venue.findMany.mockResolvedValueOnce([dbVenue("v1", "Centara Grand")]);
    const deps: ContactDeps = {
      serperSearch: async () => [{ link: "https://centarahotelsresorts.example/contact" }],
      fetchPage: async (url) =>
        url === "https://centarahotelsresorts.example/contact" ? "cgcw@chr.co.th" : null,
    };

    await runContactPass("biz1", { now: new Date("2026-08-16"), deps, limit: 1 });

    const saved = mockDb.venue.updateMany.mock.calls
      .map(([call]) => call)
      .find((call) => call.data.bookingEmail === "cgcw@chr.co.th");
    expect(saved?.data.contactState).toBe("FOUND_GENERIC");
    expect(saved?.data.contactRetryAfter).toEqual(new Date("2026-09-15"));
    expect(saved?.data.contactExhaustedAt).toBeNull();
  });

  it("can later upgrade a due generic address to a direct bookings contact", async () => {
    const generic = {
      ...dbVenue("v1", "The Vault"),
      bookingEmail: "hello@thevault.example",
      contactSource: "venue site /contact — general contact",
      contactAttemptCount: 1,
      contactLastAttemptAt: new Date("2026-07-01"),
      contactRetryAfter: new Date("2026-07-31"),
      contactState: "FOUND_GENERIC",
    };
    mockDb.venue.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([generic]);
    const deps: ContactDeps = {
      serperSearch: async () => [{ link: "https://thevault.example/events" }],
      fetchPage: async () => "bookings@thevault.example",
    };

    const result = await runContactPass("biz1", { now: new Date("2026-08-16"), deps, limit: 1 });

    expect(result.found).toEqual([
      expect.objectContaining({ venueId: "v1", email: "bookings@thevault.example" }),
    ]);
    const saved = mockDb.venue.updateMany.mock.calls
      .map(([call]) => call)
      .find((call) => call.data.bookingEmail === "bookings@thevault.example");
    expect(saved?.data.contactState).toBe("FOUND_DIRECT");
    expect(saved?.data.contactRetryAfter).toBeNull();
  });

  it("upgrades an existing generic address with exact venue-bound identity proof", async () => {
    const generic = {
      ...dbVenue("v1", "Bar.Yard"),
      bookingEmail: "hello@old-hotel.example",
      contactSource: "venue site /contact — general contact",
      contactAttemptCount: 1,
      contactLastAttemptAt: new Date("2026-07-01"),
      contactRetryAfter: new Date("2026-07-31"),
      contactState: "FOUND_GENERIC",
    };
    mockDb.venue.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([generic]);
    const deps: ContactDeps = {
      serperSearch: async () => [
        {
          link: "https://www.kimptonmaalaibangkok.com/dining/baryard-manchester/",
          title: "Bar.Yard Manchester | Kimpton",
        },
      ],
      fetchPage: async () => "BarYard.Kimptonmaalai@ihg.com",
    };

    const result = await runContactPass("biz1", {
      now: new Date("2026-08-16"),
      deps,
      limit: 1,
    });

    expect(result.found).toEqual([
      expect.objectContaining({ venueId: "v1", email: "baryard.kimptonmaalai@ihg.com" }),
    ]);
    const saved = mockDb.venue.updateMany.mock.calls
      .map(([call]) => call)
      .find((call) => call.data.bookingEmail === "baryard.kimptonmaalai@ihg.com");
    expect(saved?.data.contactState).toBe("FOUND_DIRECT");
    expect(saved?.data.contactRetryAfter).toBeNull();
    expect(saved?.data.contactSource).toContain("exact venue-bound contact");
  });

  it("upgrades an existing generic address with official-site venue-core identity proof", async () => {
    const generic = {
      ...dbVenue("v1", "Sato San Rooftop"),
      bookingEmail: "hello@old-hotel.example",
      contactSource: "venue site /contact — general contact",
      contactAttemptCount: 1,
      contactLastAttemptAt: new Date("2026-07-01"),
      contactRetryAfter: new Date("2026-07-31"),
      contactState: "FOUND_GENERIC",
    };
    mockDb.venue.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([generic]);
    const hitUrl = "https://satosanrooftop.example/contact-location";
    const deps: ContactDeps = {
      serperSearch: async () => [{ link: hitUrl }],
      fetchPage: async (url) =>
        url === hitUrl ? "moxy.bkkox.satosan@moxyhotels.com" : null,
    };

    const result = await runContactPass("biz1", {
      now: new Date("2026-08-16"),
      deps,
      limit: 1,
    });

    expect(result.found).toEqual([
      expect.objectContaining({ venueId: "v1", email: "moxy.bkkox.satosan@moxyhotels.com" }),
    ]);
    const saved = mockDb.venue.updateMany.mock.calls
      .map(([call]) => call)
      .find((call) => call.data.bookingEmail === "moxy.bkkox.satosan@moxyhotels.com");
    expect(saved?.data.contactState).toBe("FOUND_DIRECT");
    expect(saved?.data.contactRetryAfter).toBeNull();
    expect(saved?.data.contactSource).toContain("venue-bound contact");
  });

  it("does not overwrite an owner change made while the network lookup is running", async () => {
    mockDb.venue.findMany.mockResolvedValueOnce([dbVenue("v1", "The Vault")]);
    mockDb.venue.updateMany
      .mockResolvedValueOnce({ count: 1 }) // queue claim
      .mockResolvedValueOnce({ count: 0 }); // final compare-and-set lost
    const deps: ContactDeps = {
      serperSearch: async () => [{ link: "https://thevault.example/" }],
      fetchPage: async () => "events@thevault.example",
    };

    const result = await runContactPass("biz1", { deps, limit: 1 });

    expect(result.attempted).toBe(1);
    expect(result.serperQueries).toBe(1);
    expect(result.found).toEqual([]);
  });
});

describe("makeLiveDeps fetchPage SSRF guard", () => {
  // Response-shaped stub; only the fields fetchPage reads.
  const resLike = (status: number, contentType: string, body: string) =>
    ({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (k: string) => (k.toLowerCase() === "content-type" ? contentType : null) },
      text: async () => body,
    }) as unknown as Response;

  // IP-literal hosts throughout: resolvesToBlockedIp only does DNS for NAMES,
  // so literals keep the tests network-free.
  it("refuses private/loopback/metadata hosts without ever fetching", async () => {
    const fetchFn = vi.fn();
    const deps = makeLiveDeps({ fetchFn: fetchFn as unknown as typeof fetch });
    expect(await deps.fetchPage("http://169.254.169.254/latest/meta-data")).toBeNull();
    expect(await deps.fetchPage("http://127.0.0.1/contact")).toBeNull();
    expect(await deps.fetchPage("http://10.1.2.3/contact")).toBeNull();
    expect(await deps.fetchPage("http://localhost/contact")).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("refuses non-http(s) schemes and unparseable URLs", async () => {
    const fetchFn = vi.fn();
    const deps = makeLiveDeps({ fetchFn: fetchFn as unknown as typeof fetch });
    expect(await deps.fetchPage("file:///etc/passwd")).toBeNull();
    expect(await deps.fetchPage("not a url")).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("treats redirects as a skip — never follows them", async () => {
    const fetchFn = vi.fn(async () => resLike(302, "text/html", ""));
    const deps = makeLiveDeps({ fetchFn: fetchFn as unknown as typeof fetch });
    expect(await deps.fetchPage("http://203.0.113.10/contact")).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const init = (fetchFn.mock.calls[0] as unknown[])[1] as RequestInit;
    expect(init.redirect).toBe("manual");
  });

  it("still returns HTML from an allowed host", async () => {
    const fetchFn = vi.fn(async () => resLike(200, "text/html; charset=utf-8", "<p>events@x.example</p>"));
    const deps = makeLiveDeps({ fetchFn: fetchFn as unknown as typeof fetch });
    expect(await deps.fetchPage("http://203.0.113.10/contact")).toBe("<p>events@x.example</p>");
  });
});

describe("makeLiveDeps Serper failures", () => {
  it("throws on non-2xx so the queue records ERROR rather than a long NOT_FOUND backoff", async () => {
    const fetchFn = vi.fn(async () => new Response("rate limited", { status: 429 }));
    const deps = makeLiveDeps({
      apiKey: "test",
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    await expect(deps.serperSearch("The Vault Manchester contact")).rejects.toThrow(
      /HTTP 429/,
    );
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
