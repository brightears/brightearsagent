import { describe, it, expect } from "vitest";
import { resolveAttachments } from "@/lib/agent/attach-policy";

describe("resolveAttachments", () => {
  it("manual approve uses the owner's explicit choices (ignores intent + toggles)", () => {
    expect(
      resolveAttachments({
        autoAttach: false,
        attachPressKit: true,
        attachQuote: false,
        autoAttachProfile: false,
        autoAttachQuote: false,
        wantsProfile: false,
        wantsQuote: true,
      }),
    ).toEqual({ pressKit: true, quote: false });
  });

  it("auto-send attaches ONLY when the toggle is on AND the client asked", () => {
    expect(
      resolveAttachments({
        autoAttach: true,
        autoAttachProfile: true,
        autoAttachQuote: true,
        wantsProfile: true,
        wantsQuote: true,
      }),
    ).toEqual({ pressKit: true, quote: true });
  });

  it("auto-send: toggle on but client didn't ask → no attachment", () => {
    expect(
      resolveAttachments({
        autoAttach: true,
        autoAttachProfile: true,
        autoAttachQuote: true,
        wantsProfile: false,
        wantsQuote: false,
      }),
    ).toEqual({ pressKit: false, quote: false });
  });

  it("auto-send: client asked but toggle off → no attachment (a quote is opt-in)", () => {
    expect(
      resolveAttachments({
        autoAttach: true,
        autoAttachProfile: false,
        autoAttachQuote: false,
        wantsProfile: true,
        wantsQuote: true,
      }),
    ).toEqual({ pressKit: false, quote: false });
  });

  it("auto-send is independent of any explicit manual flags", () => {
    expect(
      resolveAttachments({
        autoAttach: true,
        attachPressKit: true, // ignored in auto mode
        attachQuote: true,
        autoAttachProfile: true,
        autoAttachQuote: false,
        wantsProfile: true,
        wantsQuote: true,
      }),
    ).toEqual({ pressKit: true, quote: false });
  });
});
