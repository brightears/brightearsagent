import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  getCurrentBusiness: vi.fn(),
  sessionCreate: vi.fn(),
  priceList: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/tenant", () => ({ getCurrentBusiness: mocks.getCurrentBusiness }));
vi.mock("@/lib/db", () => ({ db: { business: { update: vi.fn() } } }));
vi.mock("@/lib/app-url", () => ({ appUrl: () => "https://brightears.io" }));
vi.mock("@/lib/billing/stripe", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/billing/stripe")>();
  return {
    ...actual,
    stripeEnabled: true,
    stripe: () => ({
      prices: { list: mocks.priceList },
      checkout: { sessions: { create: mocks.sessionCreate } },
    }),
  };
});

import { startCheckout } from "@/app/actions/billing";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentBusiness.mockResolvedValue({
    id: "biz_beta",
    ownerEmail: "artist@example.com",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
  });
  mocks.priceList.mockResolvedValue({ data: [{ id: "price_starter" }] });
  mocks.sessionCreate.mockResolvedValue({ url: "https://checkout.stripe.test/session" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("subscription checkout", () => {
  it("does not expose any promotion-code path", async () => {
    await startCheckout("STARTER");

    const params = mocks.sessionCreate.mock.calls[0]?.[0];
    expect(params).not.toHaveProperty("allow_promotion_codes");
    expect(params).not.toHaveProperty("discounts");
  });

  it("keeps an approved beta email out of Stripe discounts and recurring beta metadata", async () => {
    vi.stubEnv("BETA_COMP_EMAILS", "artist@example.com");

    await startCheckout("STARTER");

    expect(mocks.sessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { businessId: "biz_beta" },
        subscription_data: { metadata: { businessId: "biz_beta" } },
      }),
    );
    const params = mocks.sessionCreate.mock.calls[0]?.[0];
    expect(params).not.toHaveProperty("discounts");
    expect(params.metadata).not.toHaveProperty("betaCohort");
  });
});
