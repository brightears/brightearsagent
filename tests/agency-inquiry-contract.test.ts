import { describe, it, expect } from "vitest";
import { boundedJson, inquirySchema } from "@/lib/agency/inquiry-contract";
import { parseShortlist } from "@/lib/agency/shortlist";

describe("bounded public enquiry body", () => {
  it("rejects oversized streamed bodies without trusting content length", async () => {
    const body = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('"' + "x".repeat(9000) + '"')); controller.close(); } });
    const request = new Request("https://example.invalid", { method: "POST", headers: { "content-type": "application/json" }, body, duplex: "half" } as RequestInit);
    await expect(boundedJson(request)).rejects.toMatchObject({ status: 413 });
  });
  it("rejects malformed json and unsupported types", async () => {
    await expect(boundedJson(new Request("https://example.invalid", { method: "POST", headers: { "content-type": "application/json" }, body: "{" }))).rejects.toMatchObject({ status: 400 });
    await expect(boundedJson(new Request("https://example.invalid", { method: "POST", body: "{}" }))).rejects.toMatchObject({ status: 415 });
  });
  it("does not accept arbitrary nested content or missing required fields", () => {
    expect(inquirySchema.safeParse({ brief: { email: "not-an-email" } }).success).toBe(false);
  });
});
describe("persisted shortlist input", () => {
  it("recovers safely from damaged or unexpected storage", () => {
    expect(parseShortlist("not-json")).toEqual([]);
    expect(parseShortlist('{"id":"dj-test"}')).toEqual([]);
    expect(parseShortlist('["dj-one","dj-one",null,"../../private",1,"dj-two"]')).toEqual(["dj-one", "dj-two"]);
    expect(parseShortlist(JSON.stringify(Array.from({ length: 10 }, (_, index) => `dj-${index}`)))).toHaveLength(6);
  });
});
