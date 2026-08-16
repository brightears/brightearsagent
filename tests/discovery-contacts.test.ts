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

  it("keeps a generic contact usable and schedules a later direct-contact upgrade", async () => {
    mockDb.venue.findMany.mockResolvedValueOnce([dbVenue("v1", "The Vault")]);
    const deps: ContactDeps = {
      serperSearch: async () => [{ link: "https://thevault.example/" }],
      fetchPage: async () => "hello@thevault.example",
    };

    await runContactPass("biz1", { now: new Date("2026-08-16"), deps, limit: 1 });

    const saved = mockDb.venue.updateMany.mock.calls
      .map(([call]) => call)
      .find((call) => call.data.bookingEmail === "hello@thevault.example");
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
