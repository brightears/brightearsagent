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
  mocks.redirect.mockImplementation((target: string) => { throw new Error("REDIRECT:" + target); });
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

describe("closed assistant subscription enrollment", () => {
  it("blocks a new subscription before price, customer or checkout work", async () => {
    await expect(startCheckout("STARTER")).rejects.toThrow("REDIRECT:/assistant");
    expect(mocks.priceList).not.toHaveBeenCalled();
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
  });

  it("does not convert an allowlisted beta into a recurring subscription", async () => {
    vi.stubEnv("BETA_COMP_EMAILS", "artist@example.com");
    await expect(startCheckout("STARTER")).rejects.toThrow("REDIRECT:/assistant");
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
  });
});
