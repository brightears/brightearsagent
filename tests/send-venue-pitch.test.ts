import { beforeEach, describe, expect, it, vi } from "vitest";

// Phase 10.5 — sendVenuePitch action guards. The legal heart of the phase:
// CONSENT/STRICT jurisdictions must NEVER auto-send (handoff-only), suppression
// is re-checked at send, the daily SEND cap is enforced, and a re-send of an
// already-SENT pitch is an idempotent no-op. sendGmail is mocked so no real
// Gmail call happens; the DB is mocked the way venues-actions.test.ts does.

const mockDb = vi.hoisted(() => ({
  venuePitch: { findFirst: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
  mailboxConnection: { findUnique: vi.fn() },
  globalOutreachSuppression: { findUnique: vi.fn() },
  outreachSuppression: { findUnique: vi.fn() },
  venue: { updateMany: vi.fn() },
  $transaction: vi.fn(
    async (
      input: unknown[] | ((tx: typeof mockDb) => Promise<unknown>),
    ) =>
      typeof input === "function"
        ? input(mockDb)
        : Promise.all(input as Promise<unknown>[]),
  ),
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const getCurrentBusinessMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/tenant", () => ({
  getCurrentBusiness: getCurrentBusinessMock,
}));
type GmailSendInput = {
  toEmail: string;
  toName?: string;
  subject: string;
  body: string;
  replyToEmail?: string;
};
const sendGmail = vi.hoisted(() =>
  vi.fn(async (_businessId: string, _input: GmailSendInput) => ({ messageId: "gmail-123" })),
);
vi.mock("@/lib/outbound/gmail", () => ({
  sendGmail,
  // Re-export a MailboxError shape the action can instanceof-check.
  MailboxError: class MailboxError extends Error {},
}));

import {
  recordManualVenuePitchSend,
  sendVenuePitch,
} from "@/app/actions/venues";

const tenantBusiness = {
  id: "biz1",
  name: "Sapphire Sounds",
  slug: "sapphire-sounds",
  ownerName: "Maya Reyes",
  performerKind: "DJ",
  ownerEmail: "maya@login.com",
  postalAddress: "12 Deansgate, Manchester M3 2BW, United Kingdom",
  replyToEmail: null,
  serviceCities: ["Manchester"],
  headline: "Open-format DJ",
  bio: "Fifteen years behind the decks.",
  genres: ["open format"],
  eventTypes: ["club nights"],
  gigTypes: ["one-off"],
  riderNotes: null,
  reviewQuotes: [],
  notableVenues: [],
  timezone: "Europe/London",
};

const standardVenue = {
  id: "v1",
  businessId: "biz1",
  name: "Velvet Lounge",
  country: "US", // STANDARD
  bookingEmail: "events@velvet.co",
  bookingContactName: "Sam",
  status: "PITCH_DRAFTED",
  city: "Manchester",
  kind: "BAR",
  signals: [{ summary: "Runs Friday DJ sets" }],
  entertainmentEvidence: ["Runs Friday DJ sets"],
  fitReasons: ["Open-format room"],
  travelWindow: null,
};

function approvedPitch(over: Record<string, unknown> = {}) {
  return {
    id: "p1",
    businessId: "biz1",
    status: "APPROVED",
    subject: "DJ for your Friday rotation",
    body: `Saw you run Friday DJ sets and wanted to introduce myself properly. I am Maya, an open-format DJ with fifteen years behind the decks, building sets from early drinks into a full room without forcing the pace. That flexible arc is a natural fit for a bar crowd that changes through the evening.\n\nHere's a one-page look at Sapphire Sounds: http://localhost:3000/epk/sapphire-sounds\n\nWould you consider a guest slot when it suits your calendar?\n\nMaya — Sapphire Sounds`,
    editedSubject: null,
    editedBody: null,
    temperature: "WARM",
    language: "en",
    jurisdictionMode: "STANDARD",
    venue: standardVenue,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentBusinessMock.mockResolvedValue(tenantBusiness);
  mockDb.venuePitch.findFirst.mockResolvedValue(approvedPitch());
  mockDb.mailboxConnection.findUnique.mockResolvedValue({ status: "CONNECTED" });
  mockDb.globalOutreachSuppression.findUnique.mockResolvedValue(null);
  mockDb.outreachSuppression.findUnique.mockResolvedValue(null);
  mockDb.venuePitch.count.mockResolvedValue(0);
  mockDb.venuePitch.updateMany.mockResolvedValue({ count: 1 });
  mockDb.venue.updateMany.mockResolvedValue({ count: 1 });
});

describe("sendVenuePitch — happy path", () => {
  it("sends a STANDARD approved pitch and marks it SENT + venue PITCHED", async () => {
    const result = await sendVenuePitch("p1");
    expect(result).toEqual({ ok: true });
    expect(sendGmail).toHaveBeenCalledOnce();
    // (Phase 10.5 hardening) FIRST updateMany is the atomic CLAIM
    // APPROVED → SENDING, written BEFORE the network send.
    const claim = mockDb.venuePitch.updateMany.mock.calls[0][0];
    expect(claim.where.status).toBe("APPROVED");
    expect(claim.data.status).toBe("SENDING");
    // After a successful send the pitch flips SENDING → SENT with sentAt +
    // providerMessageId (second updateMany call).
    const pitchUpdate = mockDb.venuePitch.updateMany.mock.calls[1][0];
    expect(pitchUpdate.where.status).toBe("SENDING");
    expect(pitchUpdate.data.status).toBe("SENT");
    expect(pitchUpdate.data.providerMessageId).toBe("gmail-123");
    expect(pitchUpdate.data.sentAt).toBeInstanceOf(Date);
    // Venue PITCH_DRAFTED → PITCHED.
    const venueUpdate = mockDb.venue.updateMany.mock.calls[0][0];
    expect(venueUpdate.data.status).toBe("PITCHED");
  });

  it("appends the jurisdiction footer at send (not stored on the body)", async () => {
    await sendVenuePitch("p1");
    const sent = sendGmail.mock.calls[0][1];
    // Footer carries the identity + opt-out line for STANDARD.
    expect(sent.body).toContain("Sapphire Sounds · Manchester");
    expect(sent.body).toContain("just reply and tell me");
    expect(sent.body).toContain("Privacy: https://brightears.io/privacy");
    expect(sent.toEmail).toBe("events@velvet.co");
    expect(sent.replyToEmail).toMatch(/^leads@.+\.in\.brightears\.io$/); // reply capture (P8.3): venue replies route into the pipeline
  });
});

describe("sendVenuePitch — jurisdiction gate (the legal handoff guarantee)", () => {
  it("REFUSES a CONSENT jurisdiction (Canada) — never calls sendGmail", async () => {
    mockDb.venuePitch.findFirst.mockResolvedValue(
      approvedPitch({ venue: { ...standardVenue, country: "CA" } }),
    );
    const result = await sendVenuePitch("p1");
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/Canada|CASL/i),
    });
    expect(sendGmail).not.toHaveBeenCalled();
    expect(mockDb.venuePitch.updateMany).not.toHaveBeenCalled();
  });

  it("REFUSES a STRICT jurisdiction (Germany) — never calls sendGmail", async () => {
    mockDb.venuePitch.findFirst.mockResolvedValue(
      approvedPitch({ venue: { ...standardVenue, country: "DE" } }),
    );
    const result = await sendVenuePitch("p1");
    expect(result.ok).toBe(false);
    expect(sendGmail).not.toHaveBeenCalled();
  });

  it("REFUSES United Kingdom auto-send while recipient legal form is unknown", async () => {
    mockDb.venuePitch.findFirst.mockResolvedValue(
      approvedPitch({ venue: { ...standardVenue, country: "GB" } }),
    );
    const result = await sendVenuePitch("p1");
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/United Kingdom|recipient type/i),
    });
    expect(sendGmail).not.toHaveBeenCalled();
  });

  it("REFUSES an unknown country (fail-closed CONSENT)", async () => {
    mockDb.venuePitch.findFirst.mockResolvedValue(
      approvedPitch({ venue: { ...standardVenue, country: "ZZ" } }),
    );
    const result = await sendVenuePitch("p1");
    expect(result.ok).toBe(false);
    expect(sendGmail).not.toHaveBeenCalled();
  });
});

describe("manual-review venue pitch handoff", () => {
  it("never auto-sends a non-English pitch even in a STANDARD jurisdiction", async () => {
    mockDb.venuePitch.findFirst.mockResolvedValue(
      approvedPitch({ language: "de" }),
    );

    expect(await sendVenuePitch("p1")).toEqual({
      ok: false,
      error: "Non-English pitches require your manual review and send",
    });
    expect(sendGmail).not.toHaveBeenCalled();
  });

  it("atomically records a consent-first manual send so replies can match the venue", async () => {
    mockDb.venuePitch.findFirst.mockResolvedValue(
      approvedPitch({
        jurisdictionMode: "CONSENT",
        venue: { ...standardVenue, country: "CA" },
      }),
    );

    expect(await recordManualVenuePitchSend("p1", true)).toEqual({ ok: true });
    expect(sendGmail).not.toHaveBeenCalled();
    expect(mockDb.venuePitch.updateMany).toHaveBeenCalledWith({
      where: {
        id: "p1",
        businessId: "biz1",
        status: "APPROVED",
        venue: { status: "PITCH_DRAFTED" },
      },
      data: { status: "SENT", sentAt: expect.any(Date) },
    });
    expect(mockDb.venue.updateMany).toHaveBeenCalledWith({
      where: { id: "v1", businessId: "biz1", status: "PITCH_DRAFTED" },
      data: { status: "PITCHED", pitchedAt: expect.any(Date) },
    });
  });

  it("requires explicit lawful-basis confirmation in consent-first jurisdictions", async () => {
    mockDb.venuePitch.findFirst.mockResolvedValue(
      approvedPitch({
        jurisdictionMode: "CONSENT",
        venue: { ...standardVenue, country: "CA" },
      }),
    );

    expect(await recordManualVenuePitchSend("p1", false)).toEqual({
      ok: false,
      error: "Confirm that you have consent or another lawful basis before recording this send",
    });
    expect(mockDb.venuePitch.updateMany).not.toHaveBeenCalled();
  });

  it("blocks manual recording without the required postal address", async () => {
    getCurrentBusinessMock.mockResolvedValueOnce({
      ...tenantBusiness,
      postalAddress: null,
    });
    mockDb.venuePitch.findFirst.mockResolvedValue(
      approvedPitch({
        jurisdictionMode: "CONSENT",
        venue: { ...standardVenue, country: "CA" },
      }),
    );

    expect(await recordManualVenuePitchSend("p1", true)).toEqual({
      ok: false,
      error: "Add your business mailing address in Settings before copying or sending venue outreach",
    });
    expect(mockDb.venuePitch.findFirst).not.toHaveBeenCalled();
  });

  it("re-checks suppression before recording a manual send", async () => {
    mockDb.venuePitch.findFirst.mockResolvedValue(
      approvedPitch({
        jurisdictionMode: "CONSENT",
        venue: { ...standardVenue, country: "CA" },
      }),
    );
    mockDb.globalOutreachSuppression.findUnique.mockResolvedValue({ id: "global-1" });

    expect(await recordManualVenuePitchSend("p1", true)).toEqual({
      ok: false,
      error: "This contact is on your do-not-contact list",
    });
    expect(mockDb.venuePitch.updateMany).not.toHaveBeenCalled();
  });
});

describe("sendVenuePitch — other guards", () => {
  it("requires APPROVED status (PENDING is refused)", async () => {
    mockDb.venuePitch.findFirst.mockResolvedValue(approvedPitch({ status: "PENDING" }));
    const result = await sendVenuePitch("p1");
    expect(result).toEqual({ ok: false, error: "Approve the pitch before sending" });
    expect(sendGmail).not.toHaveBeenCalled();
  });

  it("is idempotent — an already-SENT pitch is a no-op success, no second send", async () => {
    mockDb.venuePitch.findFirst.mockResolvedValue(approvedPitch({ status: "SENT" }));
    const result = await sendVenuePitch("p1");
    expect(result).toEqual({ ok: true });
    expect(sendGmail).not.toHaveBeenCalled();
  });

  it("requires a connected mailbox", async () => {
    mockDb.mailboxConnection.findUnique.mockResolvedValue(null);
    const result = await sendVenuePitch("p1");
    expect(result).toEqual({ ok: false, error: "Connect your mailbox first" });
    expect(sendGmail).not.toHaveBeenCalled();
  });

  it("refuses an ERROR-state mailbox", async () => {
    mockDb.mailboxConnection.findUnique.mockResolvedValue({ status: "ERROR" });
    const result = await sendVenuePitch("p1");
    expect(result.ok).toBe(false);
    expect(sendGmail).not.toHaveBeenCalled();
  });

  it("re-checks suppression at send — a suppressed contact is blocked", async () => {
    mockDb.outreachSuppression.findUnique.mockResolvedValue({ id: "s1" });
    const result = await sendVenuePitch("p1");
    expect(result).toEqual({
      ok: false,
      error: "This contact is on your do-not-contact list",
    });
    // Looked up by the lowercased email.
    expect(mockDb.outreachSuppression.findUnique.mock.calls[0][0].where).toEqual({
      businessId_email: { businessId: "biz1", email: "events@velvet.co" },
    });
    expect(sendGmail).not.toHaveBeenCalled();
  });

  it("blocks a recipient who opted out through another tenant at the send boundary", async () => {
    mockDb.globalOutreachSuppression.findUnique.mockResolvedValue({ id: "global-1" });

    const result = await sendVenuePitch("p1");

    expect(result).toEqual({
      ok: false,
      error: "This contact is on your do-not-contact list",
    });
    expect(mockDb.globalOutreachSuppression.findUnique).toHaveBeenCalledWith({
      where: { email: "events@velvet.co" },
      select: { id: true },
    });
    expect(mockDb.outreachSuppression.findUnique).not.toHaveBeenCalled();
    expect(mockDb.venuePitch.updateMany).not.toHaveBeenCalled();
    expect(sendGmail).not.toHaveBeenCalled();
  });

  it("fails closed before the claim when approved copy violates the pitch safety gate", async () => {
    mockDb.venuePitch.findFirst.mockResolvedValue(
      approvedPitch({
        editedBody: "Free no-risk trial night! Would you call? Shall I send dates?",
      }),
    );
    const result = await sendVenuePitch("p1");
    expect(result).toEqual({
      ok: false,
      error: "This pitch needs a fresh review before it can be sent",
    });
    expect(mockDb.venuePitch.updateMany).not.toHaveBeenCalled();
    expect(sendGmail).not.toHaveBeenCalled();
  });

  it("enforces the daily SEND cap (counts SENT + SENDING today) before sending", async () => {
    mockDb.venuePitch.count.mockResolvedValue(5); // WARM send cap = 5
    const result = await sendVenuePitch("p1");
    expect(result).toEqual({
      ok: false,
      error: "Daily warm-send cap reached — quality beats volume",
    });
    // The cap query counts SENT + SENDING rows today in the tenant tz so
    // in-flight (claimed) sends can't blow the cap.
    const where = mockDb.venuePitch.count.mock.calls[0][0].where;
    expect(where.status).toEqual({ in: ["SENT", "SENDING"] });
    expect(where.temperature).toBe("WARM");
    expect(sendGmail).not.toHaveBeenCalled();
  });

  it("surfaces a MailboxError from the transport as a friendly form error and reverts the claim", async () => {
    const { MailboxError } = await import("@/lib/outbound/gmail");
    sendGmail.mockRejectedValueOnce(new MailboxError("Reconnect your mailbox"));
    const result = await sendVenuePitch("p1");
    expect(result).toEqual({ ok: false, error: "Reconnect your mailbox" });
    // (Phase 10.5 hardening) The send threw AFTER the claim, so the claim is
    // released: the LAST updateMany reverts SENDING → APPROVED (retry-able),
    // and the pitch is NEVER marked SENT on a failed send.
    const calls = mockDb.venuePitch.updateMany.mock.calls;
    const claim = calls[0][0];
    expect(claim.data.status).toBe("SENDING");
    const revert = calls[calls.length - 1][0];
    expect(revert.where.status).toBe("SENDING");
    expect(revert.data.status).toBe("APPROVED");
    expect(
      calls.some((c) => (c[0] as { data: { status: string } }).data.status === "SENT"),
    ).toBe(false);
  });

  it("refuses when the venue has no booking email", async () => {
    mockDb.venuePitch.findFirst.mockResolvedValue(
      approvedPitch({ venue: { ...standardVenue, bookingEmail: null } }),
    );
    const result = await sendVenuePitch("p1");
    expect(result.ok).toBe(false);
    expect(sendGmail).not.toHaveBeenCalled();
  });
});

// (Phase 10.5 hardening — FIX 2) Double-send / TOCTOU / partial-failure. The
// send is atomically CLAIMED (APPROVED → SENDING) immediately before the
// network call, so a concurrent second caller (or a partial failure) can never
// produce a second REAL email.
describe("sendVenuePitch — atomic claim closes the double-send window", () => {
  it("a second concurrent call sees the claim already taken (count 0) and no-ops — no second email", async () => {
    // Simulate the race: the claim updateMany matches ZERO rows because a
    // concurrent caller already flipped APPROVED → SENDING.
    mockDb.venuePitch.updateMany.mockResolvedValueOnce({ count: 0 });
    const result = await sendVenuePitch("p1");
    // Friendly no-op success — NOT an error.
    expect(result).toEqual({ ok: true });
    // The loser never crosses the network and never records a SENT.
    expect(sendGmail).not.toHaveBeenCalled();
    // Only the claim attempt happened; no finalize write.
    expect(mockDb.venuePitch.updateMany).toHaveBeenCalledOnce();
  });

  it("the winning claim (count 1) proceeds to send exactly once", async () => {
    // Default beforeEach claim resolves count 1 → the winner sends.
    const result = await sendVenuePitch("p1");
    expect(result).toEqual({ ok: true });
    expect(sendGmail).toHaveBeenCalledOnce();
    // Claim was APPROVED → SENDING, finalize was SENDING → SENT.
    const claim = mockDb.venuePitch.updateMany.mock.calls[0][0];
    expect(claim.where.status).toBe("APPROVED");
    expect(claim.data.status).toBe("SENDING");
  });

  it("an in-flight SENDING pitch is an idempotent no-op (never a second send)", async () => {
    mockDb.venuePitch.findFirst.mockResolvedValue(approvedPitch({ status: "SENDING" }));
    const result = await sendVenuePitch("p1");
    expect(result).toEqual({ ok: true });
    expect(sendGmail).not.toHaveBeenCalled();
    // No claim write — we bailed at the status guard.
    expect(mockDb.venuePitch.updateMany).not.toHaveBeenCalled();
  });

  it("a NON-MailboxError send throw also reverts the claim SENDING → APPROVED", async () => {
    sendGmail.mockRejectedValueOnce(new Error("network blip"));
    const result = await sendVenuePitch("p1");
    expect(result).toEqual({
      ok: false,
      error: "The send didn't go through — try again in a moment",
    });
    const calls = mockDb.venuePitch.updateMany.mock.calls;
    const revert = calls[calls.length - 1][0];
    expect(revert.where.status).toBe("SENDING");
    expect(revert.data.status).toBe("APPROVED");
    // Never marked SENT on a failed send.
    expect(
      calls.some((c) => (c[0] as { data: { status: string } }).data.status === "SENT"),
    ).toBe(false);
  });
});
