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
  runContactPass,
  type ContactDeps,
  CONTACT_PATHS,
  roleLabelFor,
  isExternalDomain,
  isContactAttemptDue,
  CONTACT_CLAIM_LEASE_MS,
  CONTACT_MAX_ATTEMPTS,
  CONTACT_PASS_WALL_BUDGET_MS,
  CONTACT_PAGE_FETCH_CAP_PER_VENUE,
  CONTACT_PAGE_DECODED_CHAR_CAP,
  CONTACT_PAGE_HEAD_CHAR_CAP,
  CONTACT_PAGE_SAMPLE_SEPARATOR,
  CONTACT_PAGE_TAIL_CHAR_CAP,
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

  it("decodes only exact HTML-entity and JSON unicode email punctuation", () => {
    const html = `
      <span>events&#64;thevault&#46;example</span>
      <script type="application/ld+json">{"email":"hello\\u0040thevault\\u002eexample"}</script>
      <p>not an email: someone&amp;commat;example&amp;period;com</p>`;
    expect(extractEmails(html).sort()).toEqual([
      "events@thevault.example",
      "hello@thevault.example",
    ]);
  });

  it("does not let a malformed mailto escape abort other literal addresses", () => {
    expect(extractEmails(`mailto:bad%ZZ@example.com info@thevault.example`)).toContain(
      "info@thevault.example",
    );
  });

  it("extracts only individual valid recipients from mailto lists and fragments", () => {
    const html = `
      <a href="mailto:events@example.com,info@example.com?subject=hello">team</a>
      <a href="mailto:bookings@example.com#fragment">book</a>`;
    expect(extractEmails(html).sort()).toEqual([
      "bookings@example.com",
      "events@example.com",
      "info@example.com",
    ]);
    expect(pickBestEmail(extractEmails(html))).toBe("events@example.com");
  });

  it("does not extract a suffix from an overlong email-like token", () => {
    expect(extractEmails(`${"a".repeat(65)}@example.com`)).toEqual([]);
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
    expect(pickBestEmail([
      "noreply@v.com",
      "careers@v.com",
      "jobs@v.com",
      "press@v.com",
      "newsletter@v.com",
      "editorial@v.com",
      "support@v.com",
      "customer-service@v.com",
      "marketing@v.com",
      "events-support@v.com",
    ])).toBeNull();
    expect(pickBestEmail([])).toBeNull();
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

  it("rejects non-booking departments even when a strict venue domain matches identity", async () => {
    const hitUrl = "https://thevault.example/about";
    const blocked = [
      "newsletter@thevault.example",
      "editorial@thevault.example",
      "support@thevault.example",
      "customer-service@thevault.example",
      "marketing@thevault.example",
      "events-support@thevault.example",
    ].join(" ");
    const fetchPage = vi.fn(async (url: string) => (url === hitUrl ? blocked : null));
    expect(
      await discoverVenueContact(venue, {
        serperSearch: async () => [{ link: hitUrl }],
        fetchPage,
      }),
    ).toBeNull();
  });

  it("still selects valid events, info and venue-bound rsvp alternatives", async () => {
    for (const expected of [
      "events@thevault.example",
      "info@thevault.example",
      "rsvp@thevault.example",
    ]) {
      const hitUrl = "https://thevault.example/about";
      const hit = await discoverVenueContact(venue, {
        serperSearch: async () => [{ link: hitUrl }],
        fetchPage: async (url) =>
          url === hitUrl
            ? `events-support@thevault.example marketing@thevault.example ${expected}`
            : null,
      });
      expect(hit).toEqual(expect.objectContaining({ email: expected }));
      expect(hit?.direct).not.toBe(false);
    }
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

  it("promotes a 4–5 character brand only on an exact brand/city registrant shape", async () => {
    const hitUrl = "https://veylabangkok.com/contact";
    const hit = await discoverVenueContact(
      { name: "Veyla", city: "Bangkok" },
      {
        serperSearch: async () => [{ link: hitUrl }],
        fetchPage: async (url) =>
          url === hitUrl ? "Reservations: rsvp@veylabangkok.com" : null,
      },
    );
    expect(hit).toEqual({
      email: "rsvp@veylabangkok.com",
      source: "venue site /contact — venue-bound contact (veylabangkok.com)",
      direct: true,
    });

    const publisherUrl = "https://veyla-news-bangkok.example/article";
    const publisherHit = await discoverVenueContact(
      { name: "Veyla", city: "Bangkok" },
      {
        serperSearch: async () => [{ link: publisherUrl }],
        fetchPage: async () => "rsvp@veyla-news-bangkok.example",
      },
    );
    expect(publisherHit).toEqual(
      expect.objectContaining({ email: "rsvp@veyla-news-bangkok.example" }),
    );
    expect(publisherHit).not.toHaveProperty("direct");
  });

  it("does not extend the short-brand exception to three-character names", async () => {
    const url = "https://skybangkok.example/contact";
    const hit = await discoverVenueContact(
      { name: "Sky", city: "Bangkok" },
      {
        serperSearch: async () => [{ link: url }],
        fetchPage: async () => "hello@skybangkok.example",
      },
    );
    expect(hit).toEqual(expect.objectContaining({ email: "hello@skybangkok.example" }));
    expect(hit).not.toHaveProperty("direct");
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
        email: "satosan.tips@publisher.example",
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

  it("keeps rank-3 role addresses generic on arbitrary-suffix publisher hosts", async () => {
    const scenarios = [
      {
        venue: { name: "The Vault", city: "Manchester" },
        url: "https://thevaulttickets.com/article",
        email: "events@thevaulttickets.com",
      },
      {
        venue: { name: "Bangkok Island", city: "Bangkok" },
        url: "https://bangkokislandguide.com/article",
        email: "events@bangkokislandguide.com",
      },
      {
        venue: { name: "Sato San Rooftop", city: "Bangkok" },
        url: "https://satosannews.com/article",
        email: "events@satosannews.com",
      },
    ];

    for (const scenario of scenarios) {
      const fetchPage = vi.fn(async () => scenario.email);
      const hit = await discoverVenueContact(scenario.venue, {
        serperSearch: async () => [{ link: scenario.url }],
        fetchPage,
      });
      expect(hit).toEqual(expect.objectContaining({
        email: scenario.email,
        direct: false,
      }));
      expect(fetchPage).toHaveBeenCalledOnce();
      expect(fetchPage).toHaveBeenCalledWith(scenario.url);
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

  it("keeps a venue-bound email on an exact parent-brand Bar.Yard page generic", async () => {
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
      direct: false,
    });
    expect(deps.serperSearch).toHaveBeenCalledTimes(1);
    expect(deps.fetchPage).toHaveBeenCalledOnce();
    expect(deps.fetchPage).toHaveBeenCalledWith(hitUrl);
  });

  it("keeps an exact weak-parent publisher counterexample generic and hit-only", async () => {
    const hitUrl = "https://bangkokevents.example/reviews/bangkok-island";
    const fetchPage = vi.fn(async () => "bangkokislandtips@bangkokevents.example");
    const hit = await discoverVenueContact(
      { name: "Bangkok Island", city: "Bangkok" },
      {
        serperSearch: async () => [{
          link: hitUrl,
          title: "Bangkok Island Bangkok review | Bangkok Events",
        }],
        fetchPage,
      },
    );
    expect(hit).toEqual(expect.objectContaining({
      email: "bangkokislandtips@bangkokevents.example",
      direct: false,
    }));
    expect(fetchPage).toHaveBeenCalledOnce();
    expect(fetchPage).toHaveBeenCalledWith(hitUrl);
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

  it("fetches a later strict first-party result before an earlier loose publisher", async () => {
    const publisherUrl = "https://bangkokevents.example/bangkok-island";
    const officialUrl = "https://bangkokisland.com/contact/";
    const fetchPage = vi.fn(async (url: string) => {
      if (url === publisherUrl) return "info@bangkokevents.example";
      if (url === officialUrl) return "bangkokislands@gmail.com";
      return null;
    });
    const hit = await discoverVenueContact(
      { name: "Bangkok Island", city: "Bangkok" },
      {
        serperSearch: vi.fn(async () => [
          { link: publisherUrl },
          { link: officialUrl },
        ]),
        fetchPage,
      },
    );
    expect(hit).toEqual(expect.objectContaining({
      email: "bangkokislands@gmail.com",
      direct: true,
    }));
    expect(fetchPage).not.toHaveBeenCalledWith(publisherUrl);
  });

  it("retains the strong-site generic while still evaluating a later weak contact", async () => {
    const strictUrl = "https://bangkokisland.com/about";
    const weakUrl = "https://hotel.example/dining/bangkok-island/";
    const fetchPage = vi.fn(async (url: string) => {
      if (url === strictUrl) return "hello@hospitality-group.example";
      if (url === weakUrl) return "bangkokislands@gmail.com";
      return null;
    });
    const hit = await discoverVenueContact(
      { name: "Bangkok Island", city: "Bangkok" },
      {
        serperSearch: async () => [
          { link: strictUrl, title: "Bangkok Island" },
          { link: weakUrl, title: "Bangkok Island Bangkok | Hotel" },
        ],
        fetchPage,
      },
    );
    expect(hit).toEqual(expect.objectContaining({
      email: "hello@hospitality-group.example",
    }));
    expect(hit).not.toHaveProperty("direct");
    expect(fetchPage).toHaveBeenCalledWith(weakUrl);
  });

  it("evaluates no more than three search-result candidates", async () => {
    const candidates = [1, 2, 3, 4].map((n) => ({
      link: `https://hotel${n}.example/dining/baryard-bangkok/`,
      title: "Bar.Yard Bangkok | Hotel",
    }));
    const fetchPage = vi.fn(async (url: string) =>
      url === candidates[3]!.link ? "baryard@example.com" : null,
    );
    expect(
      await discoverVenueContact(
        { name: "Bar.Yard", city: "Bangkok" },
        { serperSearch: async () => candidates, fetchPage },
      ),
    ).toBeNull();
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage).not.toHaveBeenCalledWith(candidates[3]!.link);
  });

  it("fully crawls at most one strict result and keeps later strict hits indexed-only", async () => {
    const strictResults = [
      { link: "https://thevault.example/about" },
      { link: "https://thevaultbar.example/contact-team" },
      { link: "https://clubthevault.example/events-team" },
    ];
    const fetchPage = vi.fn(async (_url: string) => null);
    const serperSearch = vi.fn(async () => strictResults);

    expect(await discoverVenueContact(venue, { serperSearch, fetchPage })).toBeNull();
    expect(serperSearch).toHaveBeenCalledOnce();
    expect(fetchPage).toHaveBeenCalledTimes(CONTACT_PAGE_FETCH_CAP_PER_VENUE);
    expect(
      fetchPage.mock.calls.filter(([url]) =>
        String(url).startsWith("https://thevault.example"),
      ),
    ).toHaveLength(CONTACT_PATHS.length + 2);
    expect(fetchPage).toHaveBeenCalledWith(strictResults[1]!.link);
    expect(fetchPage).toHaveBeenCalledWith(strictResults[2]!.link);
  });

  it("shares one absolute page-fetch budget across guessed, discovered and later candidates", async () => {
    const first = "https://thevault.example/about";
    const later = [
      "https://thevaultbar.example/contact-team",
      "https://clubthevault.example/events-team",
    ];
    const discovered = [
      "https://thevault.example/contact/artist-booking",
      "https://thevault.example/events/private",
    ];
    const fetchPage = vi.fn(async (url: string) =>
      url === first
        ? `<a href="${discovered[0]}">Contact</a><a href="${discovered[1]}">Events</a>`
        : null,
    );
    await discoverVenueContact(venue, {
      serperSearch: async () => [
        { link: first },
        ...later.map((link) => ({ link })),
      ],
      fetchPage,
    });

    expect(fetchPage).toHaveBeenCalledTimes(CONTACT_PAGE_FETCH_CAP_PER_VENUE);
    expect(fetchPage).toHaveBeenCalledWith(discovered[0]);
    expect(fetchPage).toHaveBeenCalledWith(discovered[1]);
    expect(fetchPage).not.toHaveBeenCalledWith(later[0]);
    expect(fetchPage).not.toHaveBeenCalledWith(later[1]);
  });

  it("crawls at most two discovered purpose links and only on the strict same host", async () => {
    const hitUrl = "https://thevault.example/about";
    const first = "https://thevault.example/hidden-contact-one";
    const second = "https://thevault.example/events/team";
    const third = "https://thevault.example/contact/third";
    const external = "https://publisher.example/contact";
    const downgrade = "http://thevault.example/contact/insecure";
    const alternatePort = "https://thevault.example:8443/contact";
    const fetchPage = vi.fn(async (url: string) => {
      if (url === hitUrl) {
        return `
          <a href="/contact">Known contact path</a>
          <a href="/events">Known events path</a>
          <a href="/hidden-contact-one">Contact</a>
          <a href="${external}">External contact</a>
          <a href="${downgrade}">Insecure contact</a>
          <a href="${alternatePort}">Alternate port</a>
          <a href="/events/team">Events team</a>
          <a href="/contact/third">Third contact</a>`;
      }
      if (url === second) return "events@thevault.example";
      return null;
    });
    const hit = await discoverVenueContact(venue, {
      serperSearch: async () => [{ link: hitUrl }],
      fetchPage,
    });
    expect(hit).toEqual(expect.objectContaining({ email: "events@thevault.example" }));
    expect(fetchPage).toHaveBeenCalledWith(first);
    expect(fetchPage).toHaveBeenCalledWith(second);
    expect(fetchPage).not.toHaveBeenCalledWith(third);
    expect(fetchPage).not.toHaveBeenCalledWith(external);
    expect(fetchPage).not.toHaveBeenCalledWith(downgrade);
    expect(fetchPage).not.toHaveBeenCalledWith(alternatePort);
  });

  it("never fans out from a weak parent-brand search hit", async () => {
    const weakUrl = "https://hotel.example/dining/baryard-bangkok/";
    const fetchPage = vi.fn(async () => `<a href="/contact">Contact us</a>`);
    expect(
      await discoverVenueContact(
        { name: "Bar.Yard", city: "Bangkok" },
        {
          serperSearch: async () => [
            { link: weakUrl, title: "Bar.Yard Bangkok | Hotel" },
          ],
          fetchPage,
        },
      ),
    ).toBeNull();
    expect(fetchPage).toHaveBeenCalledOnce();
    expect(fetchPage).toHaveBeenCalledWith(weakUrl);
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

  it("stops admitting venues after the wall budget but always allows the first", async () => {
    mockDb.venue.findMany
      .mockResolvedValueOnce([
        dbVenue("v1", "First Room"),
        dbVenue("v2", "Second Room"),
        dbVenue("v3", "Third Room"),
      ])
      .mockResolvedValueOnce([]);
    const wallClock = vi.fn()
      .mockReturnValueOnce(0) // pass start
      .mockReturnValueOnce(CONTACT_PASS_WALL_BUDGET_MS + 1); // before venue two
    const serperSearch = vi.fn(async () => []);

    const result = await runContactPass("biz1", {
      deps: { serperSearch, fetchPage: async () => null },
      limit: 3,
      wallClock,
    });

    expect(result.attempted).toBe(1);
    expect(serperSearch).toHaveBeenCalledOnce();
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

  it("keeps a loose publisher role address generic across a second attempt", async () => {
    const fresh = {
      ...dbVenue("v1", "Bangkok Island"),
      city: "Bangkok",
    };
    const deps: ContactDeps = {
      serperSearch: async () => [{ link: "https://bangkokislandguide.com/article" }],
      fetchPage: async () => "events@bangkokislandguide.com",
    };
    mockDb.venue.findMany.mockResolvedValueOnce([fresh]).mockResolvedValueOnce([]);

    await runContactPass("biz1", { now: new Date("2026-08-16"), deps, limit: 1 });
    const firstSaved = mockDb.venue.updateMany.mock.calls
      .map(([call]) => call)
      .find((call) => call.data.bookingEmail === "events@bangkokislandguide.com");
    expect(firstSaved?.data.contactState).toBe("FOUND_GENERIC");

    const retry = {
      ...fresh,
      bookingEmail: "events@bangkokislandguide.com",
      contactSource: firstSaved?.data.contactSource,
      contactAttemptCount: 1,
      contactLastAttemptAt: new Date("2026-08-16"),
      contactRetryAfter: new Date("2026-09-15"),
      contactState: "FOUND_GENERIC",
    };
    mockDb.venue.findMany.mockReset();
    mockDb.venue.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([retry]);
    mockDb.venue.updateMany.mockClear();
    mockDb.venue.updateMany.mockResolvedValue({ count: 1 });

    await runContactPass("biz1", { now: new Date("2026-09-15"), deps, limit: 1 });
    const secondSaved = mockDb.venue.updateMany.mock.calls
      .map(([call]) => call)
      .find((call) => call.data.bookingEmail === "events@bangkokislandguide.com");
    expect(secondSaved?.data.contactState).toBe("FOUND_GENERIC");
    expect(secondSaved?.data.contactRetryAfter).toEqual(new Date("2026-12-14"));
  });

  it("can later upgrade a due generic address to a direct bookings contact", async () => {
    const generic = {
      ...dbVenue("v1", "The Vault"),
      // Same role rank as the later direct hit, but persisted generic proof.
      bookingEmail: "events@publisher.example",
      contactSource: "search-matched page /article — events/bookings contact",
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

  it("persists both Bar.Yard and a weak publisher counterexample as FOUND_GENERIC", async () => {
    const barYard = { ...dbVenue("bar-yard", "Bar.Yard"), city: "Bangkok" };
    const publisher = {
      ...dbVenue("bangkok-island", "Bangkok Island"),
      city: "Bangkok",
    };
    mockDb.venue.findMany
      .mockResolvedValueOnce([barYard, publisher])
      .mockResolvedValueOnce([]);
    const deps: ContactDeps = {
      serperSearch: async (query) =>
        query.includes("Bar.Yard")
          ? [{
              link: "https://www.kimptonmaalaibangkok.com/dining/baryard-bangkok/",
              title: "Bar.Yard Bangkok | Kimpton",
            }]
          : [{
              link: "https://bangkokevents.example/reviews/bangkok-island",
              title: "Bangkok Island Bangkok review | Bangkok Events",
            }],
      fetchPage: async (url) =>
        url.includes("kimpton")
          ? "BarYard.Kimptonmaalai@ihg.com"
          : "bangkokislandtips@bangkokevents.example",
    };

    await runContactPass("biz1", {
      now: new Date("2026-08-16"),
      deps,
      limit: 2,
    });

    for (const email of [
      "baryard.kimptonmaalai@ihg.com",
      "bangkokislandtips@bangkokevents.example",
    ]) {
      const saved = mockDb.venue.updateMany.mock.calls
        .map(([call]) => call)
        .find((call) => call.data.bookingEmail === email);
      expect(saved?.data.contactState).toBe("FOUND_GENERIC");
      expect(saved?.data.contactRetryAfter).toEqual(new Date("2026-09-15"));
      expect(saved?.data.contactSource).toContain("verify parent brand");
    }
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
  const resLike = (
    status: number,
    contentType: string,
    body: BodyInit | null,
    headers: Record<string, string> = {},
  ) =>
    new Response(body, {
      status,
      headers: { "content-type": contentType, ...headers },
    });

  // IP-literal hosts throughout: resolvesToBlockedIp only does DNS for NAMES,
  // so literals keep the tests network-free.
  it("refuses private/loopback/metadata hosts without ever fetching", async () => {
    const fetchFn = vi.fn();
    const deps = makeLiveDeps({ fetchFn: fetchFn as unknown as typeof fetch });
    expect(await deps.fetchPage("http://169.254.169.254/latest/meta-data")).toBeNull();
    expect(await deps.fetchPage("http://127.0.0.1/contact")).toBeNull();
    expect(await deps.fetchPage("http://10.1.2.3/contact")).toBeNull();
    expect(await deps.fetchPage("http://localhost/contact")).toBeNull();
    expect(await deps.fetchPage("http://[::ffff:7f00:1]/contact")).toBeNull();
    expect(await deps.fetchPage("http://[::ffff:a00:1]/contact")).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("refuses non-http(s) schemes and unparseable URLs", async () => {
    const fetchFn = vi.fn();
    const deps = makeLiveDeps({ fetchFn: fetchFn as unknown as typeof fetch });
    expect(await deps.fetchPage("file:///etc/passwd")).toBeNull();
    expect(await deps.fetchPage("not a url")).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("follows one same-host redirect after revalidation", async () => {
    const fetchFn = vi.fn(async (url: string | URL | Request) =>
      String(url).endsWith("/contact")
        ? resLike(302, "text/html", null, { location: "/contact/" })
        : resLike(200, "text/html", "<p>events@x.example</p>"),
    );
    const deps = makeLiveDeps({ fetchFn: fetchFn as unknown as typeof fetch });
    expect(await deps.fetchPage("http://203.0.113.10/contact")).toBe(
      "<p>events@x.example</p>",
    );
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn.mock.calls[1]?.[0]).toBe("http://203.0.113.10/contact/");
    const init = (fetchFn.mock.calls[0] as unknown[])[1] as RequestInit;
    const redirectedInit = (fetchFn.mock.calls[1] as unknown[])[1] as RequestInit;
    expect(init.redirect).toBe("manual");
    expect(redirectedInit.signal).toBe(init.signal);
  });

  it("rejects a cross-host redirect without fetching its target", async () => {
    const fetchFn = vi.fn(async () =>
      resLike(302, "text/html", null, {
        location: "http://198.51.100.20/contact",
      }),
    );
    const deps = makeLiveDeps({ fetchFn: fetchFn as unknown as typeof fetch });
    expect(await deps.fetchPage("http://203.0.113.10/contact")).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("rejects a second redirect and an HTTPS-to-HTTP downgrade", async () => {
    const secondRedirectFetch = vi.fn(async (url: string | URL | Request) =>
      resLike(302, "text/html", null, {
        location: String(url).endsWith("/one") ? "/two" : "/three",
      }),
    );
    expect(
      await makeLiveDeps({
        fetchFn: secondRedirectFetch as unknown as typeof fetch,
      }).fetchPage("http://203.0.113.10/one"),
    ).toBeNull();
    expect(secondRedirectFetch).toHaveBeenCalledTimes(2);

    const downgradeFetch = vi.fn(async () =>
      resLike(302, "text/html", null, {
        location: "http://203.0.113.10/contact",
      }),
    );
    expect(
      await makeLiveDeps({ fetchFn: downgradeFetch as unknown as typeof fetch }).fetchPage(
        "https://203.0.113.10/contact",
      ),
    ).toBeNull();
    expect(downgradeFetch).toHaveBeenCalledTimes(1);
  });

  it("still returns HTML from an allowed host", async () => {
    const fetchFn = vi.fn(async () => resLike(200, "text/html; charset=utf-8", "<p>events@x.example</p>"));
    const deps = makeLiveDeps({ fetchFn: fetchFn as unknown as typeof fetch });
    expect(await deps.fetchPage("http://203.0.113.10/contact")).toBe("<p>events@x.example</p>");
  });

  it("still permits a public IPv6 literal", async () => {
    const fetchFn = vi.fn(async () =>
      resLike(200, "text/html", "<p>events@x.example</p>"),
    );
    const deps = makeLiveDeps({ fetchFn: fetchFn as unknown as typeof fetch });
    expect(await deps.fetchPage("http://[2001:4860:4860::8888]/contact")).toBe(
      "<p>events@x.example</p>",
    );
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("retains a bounded head and tail so footer contacts remain extractable", async () => {
    const body = `${" ".repeat(CONTACT_PAGE_HEAD_CHAR_CAP + 20_000)}${"\n".repeat(80_000)}footer@venue.example`;
    const fetchFn = vi.fn(async () => resLike(200, "text/html", body));
    const page = await makeLiveDeps({
      fetchFn: fetchFn as unknown as typeof fetch,
    }).fetchPage("http://203.0.113.10/contact");
    expect(page).not.toBeNull();
    expect(page).toContain(CONTACT_PAGE_SAMPLE_SEPARATOR);
    expect(extractEmails(page!)).toContain("footer@venue.example");
    expect(page!.length).toBeLessThanOrEqual(
      CONTACT_PAGE_HEAD_CHAR_CAP +
        CONTACT_PAGE_TAIL_CHAR_CAP +
        CONTACT_PAGE_SAMPLE_SEPARATOR.length,
    );
  });

  it("cancels an oversized decoded body at the absolute cap", async () => {
    let cancelled = false;
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("x".repeat(CONTACT_PAGE_DECODED_CHAR_CAP + 10_000)));
      },
      cancel() {
        cancelled = true;
      },
    });
    const fetchFn = vi.fn(async () => resLike(200, "text/html", stream));
    const page = await makeLiveDeps({
      fetchFn: fetchFn as unknown as typeof fetch,
    }).fetchPage("http://203.0.113.10/contact");
    expect(cancelled).toBe(true);
    expect(page).not.toBeNull();
    expect(page!.length).toBeLessThanOrEqual(
      CONTACT_PAGE_HEAD_CHAR_CAP +
        CONTACT_PAGE_TAIL_CHAR_CAP +
        CONTACT_PAGE_SAMPLE_SEPARATOR.length,
    );
  });

  it("inserts a separator so head and tail fragments cannot splice a false email", async () => {
    const head = `${" ".repeat(CONTACT_PAGE_HEAD_CHAR_CAP - "local".length)}local`;
    const middle = "\n".repeat(80_000);
    const tail = `@example.com${" ".repeat(
      CONTACT_PAGE_TAIL_CHAR_CAP - "@example.com".length,
    )}`;
    const fetchFn = vi.fn(async () => resLike(200, "text/html", head + middle + tail));
    const page = await makeLiveDeps({
      fetchFn: fetchFn as unknown as typeof fetch,
    }).fetchPage("http://203.0.113.10/contact");
    expect(page).toBe(`${head}${CONTACT_PAGE_SAMPLE_SEPARATOR}${tail}`);
    expect(extractEmails(page!)).not.toContain("local@example.com");
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
