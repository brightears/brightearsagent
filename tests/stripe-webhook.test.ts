import { beforeEach, describe, expect, it, vi } from "vitest";

// Unit tests for the Stripe subscription-lifecycle application (lib/billing/
// webhook.ts) — added with the Stripe audit hardening (2026-06-16). db + the
// stripe() client are mocked; planForLookupKey/PLAN_LOOKUP_KEYS stay REAL.

const mockDb = vi.hoisted(() => ({
  business: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
}));
const mockStripe = vi.hoisted(() => ({ subscriptions: { retrieve: vi.fn() } }));
const mockActivationScan = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/billing/stripe", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/billing/stripe")>();
  return { ...actual, stripe: () => mockStripe, stripeEnabled: true };
});
vi.mock("@/lib/discovery/activation", () => ({ scheduleActivationScan: mockActivationScan }));

import { applyStripeEvent } from "@/lib/billing/webhook";

const PRO = "brightears_pro_monthly";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const checkoutEvent = (businessId: string | null, subId: string | null, customer = "cus_1"): any => ({
  id: `evt_co_${subId}`,
  type: "checkout.session.completed",
  data: { object: { client_reference_id: businessId, mode: "subscription", subscription: subId, customer } },
});

const subEvent = (
  kind: "updated" | "deleted",
  opts: { id: string; status?: string; lookup?: string; businessId?: string; customer?: string },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any => ({
  id: `evt_${kind}_${opts.id}`,
  type: `customer.subscription.${kind}`,
  data: {
    object: {
      id: opts.id,
      status: opts.status ?? "active",
      items: { data: [{ price: { lookup_key: opts.lookup ?? PRO } }] },
      metadata: opts.businessId ? { businessId: opts.businessId } : {},
      customer: opts.customer ?? "cus_1",
    },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockDb.business.update.mockResolvedValue({});
  mockDb.business.findUnique.mockResolvedValue(null);
  mockDb.business.findFirst.mockResolvedValue(null);
});

describe("checkout.session.completed", () => {
  it("S2: does NOT activate a plan for a non-live subscription (incomplete)", async () => {
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      status: "incomplete",
      items: { data: [{ price: { lookup_key: PRO } }] },
      customer: "cus_1",
    });
    const res = await applyStripeEvent(checkoutEvent("biz1", "sub_1"));
    expect(res.applied).toBe(false);
    expect(mockDb.business.update).not.toHaveBeenCalled();
  });

  it("activates the plan for a live subscription (covers the $0 promo-code path = active)", async () => {
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      status: "active",
      items: { data: [{ price: { lookup_key: PRO } }] },
      customer: "cus_1",
    });
    const res = await applyStripeEvent(checkoutEvent("biz1", "sub_1"));
    expect(res.applied).toBe(true);
    expect(mockDb.business.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "biz1" },
        data: expect.objectContaining({ plan: "PRO", stripeSubscriptionId: "sub_1" }),
      }),
    );
    // Day one is the trial: activation kicks an immediate (post-response) hunt.
    expect(mockActivationScan).toHaveBeenCalledWith("biz1", { force: true });
  });

  it("S6: does NOT activate on an unmapped lookup_key (paid, off-catalog price)", async () => {
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      status: "active",
      items: { data: [{ price: { lookup_key: "brightears_annual_oops" } }] },
      customer: "cus_1",
    });
    const res = await applyStripeEvent(checkoutEvent("biz1", "sub_1"));
    expect(res.applied).toBe(false);
    expect(mockDb.business.update).not.toHaveBeenCalled();
  });

  it("ignores a non-subscription / business-less session", async () => {
    const res = await applyStripeEvent(checkoutEvent(null, "sub_1"));
    expect(res).toEqual({ applied: false, retry: false });
    expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });
});

describe("customer.subscription.updated", () => {
  it("S3: resolves the tenant by metadata.businessId even when the stored sub id differs (re-subscribe)", async () => {
    mockDb.business.findUnique.mockImplementation(({ where }: { where: { id?: string } }) =>
      Promise.resolve(where.id === "biz1" ? { id: "biz1", plan: "STARTER", stripeSubscriptionId: "old_sub" } : null),
    );
    const res = await applyStripeEvent(subEvent("updated", { id: "new_sub", status: "active", businessId: "biz1" }));
    expect(res.applied).toBe(true);
    expect(mockDb.business.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "biz1" },
        data: expect.objectContaining({ plan: "PRO", stripeSubscriptionId: "new_sub" }),
      }),
    );
    // Already live before the event (STARTER) — a plan switch must NOT re-burn
    // the scan budget; only a paused→live transition hunts immediately.
    expect(mockActivationScan).not.toHaveBeenCalled();
  });

  it("kicks an immediate hunt on a paused→live transition (re-activation)", async () => {
    mockDb.business.findUnique.mockResolvedValue({
      id: "biz1",
      plan: "TRIAL",
      stripeSubscriptionId: null,
    });
    const res = await applyStripeEvent(subEvent("updated", { id: "sub_9", status: "active", businessId: "biz1" }));
    expect(res.applied).toBe(true);
    expect(mockActivationScan).toHaveBeenCalledWith("biz1", { force: true });
  });

  it("S4: pauses (plan→TRIAL) on a non-live status (canceled)", async () => {
    mockDb.business.findUnique.mockResolvedValue({ id: "biz1", plan: "PRO", stripeSubscriptionId: "sub_1" });
    await applyStripeEvent(subEvent("updated", { id: "sub_1", status: "canceled", businessId: "biz1" }));
    expect(mockDb.business.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ plan: "TRIAL", stripeSubscriptionId: null }) }),
    );
  });

  it("keeps the agent live during past_due (dunning grace)", async () => {
    mockDb.business.findUnique.mockResolvedValue({ id: "biz1", plan: "PRO", stripeSubscriptionId: "sub_1" });
    await applyStripeEvent(subEvent("updated", { id: "sub_1", status: "past_due", businessId: "biz1" }));
    expect(mockDb.business.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ plan: "PRO" }) }),
    );
  });

  it("S5: signals RETRY (don't record) when an OURS event can't resolve its tenant", async () => {
    const res = await applyStripeEvent(subEvent("updated", { id: "sub_x", status: "active", businessId: "ghost" }));
    expect(res).toEqual({ applied: false, retry: true });
    expect(mockDb.business.update).not.toHaveBeenCalled();
  });
});

describe("customer.subscription.deleted", () => {
  it("pauses when the deleted sub is the tenant's current one", async () => {
    mockDb.business.findUnique.mockResolvedValue({ id: "biz1", plan: "PRO", stripeSubscriptionId: "sub_1" });
    await applyStripeEvent(subEvent("deleted", { id: "sub_1", businessId: "biz1" }));
    expect(mockDb.business.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ plan: "TRIAL", stripeSubscriptionId: null }) }),
    );
  });

  it("out-of-order guard: ignores deletion of an OLD sub while a newer one is current", async () => {
    mockDb.business.findUnique.mockResolvedValue({ id: "biz1", plan: "PRO", stripeSubscriptionId: "current_sub" });
    const res = await applyStripeEvent(subEvent("deleted", { id: "old_sub", businessId: "biz1" }));
    expect(res.applied).toBe(false);
    expect(mockDb.business.update).not.toHaveBeenCalled();
  });
});
