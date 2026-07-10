import { beforeEach, describe, expect, it, vi } from "vitest";

// Roster CRUD (P13.1/13.4): rosterCap from plan-features (the SSOT) is
// enforced at SAVE — adding past the cap fails honestly, reactivation
// counts against the cap too (no cap-dodging via toggling), and everything
// is tenant-scoped.

const mockDb = vi.hoisted(() => ({
  performer: { count: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
}));
const mockBiz = vi.hoisted(() => ({ current: { id: "biz1", plan: "STARTER", performerKind: "DJ" } }));
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tenant", () => ({ getCurrentBusiness: vi.fn(async () => mockBiz.current) }));

import { addPerformer, setPerformerActive, updatePerformer } from "@/app/actions/performers";

const fd = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

beforeEach(() => {
  vi.clearAllMocks();
  mockBiz.current = { id: "biz1", plan: "STARTER", performerKind: "DJ" };
  mockDb.performer.count.mockResolvedValue(0);
  mockDb.performer.create.mockResolvedValue({ id: "p1" });
  mockDb.performer.updateMany.mockResolvedValue({ count: 1 });
});

describe("addPerformer", () => {
  it("creates within the cap, defaulting kind to the business's own", async () => {
    const r = await addPerformer(fd({ name: "  Nok  " }));
    expect(r.ok).toBe(true);
    expect(mockDb.performer.create).toHaveBeenCalledWith({
      data: { businessId: "biz1", name: "Nok", kind: "DJ" },
    });
  });

  it("Starter/Pro stop at 1 active performer; Studio allows a roster", async () => {
    mockDb.performer.count.mockResolvedValue(1);
    const starter = await addPerformer(fd({ name: "Mai", kind: "SINGER" }));
    expect(starter.ok).toBe(false);
    expect(starter.error).toContain("Studio");
    expect(mockDb.performer.create).not.toHaveBeenCalled();

    mockBiz.current = { id: "biz1", plan: "STUDIO", performerKind: "DJ" };
    mockDb.performer.count.mockResolvedValue(4);
    const studio = await addPerformer(fd({ name: "Mai", kind: "SINGER" }));
    expect(studio.ok).toBe(true);
  });

  it("rejects a blank name and an unknown kind falls back to the business kind", async () => {
    expect((await addPerformer(fd({ name: "   " }))).ok).toBe(false);
    await addPerformer(fd({ name: "Mai", kind: "NOT_A_KIND" }));
    expect(mockDb.performer.create).toHaveBeenCalledWith({
      data: { businessId: "biz1", name: "Mai", kind: "DJ" },
    });
  });
});

describe("setPerformerActive / updatePerformer", () => {
  it("reactivation re-checks the cap (no cap-dodging via toggling)", async () => {
    mockDb.performer.count.mockResolvedValue(1);
    const r = await setPerformerActive("p2", true);
    expect(r.ok).toBe(false);
    expect(mockDb.performer.updateMany).not.toHaveBeenCalled();
    // Deactivation never needs cap room.
    const off = await setPerformerActive("p2", false);
    expect(off.ok).toBe(true);
  });

  it("updates are tenant-scoped (count 0 = not yours = error)", async () => {
    mockDb.performer.updateMany.mockResolvedValue({ count: 0 });
    const r = await updatePerformer("someone-elses", fd({ name: "X" }));
    expect(r.ok).toBe(false);
  });
});
