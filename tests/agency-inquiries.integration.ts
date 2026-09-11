import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { saveAgencyInquiry, pendingAgencyInquiries, acknowledgeAgencyInquiry } from "@/lib/agency/inquiries";
import { inquirySchema, InquiryError } from "@/lib/agency/inquiry-contract";
import { GET, POST } from "@/app/api/agency/inquiries/route";

const url = new URL(process.env.DATABASE_URL || "");
const local = url.port === "55439" && url.pathname === "/agency_test";
const ci = process.env.CI === "true" && url.port === "5432" && url.pathname === "/brightears_ci";
if (url.hostname !== "127.0.0.1" || !(local || ci)) throw Error("Isolated agency test database required");
process.env.AGENCY_INQUIRY_TOKEN = "fixture-inquiry-token-with-at-least-32-characters";
process.env.APP_URL = "https://brightears.io";
const input = () => inquirySchema.parse({
  submissionKey: randomUUID(), locale: "en", source: "venues", website: "",
  brief: { occasion: "A regular venue programme", venue: "FIXTURE rooftop, Bangkok", date: "2026-10-01", time: "Fridays 19:00–23:00", guests: "100", sound: "Warm & relaxed", details: "Integration fixture. No send.", name: "Fixture Booker", email: "fixture@example.invalid" },
});
const isError = (status: number) => (error: unknown) => error instanceof InquiryError && error.status === status;
const reset = () => db.agencyInquiry.deleteMany();
const req = (body: unknown, ip = "fixture-api", origin = "https://brightears.io") => new Request("https://brightears.io/api/agency/inquiries", { method: "POST", headers: { "content-type": "application/json", origin, "cf-connecting-ip": ip }, body: JSON.stringify(body) });
async function main() {
  try {
    await reset();
    await db.opsStamp.upsert({ where: { key: "agency:inquiry-worker" }, update: { at: new Date() }, create: { key: "agency:inquiry-worker", at: new Date() } });
    const same = input();
    const saved = await Promise.all(Array.from({ length: 8 }, () => saveAgencyInquiry(same, "fixture-one")));
    assert.equal(new Set(saved.map(result => result.reference)).size, 1);
    assert.equal(saved.filter(result => !result.duplicate).length, 1);
    assert.equal(await db.agencyInquiry.count(), 1);
    const malformed = await GET(new Request("https://brightears.io/api/agency/inquiries", { headers: { authorization: `Bearer ${"é".repeat(process.env.AGENCY_INQUIRY_TOKEN!.length)}` } }));
    assert.equal(malformed.status, 401);
    await assert.rejects(saveAgencyInquiry({ ...same, brief: { ...same.brief, email: "other@example.invalid" } }, "fixture-one"), isError(409));
    assert.equal((await pendingAgencyInquiries())[0].brief && JSON.stringify((await pendingAgencyInquiries())[0].brief).includes("fixture@example.invalid"), true);
    const anonymous = await GET(new Request("https://brightears.io/api/agency/inquiries"));
    assert.equal(anonymous.status, 401); assert.equal((await anonymous.text()).includes("fixture@example.invalid"), false);
    const authorized = await GET(new Request("https://brightears.io/api/agency/inquiries", { headers: { authorization: `Bearer ${process.env.AGENCY_INQUIRY_TOKEN}` } }));
    assert.equal(authorized.status, 200); assert.match(authorized.headers.get("cache-control") || "", /no-store/);
    const pending = await pendingAgencyInquiries();
    assert.deepEqual(Object.keys(pending[0]).sort(), ["brief", "createdAt", "id", "locale", "reference", "source"].sort());
    await acknowledgeAgencyInquiry(pending[0].id, "fixture-durable-receipt");
    await acknowledgeAgencyInquiry(pending[0].id, "fixture-durable-receipt");
    await assert.rejects(acknowledgeAgencyInquiry(pending[0].id, "different-receipt"), isError(409));
    assert.equal((await pendingAgencyInquiries()).length, 0);
    await assert.rejects(acknowledgeAgencyInquiry(randomUUID(), "missing"), isError(404));

    await reset();
    const requests = await Promise.allSettled(Array.from({ length: 8 }, () => saveAgencyInquiry(input(), "fixture-limit")));
    assert.equal(requests.filter(result => result.status === "fulfilled").length, 5);
    assert.equal(await db.agencyInquiry.count(), 5);
    await reset();
    const apiInput = input();
    const first = await POST(req(apiInput)); assert.equal(first.status, 201);
    const retry = await POST(req(apiInput)); assert.equal(retry.status, 200);
    assert.equal((await first.json()).reference, (await retry.json()).reference);
    assert.equal(await db.agencyInquiry.count(), 1);
    assert.equal((await POST(req(input(), "fixture-origin", "https://example.invalid"))).status, 403);
    assert.equal((await POST(req({ ...input(), brief: { ...input().brief, date: "2026-02-31" } }, "fixture-date"))).status, 400);
    assert.equal((await POST(req({ ...input(), website: "spam.invalid" }, "fixture-spam"))).status, 400);
    assert.equal((await POST(req({ ...input(), unexpected: "not accepted" }, "fixture-extra"))).status, 400);
    await db.opsStamp.update({ where: { key: "agency:inquiry-worker" }, data: { at: new Date(0) } });
    assert.equal((await POST(req(input(), "fixture-stale"))).status, 503);
    delete process.env.AGENCY_INQUIRY_TOKEN;
    assert.equal((await POST(req(input(), "fixture-disabled"))).status, 503);
    assert.equal(await db.agencyInquiry.count(), 1);
    console.log("PASS: real-database concurrent idempotency, mismatch rejection, shared limits, saved references, private authenticated queue, durable ack retries, validation and disabled-intake failure.");
  } finally { await reset(); await db.opsStamp.deleteMany({ where: { key: "agency:inquiry-worker" } }); await db.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
