import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  applicationFieldsSchema, applicationIssues, applicationSchema, containsThaiIdNumber, MAX_PHOTO_BYTES, normalizePhone, sniffPhotoType,
} from "@/lib/agency/application-contract";
import { inquirySchema } from "@/lib/agency/inquiry-contract";
import { formatMusicBrief, EMPTY_BRIEF } from "@/lib/agency/brief";
import { LANDING_PAGES } from "@/lib/agency/landing-pages";
import { BUYER_ACTS, ENQUIRY_ACT_OPTIONS } from "@/lib/agency/acts";
import { buildAgencyRoster } from "@/lib/agency/roster";
import { fitWithin } from "@/lib/agency/photo-resize";
import { LISTING_CONSENT_TEXT, PUBLISHING_SENTENCE } from "@/lib/agency/listing-consent";

const save = vi.hoisted(() => vi.fn());
const pending = vi.hoisted(() => vi.fn());
const open = vi.hoisted(() => vi.fn());
vi.mock("@/lib/agency/applications", () => ({
  saveArtistApplication: save, pendingArtistApplications: pending, applicationsOpen: open, purgeApplicationsSoon: vi.fn(),
  applicationExportAuthorized: (request: Request) => request.headers.get("authorization") === "Bearer fixture-token-with-at-least-thirty-two-chars",
}));
import { GET, POST } from "@/app/api/agency/applications/route";
import { ArtistApplicationForm } from "@/components/artist-application-form";

const fields = (overrides: Record<string, unknown> = {}) => ({
  act_name: "Fixture Sax", contact_name: "Fixture", act_type: "dj_with_live", instrument_or_role: "alto sax", members: 2,
  base_city: "bangkok", years_performing: "3_5", genres: ["house", "jazz"], settings_played: ["brunch"],
  mix_or_video_url: "https://www.youtube.com/watch?v=fixture", preferred_channel: "line", line_id: "fixture.line",
  consent_age: true, consent_data: true, ...overrides,
});
const payload = (overrides: Record<string, unknown> = {}) => ({ submissionKey: crypto.randomUUID(), locale: "en", website: "", application: fields(overrides) });
const issues = (overrides: Record<string, unknown>) => {
  const result = applicationFieldsSchema.safeParse(fields(overrides));
  return result.success ? [] : applicationIssues(result.error);
};
const post = (form: FormData, origin = "https://brightears.io") => POST(new Request("https://brightears.io/api/agency/applications", { method: "POST", headers: { origin, "cf-connecting-ip": crypto.randomUUID() }, body: form }));
const formWith = (body: unknown, photo?: Blob) => { const form = new FormData(); form.set("payload", JSON.stringify(body)); if (photo) form.set("photo", photo, "photo"); return form; };
const jpeg = (size = 32) => { const bytes = new Uint8Array(size); bytes.set([0xff, 0xd8, 0xff, 0xe0]); return new Blob([bytes], { type: "image/jpeg" }); };

describe("artist application contract", () => {
  it("accepts a complete application and normalizes the phone number", () => {
    const parsed = applicationFieldsSchema.parse(fields({ phone: "081-234-5678" }));
    expect(parsed.phone).toBe("+66812345678");
    expect(applicationSchema.safeParse(payload()).success).toBe(true);
  });
  it("requires a link, a contact route and both consents", () => {
    expect(issues({ mix_or_video_url: "" }).map(issue => issue.field)).toContain("mix_or_video_url");
    expect(issues({ line_id: "", email: "", phone: "" })).toContainEqual({ field: "contact", code: "contact_required" });
    expect(issues({ consent_age: false }).map(issue => issue.field)).toContain("consent_age");
    expect(issues({ consent_data: false }).map(issue => issue.field)).toContain("consent_data");
  });
  it("treats the public profile consent as optional and false unless ticked", () => {
    expect(applicationFieldsSchema.parse(fields()).consent_listing).toBe(false);
    expect(applicationFieldsSchema.parse(fields({ consent_listing: true })).consent_listing).toBe(true);
    expect(issues({ consent_listing: "yes" }).map(issue => issue.field)).toContain("consent_listing");
  });
  it("asks non-DJ acts for their instrument or role", () => {
    expect(issues({ instrument_or_role: "" }).map(issue => issue.field)).toContain("instrument_or_role");
    expect(issues({ act_type: "dj", instrument_or_role: "" })).toEqual([]);
  });
  it("refuses a Thai ID number in any free-text field", () => {
    expect(containsThaiIdNumber("1-2345-67890-12-3")).toBe(true);
    expect(containsThaiIdNumber("Played 2019–2024, 120 sets")).toBe(false);
    expect(containsThaiIdNumber("+66812345678")).toBe(false);
    expect(issues({ bio: "My ID is 3 1012 34567 89 0 and I play sax at hotels every weekend." })).toContainEqual({ field: "bio", code: "id_number" });
    expect(issues({ referred_by: "1101234567890" })).toContainEqual({ field: "referred_by", code: "id_number" });
  });
  it("keeps links to https and the named platform", () => {
    expect(issues({ mix_or_video_url: "http://example.com/mix" }).map(issue => issue.field)).toContain("mix_or_video_url");
    expect(issues({ instagram_url: "https://evil.example/instagram.com" }).map(issue => issue.field)).toContain("instagram_url");
    expect(issues({ youtube_url: "https://youtu.be/abc", facebook_url: "https://fb.com/act" })).toEqual([]);
  });
  it("has no field for identity, bank, birth date or address data", () => {
    const keys = Object.keys(applicationFieldsSchema.def.in.def.shape).join(" ");
    expect(keys).not.toMatch(/passport|national|id_card|bank|account|birth|dob|address|tax/i);
    expect(applicationFieldsSchema.safeParse({ ...fields(), bank_account: "123" }).success).toBe(false);
  });
  it("normalizes Thai and international phone numbers", () => {
    expect(normalizePhone("0812345678")).toBe("+66812345678");
    expect(normalizePhone("+44 7700 900123")).toBe("+447700900123");
    expect(normalizePhone("call me")).toBeNull();
  });
  it("detects image types from their bytes", async () => {
    expect(sniffPhotoType(new Uint8Array(await jpeg().arrayBuffer()))).toBe("image/jpeg");
    expect(sniffPhotoType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffPhotoType(new TextEncoder().encode("RIFF0000WEBPVP8 "))).toBe("image/webp");
    expect(sniffPhotoType(new TextEncoder().encode("GIF89a"))).toBeNull();
  });
});

describe("artist application route", () => {
  beforeEach(() => {
    save.mockReset(); save.mockResolvedValue({ reference: "BE-APP-fixture", duplicate: false, photoStored: true });
    pending.mockReset(); open.mockReset(); open.mockResolvedValue(true);
  });
  it("saves a valid multipart application with a photo", async () => {
    const response = await post(formWith(payload(), jpeg()));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true, reference: "BE-APP-fixture" });
    expect(save.mock.calls[0][1]).toMatchObject({ contentType: "image/jpeg" });
  });
  it("refuses photos that are not JPG, PNG or WebP, or too large", async () => {
    expect((await post(formWith(payload(), new Blob([new TextEncoder().encode("GIF89a........")], { type: "image/jpeg" })))).status).toBe(415);
    expect((await post(formWith(payload(), jpeg(MAX_PHOTO_BYTES + 1)))).status).toBe(413);
    expect(save).not.toHaveBeenCalled();
  });
  it("names invalid fields and flags ID numbers without saving", async () => {
    const response = await post(formWith(payload({ bio: "ID 1101234567890, sax player for hotel brunches in Bangkok since 2019." })));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "id_number", fields: ["bio"] });
    expect(save).not.toHaveBeenCalled();
  });
  it("rejects other origins and JSON bodies", async () => {
    expect((await post(formWith(payload()), "https://example.invalid")).status).toBe(403);
    const json = await POST(new Request("https://brightears.io/api/agency/applications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload()) }));
    expect(json.status).toBe(415);
  });
  it("submits with and without the public profile box", async () => {
    expect((await post(formWith(payload()))).status).toBe(201);
    expect(save.mock.calls[0][0].application.consent_listing).toBe(false);
    expect((await post(formWith(payload({ consent_listing: true })))).status).toBe(201);
    expect(save.mock.calls[1][0].application.consent_listing).toBe(true);
  });
  it("says when the photo was not kept because photo storage is full", async () => {
    save.mockResolvedValue({ reference: "BE-APP-fixture", duplicate: false, photoStored: false });
    const response = await post(formWith(payload(), jpeg()));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true, reference: "BE-APP-fixture", photo: "not_stored" });
  });
  it("refuses before reading the body when closed, too large or rate-limited", async () => {
    let pulled = false;
    const untouched = () => new ReadableStream({ pull() { pulled = true; } }, { highWaterMark: 0 });
    const request = (headers: Record<string, string>) => new Request("https://brightears.io/api/agency/applications", {
      method: "POST", body: untouched(), duplex: "half",
      headers: { "content-type": "multipart/form-data; boundary=x", "cf-connecting-ip": crypto.randomUUID(), ...headers },
    } as RequestInit);
    open.mockResolvedValue(false);
    expect((await POST(request({}))).status).toBe(503);
    open.mockResolvedValue(true);
    expect((await POST(request({ "content-length": String(MAX_PHOTO_BYTES * 2) }))).status).toBe(413);
    const ip = crypto.randomUUID();
    open.mockResolvedValue(false);
    for (let i = 0; i < 6; i++) await POST(request({ "cf-connecting-ip": ip }));
    expect((await POST(request({ "cf-connecting-ip": ip }))).status).toBe(429);
    expect(pulled).toBe(false);
  });
  it("stops reading a body without a length once it passes the limit", async () => {
    const chunk = new Uint8Array(1024 * 1024);
    let sent = 0;
    const body = new ReadableStream({ pull(controller) { sent += chunk.byteLength; controller.enqueue(chunk); } });
    const response = await POST(new Request("https://brightears.io/api/agency/applications", {
      method: "POST", body, duplex: "half",
      headers: { "content-type": "multipart/form-data; boundary=x", "cf-connecting-ip": crypto.randomUUID() },
    } as RequestInit));
    expect(response.status).toBe(413);
    expect(sent).toBeLessThan(MAX_PHOTO_BYTES * 2);
  });
  it("caps uploads in progress", async () => {
    const releases: Array<() => void> = [];
    const slow = () => {
      const form = new Response(formWith(payload()));
      return { headers: form.headers, body: new ReadableStream({ async start(controller) {
        await new Promise<void>(resolve => releases.push(resolve));
        controller.enqueue(new Uint8Array(await form.arrayBuffer())); controller.close();
      } }) };
    };
    const send = () => { const { headers, body } = slow(); return POST(new Request("https://brightears.io/api/agency/applications", {
      method: "POST", body, duplex: "half",
      headers: { "content-type": headers.get("content-type")!, "cf-connecting-ip": crypto.randomUUID() },
    } as RequestInit)); };
    const running = [send(), send(), send()];
    await vi.waitFor(() => expect(releases).toHaveLength(3));
    const fourth = await send();
    expect(fourth.status).toBe(503);
    expect(await fourth.json()).toEqual({ error: "busy" });
    releases.forEach(release => release());
    expect((await Promise.all(running)).map(response => response.status)).toEqual([201, 201, 201]);
  });
  it("keeps the export list private", async () => {
    pending.mockResolvedValue([{ id: "x" }]);
    expect((await GET(new Request("https://brightears.io/api/agency/applications"))).status).toBe(401);
    const authorized = await GET(new Request("https://brightears.io/api/agency/applications", { headers: { authorization: "Bearer fixture-token-with-at-least-thirty-two-chars" } }));
    expect(authorized.status).toBe(200);
    expect(authorized.headers.get("cache-control")).toMatch(/no-store/);
  });
});

describe("photo preparation", () => {
  it("fits photos inside 2,400 pixels on the long side without enlarging them", () => {
    expect(fitWithin(8064, 6048)).toEqual({ width: 2400, height: 1800 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1800, height: 2400 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe("application form", () => {
  it("shows the same fields and consent in English and Thai", () => {
    const en = renderToStaticMarkup(<ArtistApplicationForm th={false}/>);
    const th = renderToStaticMarkup(<ArtistApplicationForm th/>);
    const controls = (html: string) => (html.match(/<(input|select|textarea)\b/g) ?? []).length;
    expect(controls(th)).toBe(controls(en));
    expect(en).toContain("I am 18 or older");
    expect(th).toContain("ข้าพเจ้าอายุ 18 ปีขึ้นไป");
    expect(en).not.toMatch(/name="(passport|bank|dob)/i);
  });
  it("offers an unchecked public profile box and no longer promises to publish nothing", () => {
    const en = renderToStaticMarkup(<ArtistApplicationForm th={false}/>);
    const th = renderToStaticMarkup(<ArtistApplicationForm th/>);
    const unescape = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    for (const [html, lang] of [[en, "en"], [th, "th"]] as const) {
      expect(unescape(html)).toContain(LISTING_CONSENT_TEXT[lang]);
      expect(unescape(html)).toContain(PUBLISHING_SENTENCE[lang]);
      const box = html.slice(0, html.indexOf(LISTING_CONSENT_TEXT[lang].slice(0, 20))).split("<input").pop()!;
      expect(box).toContain('type="checkbox"');
      expect(box).not.toMatch(/checked=""|required/);
    }
    expect(en).not.toContain("does not publish anything from this form");
    expect(en + th).not.toMatch(/BMAsia|Beat Breeze|background music/i);
  });
});

describe("qualified enquiry brief", () => {
  const brief = { occasion: "A regular venue programme", venue: "Rooftop, Bangkok", date: "", time: "", guests: "", sound: "Warm & relaxed", details: "", name: "Fixture", email: "fixture@example.invalid" };
  it("accepts older submissions without the new fields", () => {
    expect(inquirySchema.safeParse({ submissionKey: crypto.randomUUID(), locale: "en", source: "venues", brief }).success).toBe(true);
  });
  it("accepts venue type, nights per week and act type from the new pages", () => {
    const parsed = inquirySchema.parse({ submissionKey: crypto.randomUUID(), locale: "th", source: "pattaya", brief: { ...brief, venueType: "Rooftop bar", nightsPerWeek: "Every night", actType: "DJ with a live musician" } });
    expect(parsed.brief).toMatchObject({ venueType: "Rooftop bar", nightsPerWeek: "Every night", actType: "DJ with a live musician" });
    expect(inquirySchema.safeParse({ submissionKey: crypto.randomUUID(), locale: "en", source: "unknown-page", brief }).success).toBe(false);
  });
  it("shows the qualification answers in the copied brief in the visitor's language", () => {
    const filled = { ...EMPTY_BRIEF, ...brief, venueType: "Rooftop bar", nightsPerWeek: "Every night", actType: "MC or host" };
    expect(formatMusicBrief(filled)).toContain("Nights per week: Every night");
    expect(formatMusicBrief(filled, true)).toContain("จำนวนคืนต่อสัปดาห์: ทุกคืน");
    expect(formatMusicBrief(filled, true)).toContain("รูปแบบการแสดง: พิธีกร / MC");
  });
  it("preselects only act values the form offers", () => {
    const offered = ENQUIRY_ACT_OPTIONS.map(option => option.en) as string[];
    for (const act of BUYER_ACTS) expect(offered).toContain(act.enquiry);
  });
});

describe("new buyer pages", () => {
  const pages = Object.values(LANDING_PAGES);
  it("never mention cards in calls to action", () => {
    const actions = pages.flatMap(page => [page.action, ...page.other.map(item => item.link)]);
    for (const action of actions) expect(`${action.en} ${action.th}`).not.toMatch(/card|บัตร/i);
  });
  it("cite only venues already shown on the site", () => {
    const shown = ["Nobu Bangkok", "Le Du Kaan", "ABar Rooftop", "Horizon Rooftop"];
    for (const item of pages.flatMap(page => page.evidence?.items ?? [])) expect(shown).toContain(item.name);
  });
});

describe("act types in the public roster", () => {
  const artist = (overrides: Record<string, unknown>) => ({ id: "fixture", stageName: "Fixture", profileImage: "https://res.cloudinary.com/fixture.jpg", ...overrides });
  it("maps public categories to act groups and hides unknown ones", () => {
    const roster = buildAgencyRoster([artist({ id: "a", category: "DJ" }), artist({ id: "b", category: "MUSICIAN" }), artist({ id: "c", category: "MAGICIAN" })]);
    expect(roster.filter(entry => ["a", "b", "c"].includes(entry.id)).map(entry => [entry.id, entry.actType])).toEqual([["a", "dj"], ["b", "solo"]]);
  });
});
