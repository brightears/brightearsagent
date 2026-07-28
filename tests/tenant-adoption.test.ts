import { beforeEach, describe, expect, it, vi } from "vitest";

// Tenant resolution on sign-in (apex cutover, 2026-07-27). The ladder is
// clerkUserId → email → provision-new, and the middle rung is the one that
// matters at a Clerk instance swap: dev and production are separate user
// pools, so every id written before the pk_live swap is permanently stale. If
// the email rung does not catch that, the owner signs in on the live domain
// and gets a brand-new empty tenant while their real business sits orphaned.

// lib/tenant reads these once at module load, so they must be set before the
// import below — hence vi.hoisted, which runs ahead of it.
vi.hoisted(() => {
  process.env.CLERK_SECRET_KEY = "sk_test_tenant_adoption";
  delete process.env.DEV_TENANT_SLUG;
});

const mockDb = vi.hoisted(() => ({
  business: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  member: { findFirst: vi.fn(), update: vi.fn() },
}));
const mockAuth = vi.hoisted(() => vi.fn());
const mockCurrentUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mockAuth, currentUser: mockCurrentUser }));

import { getCurrentBusiness } from "@/lib/tenant";

const NEW_ID = "user_prod_new";
const STALE_ID = "user_dev_stale";
const EMAIL = "owner@example.com";
const realBusiness = { id: "biz_1", slug: "norbert", plan: "STARTER" };

/** The member row as it exists after the instance swap: still bound to an id
 *  the production instance has never issued. */
const staleRow = { id: "mem_1", email: EMAIL, clerkUserId: STALE_ID, business: realBusiness };
const openRow = { id: "mem_2", email: EMAIL, clerkUserId: null, business: realBusiness };

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ userId: NEW_ID });
  mockCurrentUser.mockResolvedValue({
    primaryEmailAddress: { emailAddress: EMAIL },
    firstName: "Owner",
    lastName: null,
  });
  mockDb.member.update.mockResolvedValue({});
});

describe("getCurrentBusiness — adoption ladder", () => {
  it("returns the business bound to the current Clerk id without touching email", async () => {
    mockDb.member.findFirst.mockResolvedValueOnce({ business: realBusiness });
    await expect(getCurrentBusiness()).resolves.toBe(realBusiness);
    expect(mockCurrentUser).not.toHaveBeenCalled();
    expect(mockDb.business.create).not.toHaveBeenCalled();
  });

  it("adopts an unclaimed invite row and writes the id back", async () => {
    mockDb.member.findFirst
      .mockResolvedValueOnce(null) // by clerkUserId
      .mockResolvedValueOnce(openRow); // by email, clerkUserId=null
    await expect(getCurrentBusiness()).resolves.toBe(realBusiness);
    expect(mockDb.member.update).toHaveBeenCalledWith({
      where: { id: "mem_2" },
      data: { clerkUserId: NEW_ID },
    });
  });

  // The regression this file exists for.
  it("re-claims a row still bound to a stale id instead of provisioning a new tenant", async () => {
    mockDb.member.findFirst
      .mockResolvedValueOnce(null) // by clerkUserId — misses forever after the swap
      .mockResolvedValueOnce(null) // no unclaimed row
      .mockResolvedValueOnce(staleRow); // bound to the dev-instance id
    await expect(getCurrentBusiness()).resolves.toBe(realBusiness);
    expect(mockDb.business.create).not.toHaveBeenCalled();
    expect(mockDb.member.update).toHaveBeenCalledWith({
      where: { id: "mem_1" },
      data: { clerkUserId: NEW_ID },
    });
  });

  it("prefers a genuine invite over a stale binding", async () => {
    mockDb.member.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(openRow);
    await getCurrentBusiness();
    // Third query never runs — the unclaimed row short-circuits it.
    expect(mockDb.member.findFirst).toHaveBeenCalledTimes(2);
  });

  it("provisions for a genuinely new signup ONLY where provisioning is asked for", async () => {
    mockDb.member.findFirst.mockResolvedValue(null);
    mockDb.business.findUnique.mockResolvedValue(null); // slug is free
    mockDb.business.create.mockResolvedValue({ id: "biz_new", slug: "owner" });
    await expect(getCurrentBusiness({ provision: true })).resolves.toEqual({ id: "biz_new", slug: "owner" });
    expect(mockDb.business.create).toHaveBeenCalledOnce();
    expect(mockDb.member.update).not.toHaveBeenCalled();
  });

  // The regression that produced three tenants for one person.
  it("refuses to invent a tenant by default, and says whose account it was", async () => {
    mockDb.member.findFirst.mockResolvedValue(null);
    await expect(getCurrentBusiness()).rejects.toMatchObject({
      name: "NoTenantError",
      email: EMAIL,
    });
    expect(mockDb.business.create).not.toHaveBeenCalled();
  });

  it("still prefers an existing membership over provisioning, even when allowed to provision", async () => {
    mockDb.member.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(openRow);
    await expect(getCurrentBusiness({ provision: true })).resolves.toBe(realBusiness);
    expect(mockDb.business.create).not.toHaveBeenCalled();
  });

  it("refuses to guess a tenant for a session with no email", async () => {
    mockDb.member.findFirst.mockResolvedValueOnce(null);
    mockCurrentUser.mockResolvedValue({ primaryEmailAddress: null });
    await expect(getCurrentBusiness()).rejects.toThrow(/no email/i);
    expect(mockDb.business.create).not.toHaveBeenCalled();
  });
});
