import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  globalOutreachSuppression: { findUnique: vi.fn() },
  outreachSuppression: { findUnique: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));

import {
  globalSuppressionUpsertArgs,
  normalizeOutreachEmail,
  outreachSuppressionScope,
} from "@/lib/outreach/suppression";

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.globalOutreachSuppression.findUnique.mockResolvedValue(null);
  mockDb.outreachSuppression.findUnique.mockResolvedValue(null);
});

describe("product-wide outreach suppression", () => {
  it("normalizes once and blocks the same recipient across tenants", async () => {
    mockDb.globalOutreachSuppression.findUnique.mockResolvedValue({ id: "global-1" });

    expect(await outreachSuppressionScope("business-a", " STOP@Example.COM ")).toBe(
      "global",
    );
    expect(await outreachSuppressionScope("business-b", "stop@example.com")).toBe(
      "global",
    );
    expect(normalizeOutreachEmail(" STOP@Example.COM ")).toBe("stop@example.com");
    expect(mockDb.globalOutreachSuppression.findUnique).toHaveBeenNthCalledWith(1, {
      where: { email: "stop@example.com" },
      select: { id: true },
    });
    expect(mockDb.outreachSuppression.findUnique).not.toHaveBeenCalled();
  });

  it("keeps an owner/local stop tenant-scoped", async () => {
    mockDb.outreachSuppression.findUnique
      .mockResolvedValueOnce({ id: "tenant-1" })
      .mockResolvedValueOnce(null);

    expect(await outreachSuppressionScope("business-a", "stop@example.com")).toBe(
      "tenant",
    );
    expect(await outreachSuppressionScope("business-b", "stop@example.com")).toBeNull();
  });

  it("allows recipient-authored escalation but never downgrades it with a bounce", () => {
    expect(
      globalSuppressionUpsertArgs({
        email: "Stop@Example.com",
        reason: "spam-complaint",
        business: { id: "business-b" },
      }).update,
    ).toEqual({
      reason: "spam-complaint",
      sourceBusinessId: "business-b",
    });
    expect(
      globalSuppressionUpsertArgs({
        email: "Stop@Example.com",
        reason: "hard-bounce",
        business: { id: "business-a" },
      }).update,
    ).toEqual({});
  });
});

describe("global suppression migration semantics", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const migration = readFileSync(
    "prisma/migrations/20260816110000_global_outreach_suppression/migration.sql",
    "utf8",
  );

  it("has no Business relation or cascade, so a tenant deletion cannot remove it", () => {
    const model = schema.match(/model GlobalOutreachSuppression \{[\s\S]*?\n\}/)?.[0];
    expect(model).toBeTruthy();
    expect(model).toContain("sourceBusinessId");
    expect(model).not.toContain("@relation");
    expect(migration).not.toContain("FOREIGN KEY");
    expect(migration).not.toContain("ON DELETE CASCADE");
  });

  it("enforces normalized unique email and backfills only explicit opt-out/C&D", () => {
    expect(migration).toContain('"GlobalOutreachSuppression_email_key"');
    expect(migration).toContain('CHECK ("email" = lower(btrim("email"))');
    expect(migration).toContain(
      `WHERE os."reason" IN ('unsubscribe', 'cease-and-desist')`,
    );
    expect(migration).not.toContain("owner-skip:");
    expect(migration).not.toMatch(/WHERE[\s\S]*hard-bounce/);
  });
});
