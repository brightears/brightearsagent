import { describe, expect, it, beforeEach } from "vitest";
import {
  noteUnrouted,
  unroutedEntries,
  clearUnrouted,
  isFirstSighting,
  editDistance,
  nearestSlug,
  buildUnroutedReport,
} from "@/lib/inbound/unrouted";

// Mail to a lead address no tenant owns is dropped as a FINAL state, which is
// right for stray internet mail and catastrophic for a customer who typo'd their
// forwarding address: the wildcard MX (*.in.brightears.io) means Postmark
// accepts every possible slug, so their real inquiries vanish silently.

beforeEach(() => clearUnrouted());

describe("noteUnrouted", () => {
  it("records an address and counts repeats without duplicating it", () => {
    const now = new Date("2026-07-30T10:00:00Z");
    const first = noteUnrouted("leads@nobert.in.brightears.io", "nobert", now);
    expect(isFirstSighting(first!)).toBe(true);
    const second = noteUnrouted("leads@nobert.in.brightears.io", "nobert", now);
    expect(isFirstSighting(second!)).toBe(false);
    expect(unroutedEntries()).toHaveLength(1);
    expect(unroutedEntries()[0].count).toBe(2);
  });

  it("is case- and whitespace-insensitive, so one typo is not counted as several", () => {
    noteUnrouted("Leads@Nobert.in.brightears.io", "nobert");
    noteUnrouted("  leads@nobert.in.brightears.io  ", "nobert");
    expect(unroutedEntries()).toHaveLength(1);
  });

  it("ignores an empty recipient instead of tracking a blank key", () => {
    expect(noteUnrouted("", null)).toBeNull();
    expect(noteUnrouted("   ", null)).toBeNull();
    expect(unroutedEntries()).toHaveLength(0);
  });

  it("sorts worst offenders first", () => {
    noteUnrouted("a@x.in.brightears.io", "a");
    noteUnrouted("b@y.in.brightears.io", "y");
    noteUnrouted("b@y.in.brightears.io", "y");
    expect(unroutedEntries()[0].to).toBe("b@y.in.brightears.io");
  });

  it("stops tracking NEW addresses past the cap but keeps counting known ones", () => {
    // A spam run against invented slugs must not grow the map without bound,
    // and must not evict the address most likely to be a real customer's typo.
    for (let i = 0; i < 600; i++) noteUnrouted(`x${i}@s${i}.in.brightears.io`, `s${i}`);
    const size = unroutedEntries().length;
    expect(size).toBe(500);
    const known = unroutedEntries()[0].to;
    noteUnrouted(known, "whatever");
    expect(unroutedEntries().length).toBe(500);
  });
});

describe("editDistance", () => {
  it("computes the standard distances", () => {
    expect(editDistance("norbert", "norbert")).toBe(0);
    expect(editDistance("norbert", "nobert")).toBe(1); // dropped letter
    expect(editDistance("norbert", "norbet")).toBe(1);
    expect(editDistance("norbert", "nrobert")).toBe(2); // transposition
    expect(editDistance("", "abc")).toBe(3);
    expect(editDistance("abc", "")).toBe(3);
  });
});

describe("nearestSlug", () => {
  const slugs = ["norbert", "bright-beats", "dj-mint"];

  it("finds the near-miss that indicates a forwarding typo", () => {
    expect(nearestSlug("nobert", slugs)).toEqual({ slug: "norbert", distance: 1 });
    expect(nearestSlug("bright-beat", slugs)).toEqual({ slug: "bright-beats", distance: 1 });
  });

  it("does NOT report an exact match as a near-miss", () => {
    expect(nearestSlug("norbert", slugs)).toBeNull();
  });

  it("ignores anything too far away — a probe is not a typo", () => {
    expect(nearestSlug("admin", slugs)).toBeNull();
    expect(nearestSlug("wordpress", slugs)).toBeNull();
  });

  it("tightens the threshold for short slugs, which would otherwise match anything", () => {
    // Distance 2 on a 3-character slug is noise, not a signal.
    expect(nearestSlug("abc", ["abd"])).toEqual({ slug: "abd", distance: 1 });
    expect(nearestSlug("abc", ["axy"])).toBeNull();
  });

  it("returns null for an unparseable address", () => {
    expect(nearestSlug(null, slugs)).toBeNull();
  });
});

describe("buildUnroutedReport", () => {
  const loadSlugs = async () => ["norbert", "dj-mint"];

  it("is empty and does not query slugs when nothing was dropped", async () => {
    let queried = false;
    const report = await buildUnroutedReport(async () => {
      queried = true;
      return [];
    });
    expect(report.total).toBe(0);
    expect(report.nearMisses).toHaveLength(0);
    // The nightly digest runs every night; no drops means no work at all.
    expect(queried).toBe(false);
  });

  it("separates likely typos from probes", async () => {
    noteUnrouted("leads@nobert.in.brightears.io", "nobert"); // typo of norbert
    noteUnrouted("leads@nobert.in.brightears.io", "nobert");
    noteUnrouted("leads@wordpress.in.brightears.io", "wordpress"); // probe
    const report = await buildUnroutedReport(loadSlugs);
    expect(report.total).toBe(3);
    expect(report.nearMisses).toHaveLength(1);
    expect(report.nearMisses[0]).toMatchObject({ didYouMean: "norbert", count: 2, distance: 1 });
  });

  it("reports an unparseable address in the total but never as a typo", async () => {
    noteUnrouted("garbage@brightears.io", null);
    const report = await buildUnroutedReport(loadSlugs);
    expect(report.total).toBe(1);
    expect(report.nearMisses).toHaveLength(0);
  });
});
