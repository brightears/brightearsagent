import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { InquiryError } from "@/lib/agency/inquiry-contract";
import {
  catalogueProfileSchema, cataloguePhoto, deleteCatalogueProfile, listCatalogueProfiles, previewCatalogueArtist, publishCatalogueProfile,
  publishedCatalogueArtists, rotateCataloguePreview, unpublishCatalogueProfile, upsertCatalogueProfile,
} from "@/lib/agency/catalogue";
import { POST as DESK, GET as DESK_LIST } from "@/app/api/agency/catalogue/route";
import { GET as PUBLIC_PHOTO } from "@/app/api/agency/catalogue/photo/[slug]/route";
import { GET as PREVIEW_PHOTO } from "@/app/api/agency/catalogue/preview/[token]/photo/route";

const url = new URL(process.env.DATABASE_URL || "");
const local = url.port === "55439" && url.pathname === "/agency_test";
const ci = process.env.CI === "true" && url.port === "5432" && url.pathname === "/brightears_ci";
if (url.hostname !== "127.0.0.1" || !(local || ci)) throw Error("Isolated agency test database required");
process.env.AGENCY_INQUIRY_TOKEN = "fixture-inquiry-token-with-at-least-32-characters";
process.env.APP_URL = "https://brightears.io";
const auth = { authorization: `Bearer ${process.env.AGENCY_INQUIRY_TOKEN}` };
const isError = (status: number, code?: string) => (error: unknown) => error instanceof InquiryError && error.status === status && (!code || error.code === code);
const photo = { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 8, 7]), contentType: "image/jpeg" as const };
// Private details that live on the application and must never reach a profile.
const PRIVATE = { email: "private.fixture@example.invalid", phone: "+66812345678", fee: "2500_4000", legal: "FIXTURE LEGALNAME", rtw: "foreigner_with_work_permit" };

async function application(listingConsent: boolean) {
  const id = randomUUID();
  await db.artistApplication.create({ data: {
    id, submissionKey: randomUUID(), requestHash: "fixture", locale: "en", sourcePath: "/join", actType: "dj_with_live",
    details: { act_name: "Fixture Sax", contact_name: PRIVATE.legal, email: PRIVATE.email, phone: PRIVATE.phone, residency_fee_per_hour_thb: PRIVATE.fee, right_to_work: PRIVATE.rtw },
    listingConsent, listingConsentAt: new Date(), listingConsentVersion: "listing-v2-2026-11-13",
  } });
  return `BE-APP-${id}`;
}
const profile = (applicationRef: string, slug = "fixture-sax") => catalogueProfileSchema.parse({
  applicationRef, slug, stageName: "Fixture Sax", actLabel: { en: "Sax & DJ", th: "แซกโซโฟนและดีเจ" }, actType: "dj_live", actTags: ["sax", "dj"],
  bio: { en: "Fixture Sax plays saxophone live over his own DJ sets, from bossa nova to house.", th: "" },
  genres: ["House", "Jazz"], basedIn: "bangkok", links: ["https://www.youtube.com/@fixture", "https://www.instagram.com/fixture"], photoCredit: "Fixture Studio",
});
const reset = async () => { await db.catalogueProfile.deleteMany(); await db.catalogueProfileEvent.deleteMany(); await db.artistApplication.deleteMany({ where: { requestHash: "fixture" } }); };

async function main() {
  try {
    await reset();
    // No consent, no profile; and no application, no profile.
    await assert.rejects(upsertCatalogueProfile(profile(await application(false)), photo), isError(409, "no_listing_consent"));
    await assert.rejects(upsertCatalogueProfile(profile(`BE-APP-${randomUUID()}`), photo), isError(404, "application_not_found"));
    const ref = await application(true);
    await assert.rejects(upsertCatalogueProfile(profile(ref), null), isError(400, "photo_required"));
    await assert.rejects(upsertCatalogueProfile(profile(ref, "dj-benji"), photo, ["dj-benji"]), isError(409, "slug_taken"));

    const created = await upsertCatalogueProfile(profile(ref), photo);
    assert.equal(created.status, "draft");
    assert.match(created.previewToken!, /^[A-Za-z0-9_-]{32}$/);
    // A draft is not public, but the preview link shows exactly it.
    assert.deepEqual(await publishedCatalogueArtists(), []);
    assert.equal(await cataloguePhoto({ slug: "fixture-sax" }), null);
    const preview = await previewCatalogueArtist(created.previewToken!);
    assert.equal(preview?.status, "draft");
    assert.equal(preview?.artist.name, "Fixture Sax");
    assert.equal((await PREVIEW_PHOTO(new Request("https://brightears.io/x"), { params: Promise.resolve({ token: created.previewToken! }) })).status, 200);
    assert.equal(await previewCatalogueArtist("A".repeat(32)), null);
    assert.equal(await previewCatalogueArtist("short"), null);
    // The token is stored only as a hash.
    const stored = await db.catalogueProfile.findUniqueOrThrow({ where: { slug: "fixture-sax" } });
    assert.notEqual(stored.previewTokenHash, created.previewToken);
    assert.equal(stored.consentVersion, "listing-v2-2026-11-13");

    // A second application cannot take the slug; the same one updates the draft.
    await assert.rejects(upsertCatalogueProfile(profile(await application(true)), photo), isError(409, "slug_taken"));
    assert.equal((await upsertCatalogueProfile({ ...profile(ref), stageName: "Fixture Sax Duo" }, null)).previewToken, null);

    // Rotating the link kills the old one.
    const rotated = await rotateCataloguePreview("fixture-sax");
    assert.equal(await previewCatalogueArtist(created.previewToken!), null);
    assert.ok(await previewCatalogueArtist(rotated.previewToken));

    // Publishing needs the artist's confirmation on record.
    await assert.rejects(publishCatalogueProfile("fixture-sax", ""), isError(400, "confirmation_required"));
    await publishCatalogueProfile("fixture-sax", "Instagram 16 Nov 14:02: OK to publish");
    const live = await publishedCatalogueArtists();
    assert.equal(live.length, 1);
    assert.equal(live[0].name, "Fixture Sax Duo");
    assert.equal(live[0].source, "catalogue");
    assert.deepEqual(live[0].actTags, ["sax", "dj"]);
    assert.equal(live[0].photoCredit, "Fixture Studio");
    assert.equal((await PUBLIC_PHOTO(new Request("https://brightears.io/x"), { params: Promise.resolve({ slug: "fixture-sax" }) })).status, 200);
    // Nothing private reaches the public data.
    const publicJson = JSON.stringify(live);
    for (const value of [...Object.values(PRIVATE), ref, "listing-v2", "consent", "previewTokenHash", rotated.previewToken]) assert.equal(publicJson.includes(value), false, value);

    // Unpublishing takes the profile, photo and preview off at once.
    await unpublishCatalogueProfile("fixture-sax", "Artist asked, LINE 17 Nov");
    assert.deepEqual(await publishedCatalogueArtists(), []);
    assert.equal((await PUBLIC_PHOTO(new Request("https://brightears.io/x"), { params: Promise.resolve({ slug: "fixture-sax" }) })).status, 404);
    assert.equal(await previewCatalogueArtist(rotated.previewToken), null);

    // Desk endpoints need the credential; the log records every action.
    assert.equal((await DESK_LIST(new Request("https://brightears.io/api/agency/catalogue"))).status, 401);
    assert.equal((await DESK(new Request("https://brightears.io/api/agency/catalogue", { method: "POST" }))).status, 401);
    const listed = await (await DESK_LIST(new Request("https://brightears.io/api/agency/catalogue", { headers: auth }))).json();
    assert.equal(listed.profiles[0].status, "removed");
    const { events } = await listCatalogueProfiles();
    assert.deepEqual(events.map(e => e.action).reverse(), ["created", "updated", "preview_rotated", "published", "unpublished"]);

    // Text that looks like contact details or fees is refused before it can be stored.
    for (const bio of [`Book me at ${PRIVATE.email} for weddings and hotel bars across Thailand.`, "Call 081 234 5678 to book weddings and hotel bars across Thailand.", "My rate is THB 3,000 per hour for hotel bars, rooftops and private events."]) {
      assert.equal(catalogueProfileSchema.safeParse({ ...profile(ref), bio: { en: bio, th: "" } }).success, false, bio);
    }

    // Delete removes the row and photo; the log stays.
    await deleteCatalogueProfile("fixture-sax", "Artist asked to delete");
    assert.equal(await db.catalogueProfile.count(), 0);
    assert.equal((await db.catalogueProfileEvent.count({ where: { slug: "fixture-sax", action: "deleted" } })), 1);
    console.log("PASS: consent gate, draft privacy, hashed rotating preview links, artist confirmation on publish, public allow-list, immediate unpublish, desk auth, action log, delete.");
  } finally {
    await reset(); await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
