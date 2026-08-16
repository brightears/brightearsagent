import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  getCurrentBusiness: vi.fn(),
  sessionCreate: vi.fn(),
  priceList: vi.fn(),
  promoList: vi.fn(),
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
      promotionCodes: { list: mocks.promoList },
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

describe("beta checkout", () => {
  it("does not expose a generic promotion-code box outside the invite allowlist", async () => {
    await startCheckout("STARTER");

    const params = mocks.sessionCreate.mock.calls[0]?.[0];
    expect(params).not.toHaveProperty("allow_promotion_codes");
    expect(params).not.toHaveProperty("discounts");
    expect(mocks.promoList).not.toHaveBeenCalled();
  });

  it("fails closed when an invited tester's promotion is unavailable", async () => {
    vi.stubEnv("BETA_COMP_EMAILS", "artist@example.com");
    vi.stubEnv("BETA_PROMO_CODE", "BETA_TEST_CODE");
    mocks.promoList.mockResolvedValue({ data: [] });

    await expect(startCheckout("STARTER")).rejects.toThrow("You have not been charged");
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
  });

  it("tags both Checkout and Subscription when the invited comp is applied", async () => {
    vi.stubEnv("BETA_COMP_EMAILS", "artist@example.com");
    vi.stubEnv("BETA_PROMO_CODE", "BETA_TEST_CODE");
    mocks.promoList.mockResolvedValue({ data: [{ id: "promo_beta" }] });

    await startCheckout("STARTER");

    expect(mocks.sessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        discounts: [{ promotion_code: "promo_beta" }],
        metadata: { businessId: "biz_beta", betaCohort: "true" },
        subscription_data: {
          metadata: { businessId: "biz_beta", betaCohort: "true" },
        },
      }),
    );
  });
});
