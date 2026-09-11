import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import type { AgencyArtist } from "@/lib/agency/roster";

const mocks = vi.hoisted(() => ({ getAgencyRoster: vi.fn() }));
vi.mock("@/lib/agency/roster", () => ({ getAgencyRoster: mocks.getAgencyRoster }));
import { GET } from "@/app/api/agency/artists/[id]/kit/route";

const artist: AgencyArtist = {
  id: "dj-benji", name: "Public Artist", city: "Bangkok", genres: ["House"],
  bio: "A public biography.", bioTh: "ประวัติศิลปินสำหรับประชาสัมพันธ์",
  image: "https://res.cloudinary.com/public/artist.jpg", gallery: [],
  links: [{ label: "Mixcloud", url: "https://mixcloud.com/public-mix" }],
};
const context = (id = artist.id) => ({ params: Promise.resolve({ id }) });
const request = () => new Request("https://attacker.invalid/api/agency/artists/dj-benji/kit", {
  headers: { host: "attacker.invalid", "x-forwarded-host": "forwarded.attacker.invalid", "x-forwarded-proto": "http" },
});
const expectSafeError = (response: Response, status: number) => {
  expect(response.status).toBe(status);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
  expect(response.headers.get("Content-Disposition")).toBeNull();
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-11T12:34:56.000Z"));
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network request"); }));
  mocks.getAgencyRoster.mockResolvedValue([artist]);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("public promotion kit download route", () => {
  it("serves an actual public ZIP without authentication and uses a safe filename, cache policy and canonical links", async () => {
    const response = await GET(request(), context());
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/zip");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="bright-ears-dj-benji-promotion-kit-2026-09-11.zip"');
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(response.headers.get("Location")).toBeNull();
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(Number(response.headers.get("Content-Length"))).toBe(bytes.byteLength);
    const entries = unzipSync(bytes);
    expect(Object.keys(entries).sort()).toEqual(["README.txt", "artist.txt", "bio-en.txt", "bio-th.txt", "links.txt"].sort());
    expect(strFromU8(entries["bio-th.txt"])).toBe(artist.bioTh + "\n");
    const allText = Object.values(entries).map(bytes => strFromU8(bytes)).join("\n");
    expect(allText).toContain("https://brightears.io/artists/dj-benji/kit");
    expect(allText).not.toContain("attacker.invalid");
    expect(allText).not.toContain("localhost");
    expect(mocks.getAgencyRoster).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("exports only the requested visible artist and no extra record fields", async () => {
    const sentinel = "PRIVATE_ROUTE_SENTINEL";
    mocks.getAgencyRoster.mockResolvedValue([
      { ...artist, contactEmail: sentinel, lineId: sentinel, schedules: [sentinel], user: { email: sentinel }, gallery: [sentinel] },
      { ...artist, id: "other-artist", name: "OTHER_ARTIST_SENTINEL" },
    ]);
    const response = await GET(request(), context());
    const entries = unzipSync(new Uint8Array(await response.arrayBuffer()));
    const allText = Object.values(entries).map(bytes => strFromU8(bytes)).join("\n");
    expect(allText).toContain("Public Artist");
    expect(allText).not.toContain(sentinel);
    expect(allText).not.toContain("OTHER_ARTIST_SENTINEL");
  });

  it("returns retryable 503 when the roster is unavailable", async () => {
    mocks.getAgencyRoster.mockResolvedValue([]);
    const response = await GET(request(), context());
    expectSafeError(response, 503);
    expect(await response.json()).toEqual({ error: "Artist materials are temporarily unavailable. Please try again." });
  });

  it("returns 404 for an unknown artist in an available roster", async () => {
    const response = await GET(request(), context("not-a-current-artist"));
    expectSafeError(response, 404);
    expect(await response.json()).toEqual({ error: "Artist not found." });
  });

  it.each(["", "../private", "%2e%2e%2fprivate", "dj/name", "dj\\name", 'dj"; filename="bad', "dj\r\nX-Injected: yes", "a".repeat(81)])("rejects unsafe identifier %j before accessing the roster", async id => {
    const response = await GET(request(), context(id));
    expectSafeError(response, 404);
    expect(mocks.getAgencyRoster).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns a generic retryable error if the actual archive builder refuses content", async () => {
    mocks.getAgencyRoster.mockResolvedValue([{ ...artist, bio: "PRIVATE_OVERSIZED_CONTENT".repeat(10_000) }]);
    const response = await GET(request(), context());
    expectSafeError(response, 503);
    const body = await response.text();
    expect(body).toContain("Please try again or use the individual files on the kit page.");
    expect(body).not.toContain("PRIVATE_OVERSIZED_CONTENT");
    expect(body).not.toContain("Public kit text too large");
    expect(body).not.toContain(process.cwd());
  });
});
