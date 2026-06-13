import { beforeEach, describe, expect, it, vi } from "vitest";

// Phase 10.5 — sendVenuePitch action guards. The legal heart of the phase:
// CONSENT/STRICT jurisdictions must NEVER auto-send (handoff-only), suppression
// is re-checked at send, the daily SEND cap is enforced, and a re-send of an
// already-SENT pitch is an idempotent no-op. sendGmail is mocked so no real
// Gmail call happens; the DB is mocked the way venues-actions.test.ts does.

const mockDb = vi.hoisted(() => ({
  venuePitch: { findFirst: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
  mailboxConnection: { findUnique: vi.fn() },
  outreachSuppression: { findUnique: vi.fn() },
  venue: { updateMany: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tenant", () => ({
  getCurrentBusiness: vi.fn(async () => ({
    id: "biz1",
    name: "Sapphire Sounds",
    ownerEmail: "maya@login.com",
    replyToEmail: null,
    serviceCities: ["Manchester"],
    timezone: "Europe/London",
  })),
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

import { sendVenuePitch } from "@/app/actions/venues";

const standardVenue = {
  id: "v1",
  businessId: "biz1",
  name: "Velvet Lounge",
  country: "GB", // STANDARD
  bookingEmail: "events@velvet.co",
  bookingContactName: "Sam",
  status: "PITCH_DRAFTED",
};

function approvedPitch(over: Record<string, unknown> = {}) {
  return {
    id: "p1",
    businessId: "biz1",
    status: "APPROVED",
    subject: "Intro for your rotation",
    body: "Saw you run Friday DJ sets — keep me on file.",
    editedSubject: null,
    editedBody: null,
    temperature: "WARM",
    venue: standardVenue,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.venuePitch.findFirst.mockResolvedValue(approvedPitch());
  mockDb.mailboxConnection.findUnique.mockResolvedValue({ status: "CONNECTED" });
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
    expect(sent.toEmail).toBe("events@velvet.co");
    expect(sent.replyToEmail).toBe("maya@login.com"); // falls back to ownerEmail
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
      error: "Canada/Germany are copy-and-send only — use the Copy button",
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

  it("REFUSES an unknown country (fail-closed CONSENT)", async () => {
    mockDb.venuePitch.findFirst.mockResolvedValue(
      approvedPitch({ venue: { ...standardVenue, country: "ZZ" } }),
    );
    const result = await sendVenuePitch("p1");
    expect(result.ok).toBe(false);
    expect(sendGmail).not.toHaveBeenCalled();
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
