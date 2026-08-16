import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import {
  CRON_FRESHNESS_MS,
  cronCompletionHealth,
  staleCronKeys,
} from "@/lib/ops-stamp";

const NOW = new Date("2026-08-16T12:00:00.000Z");

describe("cron completion health", () => {
  it("uses the last successful completion timestamp for freshness", () => {
    const statuses = cronCompletionHealth(
      [
        { key: "cron:sequences", at: new Date(NOW.getTime() - 10 * 60 * 1000) },
        { key: "cron:discovery", at: new Date(NOW.getTime() - 27 * 3600 * 1000) },
      ],
      NOW,
      NOW,
    );

    expect(statuses["cron:sequences"]).toMatchObject({ stale: false, state: "fresh" });
    expect(statuses["cron:discovery"]).toMatchObject({
      stale: true,
      state: "stale_completion",
    });
  });

  it("gives a never-run cron one safe schedule interval, then marks it missing", () => {
    const justInsideGrace = new Date(
      NOW.getTime() - CRON_FRESHNESS_MS["cron:sequences"] + 1,
    );
    const afterGrace = new Date(
      NOW.getTime() - CRON_FRESHNESS_MS["cron:sequences"] - 1,
    );

    expect(cronCompletionHealth([], NOW, justInsideGrace)["cron:sequences"]).toEqual({
      at: null,
      stale: false,
      state: "awaiting_first_completion",
    });
    expect(cronCompletionHealth([], NOW, afterGrace)["cron:sequences"]).toEqual({
      at: null,
      stale: true,
      state: "missing_completion",
    });

    // A weekly job still gets its own full weekly grace, not the sequence
    // job's much shorter threshold.
    expect(cronCompletionHealth([], NOW, afterGrace)["cron:weekly-report"].stale).toBe(false);
  });

  it("returns both stale and post-grace missing jobs for the nightly alert", () => {
    const graceStartedAt = new Date(NOW.getTime() - 9 * 24 * 3600 * 1000);
    const keys = staleCronKeys(
      [{ key: "cron:sequences", at: new Date(NOW.getTime() - 46 * 60 * 1000) }],
      NOW,
      graceStartedAt,
    );

    expect(keys).toEqual([
      "cron:sequences",
      "cron:discovery",
      "cron:weekly-report",
      "cron:margin-guardrail",
    ]);
  });

  it("does not reset a missing job's grace on a routine process restart", () => {
    const recentProcessStart = new Date(NOW.getTime() - 5 * 60 * 1000);
    const statuses = cronCompletionHealth(
      [{ key: "cron:discovery", at: new Date(NOW.getTime() - 2 * 24 * 3600 * 1000) }],
      NOW,
      recentProcessStart,
    );

    expect(statuses["cron:sequences"]).toMatchObject({
      stale: true,
      state: "missing_completion",
    });
  });
});
