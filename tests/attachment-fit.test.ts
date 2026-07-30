import { describe, expect, it } from "vitest";
import { fitAttachments } from "@/lib/outbound/send";

// The product walks customers into this cliff: profile strength REQUIRES three
// photos, uploads allow 8 MB each, and the live press kit was already 5.5 MB
// from ONE photo. Three would exceed Postmark's 10 MB message limit (worse
// after base64), the send would throw, the draft would revert to PENDING, and
// every retry would hit the same wall — the client never receives the reply and
// the owner just sees a draft that looks un-sent.

const att = (filename: string, mb: number) => ({
  filename,
  content: Buffer.alloc(Math.round(mb * 1024 * 1024)),
  contentType: "application/pdf",
});

describe("fitAttachments", () => {
  it("keeps a normal press kit untouched", () => {
    const { kept, dropped } = fitAttachments([att("press-kit.pdf", 2)]);
    expect(kept).toHaveLength(1);
    expect(dropped).toHaveLength(0);
  });

  it("drops the oversized attachment rather than letting the send fail", () => {
    const { kept, dropped } = fitAttachments([att("press-kit.pdf", 20)]);
    expect(kept).toHaveLength(0);
    expect(dropped.map((d) => d.filename)).toEqual(["press-kit.pdf"]);
  });

  it("keeps what fits when several are attached and drops only the overflow", () => {
    const { kept, dropped } = fitAttachments([
      att("quote.pdf", 1),
      att("press-kit.pdf", 5),
      att("extra.pdf", 4),
    ]);
    expect(kept.map((a) => a.filename)).toEqual(["quote.pdf", "press-kit.pdf"]);
    expect(dropped.map((d) => d.filename)).toEqual(["extra.pdf"]);
  });

  it("never exceeds the budget in total, not just per file", () => {
    const { kept } = fitAttachments([att("a.pdf", 4), att("b.pdf", 4)]);
    const total = kept.reduce((n, a) => n + a.content.byteLength, 0);
    expect(total).toBeLessThanOrEqual(7 * 1024 * 1024);
  });

  it("handles no attachments", () => {
    expect(fitAttachments([])).toEqual({ kept: [], dropped: [] });
  });
});
