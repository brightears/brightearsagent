import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { InquiryError } from "@/lib/agency/inquiry-contract";
import { applicationSchema } from "@/lib/agency/application-contract";
import { LISTING_CONSENT_VERSION } from "@/lib/agency/listing-consent";
import {
  acknowledgeArtistApplication, APPLICATION_EXPORT_STAMP, artistApplicationPhoto, MAX_STORED_PHOTO_BYTES, pendingArtistApplications,
  purgeExportedApplications, saveArtistApplication,
} from "@/lib/agency/applications";
import { GET, POST } from "@/app/api/agency/applications/route";
import { GET as PHOTO } from "@/app/api/agency/applications/[id]/photo/route";
import { GET as INQUIRIES } from "@/app/api/agency/inquiries/route";

const url = new URL(process.env.DATABASE_URL || "");
const local = url.port === "55439" && url.pathname === "/agency_test";
const ci = process.env.CI === "true" && url.port === "5432" && url.pathname === "/brightears_ci";
if (url.hostname !== "127.0.0.1" || !(local || ci)) throw Error("Isolated agency test database required");
process.env.AGENCY_INQUIRY_TOKEN = "fixture-inquiry-token-with-at-least-32-characters";
process.env.APP_URL = "https://brightears.io";
const auth = { authorization: `Bearer ${process.env.AGENCY_INQUIRY_TOKEN}` };

const input = () => applicationSchema.parse({
  submissionKey: randomUUID(), locale: "th", website: "", sourcePath: "/join", utm: { source: "fixture" },
  application: {
    act_name: "FIXTURE duo", contact_name: "Fixture", act_type: "vocal_duo", instrument_or_role: "vocals and guitar", members: 2,
    base_city: "pattaya", years_performing: "1_3", genres: ["acoustic_pop"], settings_played: ["restaurant_dinner"],
    mix_or_video_url: "https://www.youtube.com/watch?v=fixture", preferred_channel: "email", email: "fixture@example.invalid",
    expected_fee_per_hour_thb: "1500_2500", consent_age: true, consent_data: true,
  },
});
const photo = { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), contentType: "image/jpeg" as const };
const isError = (status: number) => (error: unknown) => error instanceof InquiryError && error.status === status;
const reset = () => db.artistApplication.deleteMany();
const stamp = (at: Date) => db.opsStamp.upsert({ where: { key: APPLICATION_EXPORT_STAMP }, update: { at }, create: { key: APPLICATION_EXPORT_STAMP, at } });

async function main() {
  try {
    await reset();
    await db.agencyInquiry.deleteMany();
    await db.opsStamp.deleteMany({ where: { key: APPLICATION_EXPORT_STAMP } });
    // Closed until the Talent desk export has run once.
    await assert.rejects(saveArtistApplication(input(), null, "fixture-closed"), isError(503));
    await stamp(new Date());

    const same = input();
    const saved = await Promise.all(Array.from({ length: 5 }, () => saveArtistApplication(same, photo, "fixture-one")));
    assert.equal(new Set(saved.map(result => result.reference)).size, 1);
    assert.equal(saved.filter(result => !result.duplicate).length, 1);
    assert.equal(await db.artistApplication.count(), 1);
    await assert.rejects(saveArtistApplication(same, null, "fixture-one"), isError(409));

    const pending = await pendingArtistApplications();
    assert.equal(pending.length, 1);
    // No profile box ticked: stored as false, with the time and the wording version shown.
    assert.equal(pending[0].listingConsent, false);
    assert.equal(pending[0].listingConsentVersion, LISTING_CONSENT_VERSION);
    assert.ok(pending[0].listingConsentAt instanceof Date);
    assert.equal(pending[0].actType, "vocal_duo");
    assert.equal(JSON.stringify(pending[0]).includes("clientHash"), false);
    assert.deepEqual(pending[0].photo, { contentType: "image/jpeg", byteSize: 7, sha256: pending[0].photo!.sha256 });
    const stored = await artistApplicationPhoto(pending[0].id);
    assert.deepEqual([...stored!.bytes], [...photo.bytes]);
    assert.equal((await PHOTO(new Request("https://brightears.io/x"), { params: Promise.resolve({ id: pending[0].id }) })).status, 401);
    const download = await PHOTO(new Request("https://brightears.io/x", { headers: auth }), { params: Promise.resolve({ id: pending[0].id }) });
    assert.equal(download.status, 200); assert.equal(download.headers.get("content-type"), "image/jpeg");

    // Applications never enter Vinyl's enquiry queue.
    const queue = await INQUIRIES(new Request("https://brightears.io/api/agency/inquiries", { headers: auth }));
    assert.deepEqual(await queue.json(), { inquiries: [] });
    assert.equal((await GET(new Request("https://brightears.io/api/agency/applications"))).status, 401);
    const listed = await GET(new Request("https://brightears.io/api/agency/applications", { headers: auth }));
    assert.equal(listed.status, 200); assert.equal((await listed.json()).applications.length, 1);

    await acknowledgeArtistApplication(pending[0].id, "talent-inbox:fixture");
    await acknowledgeArtistApplication(pending[0].id, "talent-inbox:fixture");
    await assert.rejects(acknowledgeArtistApplication(pending[0].id, "other"), isError(409));
    await assert.rejects(acknowledgeArtistApplication(randomUUID(), "missing"), isError(404));
    assert.equal((await pendingArtistApplications()).length, 0);
    assert.equal((await db.artistApplication.findUnique({ where: { id: pending[0].id } }))!.clientHash, null);
    // The photo leaves the site as soon as the desk acknowledges it.
    assert.equal(await db.artistApplicationPhoto.count(), 0);
    assert.equal((await PHOTO(new Request("https://brightears.io/x", { headers: auth }), { params: Promise.resolve({ id: pending[0].id }) })).status, 404);

    // Site copies are purged 30 days after export.
    assert.deepEqual(await purgeExportedApplications(), { removed: 0, unexportedRemoved: 0 });
    assert.deepEqual(await purgeExportedApplications(Date.now() + 31 * 86_400_000), { removed: 1, unexportedRemoved: 0 });

    // A ticked profile box is stored and exported.
    await reset();
    const withListing = input();
    withListing.application.consent_listing = true;
    await saveArtistApplication(withListing, null, "fixture-listing");
    const consented = await pendingArtistApplications();
    assert.equal(consented[0].listingConsent, true);
    assert.equal(consented[0].listingConsentVersion, LISTING_CONSENT_VERSION);
    const exportedJson = await (await GET(new Request("https://brightears.io/api/agency/applications", { headers: auth }))).json();
    assert.equal(exportedJson.applications[0].listingConsent, true);
    assert.equal(typeof exportedJson.applications[0].listingConsentAt, "string");
    assert.equal(JSON.stringify(exportedJson).includes("consent_listing"), false);

    // Applications nobody collected are deleted after 30 days too.
    await reset();
    const uncollected = await saveArtistApplication(input(), photo, "fixture-uncollected");
    assert.deepEqual(await purgeExportedApplications(Date.now() + 29 * 86_400_000), { removed: 0, unexportedRemoved: 0 });
    assert.deepEqual(await purgeExportedApplications(Date.now() + 31 * 86_400_000), { removed: 0, unexportedRemoved: 1 });
    assert.equal(await db.artistApplication.count({ where: { id: uncollected.reference.replace("BE-APP-", "") } }), 0);
    assert.equal(await db.artistApplicationPhoto.count(), 0);

    // When stored photos reach the cap, the application is still saved, without its photo.
    await reset();
    const full = await saveArtistApplication(input(), photo, "fixture-full-1");
    await db.artistApplicationPhoto.updateMany({ data: { byteSize: MAX_STORED_PHOTO_BYTES - 3 } });
    const over = input();
    const withheld = await saveArtistApplication(over, photo, "fixture-full-2");
    assert.equal(withheld.photoStored, false);
    assert.equal((await saveArtistApplication(over, photo, "fixture-full-2")).photoStored, false);
    const withheldRow = await db.artistApplication.findUnique({ where: { id: withheld.reference.replace("BE-APP-", "") }, include: { photo: true } });
    assert.equal(withheldRow!.photo, null);
    assert.equal((withheldRow!.details as Record<string, unknown>).photo_not_stored, "storage_full");
    assert.equal((await saveArtistApplication(input(), null, "fixture-full-3")).photoStored, true);
    assert.ok(full.photoStored);

    await reset();
    const burst = await Promise.allSettled(Array.from({ length: 5 }, () => saveArtistApplication(input(), null, "fixture-limit")));
    assert.equal(burst.filter(result => result.status === "fulfilled").length, 3);

    await reset();
    const form = new FormData();
    form.set("payload", JSON.stringify({ ...input(), application: { ...input().application, phone: "" } }));
    const created = await POST(new Request("https://brightears.io/api/agency/applications", { method: "POST", headers: { origin: "https://brightears.io", "cf-connecting-ip": "fixture-api" }, body: form }));
    assert.equal(created.status, 201);
    const spam = new FormData();
    spam.set("payload", JSON.stringify({ ...input(), website: "spam.invalid" }));
    assert.equal((await POST(new Request("https://brightears.io/api/agency/applications", { method: "POST", headers: { "cf-connecting-ip": "fixture-spam" }, body: spam }))).status, 400);
    await stamp(new Date(Date.now() - 9 * 86_400_000));
    await assert.rejects(saveArtistApplication(input(), null, "fixture-stale"), isError(503));
    console.log("PASS: application idempotency, export gate, private photo storage and download, separate from the enquiry queue, durable ack, hash and photo removal at export, 30-day purge of exported and uncollected copies, photo storage cap, per-network limit, honeypot, optional listing consent stored and exported.");
  } finally {
    await reset(); await db.opsStamp.deleteMany({ where: { key: APPLICATION_EXPORT_STAMP } }); await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
