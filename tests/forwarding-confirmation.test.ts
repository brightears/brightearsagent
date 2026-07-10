import { describe, expect, it } from "vitest";
import { detectForwardingConfirmation } from "@/lib/inbound/forwarding-confirmation";
import type { InboundEmail } from "@/lib/inbound/types";

// The Gmail forwarding-verification email — the step self-serve activation
// used to dead-end on (the LLM fallback read it as an automated notice and
// dropped it). Detection must be exact-sender only: a lookalike domain must
// never be able to plant an "approve forwarding" link in the artist's wizard.

const base: InboundEmail = {
  from: "forwarding-noreply@google.com",
  to: "leads@demo-dj-co.in.brightears.io",
  subject: "Gmail Forwarding Confirmation - Receive Mail from norbert@gmail.com (#728394651)",
  textBody: [
    "norbert@gmail.com has requested to automatically forward mail to your email address",
    "leads@demo-dj-co.in.brightears.io.",
    "Confirmation code: 728394651",
    "",
    "To allow norbert@gmail.com to automatically forward mail to your address, please click the link below to confirm the request:",
    "",
    "https://mail-settings.google.com/mail/vf-%5BANGjdJ_example_token%5D-abc123",
    "",
    "If you click the link and it appears to be broken, please copy and paste it into a new browser window.",
  ].join("\n"),
  providerMessageId: "gmail-fwd-1",
};

describe("detectForwardingConfirmation", () => {
  it("catches Gmail's verification email with link and code", () => {
    const hit = detectForwardingConfirmation(base);
    expect(hit).not.toBeNull();
    expect(hit!.provider).toBe("gmail");
    expect(hit!.url).toBe("https://mail-settings.google.com/mail/vf-%5BANGjdJ_example_token%5D-abc123");
    expect(hit!.code).toBe("728394651");
  });

  it("accepts the display-name sender form", () => {
    const hit = detectForwardingConfirmation({
      ...base,
      from: "Gmail Team <forwarding-noreply@google.com>",
    });
    expect(hit).not.toBeNull();
    expect(hit!.code).toBe("728394651");
  });

  it("degrades gracefully when the body has a code but no link", () => {
    const hit = detectForwardingConfirmation({
      ...base,
      textBody: "Confirmation code: 728394651\nOpen Gmail settings to approve.",
    });
    expect(hit).not.toBeNull();
    expect(hit!.url).toBeNull();
    expect(hit!.code).toBe("728394651");
  });

  it("ignores a normal client inquiry", () => {
    expect(
      detectForwardingConfirmation({
        ...base,
        from: "sarah@example.com",
        subject: "Wedding DJ inquiry — June 14",
        textBody: "Hi! Are you free June 14 at the Riverside Barn?",
      }),
    ).toBeNull();
  });

  it("never matches lookalike sender domains (spoof guard)", () => {
    for (const from of [
      "forwarding-noreply@google.com.evil.com",
      "Gmail <forwarding-noreply@google.com.evil.com>",
      "evil-forwarding-noreply@google.com.attacker.io",
      "notforwarding-noreply@google.com",
    ]) {
      expect(detectForwardingConfirmation({ ...base, from })).toBeNull();
    }
  });
});
