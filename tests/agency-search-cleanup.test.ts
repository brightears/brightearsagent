import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
  transaction: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: {
  agencySearchCache: { findUnique: mocks.findUnique, updateMany: mocks.updateMany, deleteMany: mocks.deleteMany },
  agencySearchBudget: { deleteMany: mocks.deleteMany },
  $transaction: mocks.transaction,
} }));
import { searchAgencyWeb } from "@/lib/agency/search";
const input = { mode: "opportunities", city: "Bangkok", country: "th", language: "en" } as const;

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SERPER_API_KEY", "fixture");
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.findUnique.mockResolvedValue(null);
  mocks.transaction.mockImplementation(async callback => {
    const table = { upsert: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({ count: 1 }) };
    return callback({ agencySearchCache: table, agencySearchBudget: table });
  });
  mocks.deleteMany.mockRejectedValue(new Error("Cleanup unavailable"));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("search cleanup does not override the actual result", () => {
  it("returns the saved successful result if lease release or pruning fails", async () => {
    mocks.fetch.mockImplementation(async () => new Response(JSON.stringify({ organic: [] })));
    mocks.updateMany.mockResolvedValueOnce({ count: 1 }).mockRejectedValue(new Error("Lease cleanup unavailable"));
    await expect(searchAgencyWeb(input, "fixture-user")).resolves.toMatchObject({ results: [], cached: false, partial: false });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(mocks.deleteMany).toHaveBeenCalledTimes(2);
  });
  it("preserves the provider refusal if lease release also fails", async () => {
    mocks.fetch.mockRejectedValue(new Error("Provider unavailable"));
    mocks.updateMany.mockRejectedValue(new Error("Lease cleanup unavailable"));
    await expect(searchAgencyWeb(input, "fixture-user")).rejects.toMatchObject({ status: 503, message: "The search provider is unavailable. Please try again later." });
    expect(mocks.deleteMany).toHaveBeenCalledTimes(2);
  });
});
