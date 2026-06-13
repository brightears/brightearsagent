import { describe, expect, it } from "vitest";
import { capError, capFor, DAILY_PITCH_CAPS, startOfTenantDay } from "@/lib/outreach/caps";

describe("DAILY_PITCH_CAPS (ADR-004 spam discipline)", () => {
  it("locks the founder-approved caps: HOT 10 · WARM 5 · SEED 3", () => {
    expect(DAILY_PITCH_CAPS).toEqual({ HOT: 10, WARM: 5, SEED: 3 });
    expect(capFor("WARM")).toBe(5);
  });

  it("refusal copy is friendly and names the temperature", () => {
    expect(capError("WARM")).toBe("Daily warm-pitch cap reached — quality beats volume");
    expect(capError("HOT")).toContain("hot-pitch cap");
    expect(capError("SEED")).toContain("intro-pitch cap"); // SEED speaks "intro" to the owner
  });
});

describe("startOfTenantDay (CLAUDE.md rule 9: tenant timezone)", () => {
  it("computes local midnight for a tenant east of UTC", () => {
    // 2026-06-12T01:30Z is already June 12 EVENING in Bangkok (UTC+7) — the
    // tenant's day started at 2026-06-11T17:00Z.
    const start = startOfTenantDay(new Date("2026-06-12T01:30:00Z"), "Asia/Bangkok");
    expect(start.toISOString()).toBe("2026-06-11T17:00:00.000Z");
  });

  it("computes local midnight for a tenant west of UTC", () => {
    // 2026-06-12T02:00Z is still June 11 in New York (EDT, UTC-4) — that
    // local day started 2026-06-11T04:00Z.
    const start = startOfTenantDay(new Date("2026-06-12T02:00:00Z"), "America/New_York");
    expect(start.toISOString()).toBe("2026-06-11T04:00:00.000Z");
  });

  it("a pitch created 'yesterday' tenant-local falls outside the window", () => {
    const now = new Date("2026-06-12T01:30:00Z"); // June 12 in Bangkok
    const start = startOfTenantDay(now, "Asia/Bangkok");
    const lateYesterdayBangkok = new Date("2026-06-11T16:59:00Z"); // 23:59 June 11 local
    const earlyTodayBangkok = new Date("2026-06-11T17:01:00Z"); // 00:01 June 12 local
    expect(lateYesterdayBangkok.getTime()).toBeLessThan(start.getTime());
    expect(earlyTodayBangkok.getTime()).toBeGreaterThanOrEqual(start.getTime());
  });

  // (Phase 10.5 hardening — FIX 4) DST-correct boundary. The old impl subtracted
  // the time-of-day measured with the offset at `now`, so on a DST-flip day the
  // midnight boundary drifted by ±1h. We now resolve the offset AT MIDNITE.
  it("is exact across the US spring-forward (offset at midnight ≠ offset now)", () => {
    // 2026-03-08: clocks jump 02:00 EST → 03:00 EDT. Local midnight is still EST
    // (UTC-5) → 05:00Z. `now` is 10:00 EDT (UTC-4, after the jump): the old code
    // would have computed 06:00Z (off by 1h). The fix yields exactly 05:00Z.
    const now = new Date("2026-03-08T14:00:00Z"); // 10:00 EDT, post-jump
    const start = startOfTenantDay(now, "America/New_York");
    expect(start.toISOString()).toBe("2026-03-08T05:00:00.000Z");
  });

  it("is exact across the US fall-back day", () => {
    // 2026-11-01: clocks fall 02:00 EDT → 01:00 EST. Local midnight is EDT
    // (UTC-4) → 04:00Z. `now` 13:00 EST (post-fallback) still resolves to 04:00Z.
    const now = new Date("2026-11-01T18:00:00Z");
    const start = startOfTenantDay(now, "America/New_York");
    expect(start.toISOString()).toBe("2026-11-01T04:00:00.000Z");
  });
});
