import { db } from "@/lib/db";

/**
 * Record a cron only after its complete workload has resolved. A start stamp
 * is a false-green when a tick crashes halfway through: the scheduler ran,
 * but the product work did not finish.
 *
 * The write is deliberately best-effort. Failure leaves the previous
 * completion stale (and therefore alertable) without turning already-finished
 * customer work into a failed/retryable cron response.
 */
export async function stampCronCompletion(key: string, at = new Date()): Promise<void> {
  try {
    await db.opsStamp.upsert({ where: { key }, create: { key, at }, update: { at } });
  } catch (err) {
    console.error(`ops completion stamp failed for ${key}`, err);
  }
}

/** Staleness thresholds per cron (generous: schedule interval + slack). */
export const CRON_FRESHNESS_MS = {
  "cron:sequences": 45 * 60 * 1000, // */30 schedule + slack
  "cron:discovery": 26 * 3600 * 1000, // daily + slack
  "cron:weekly-report": 8 * 24 * 3600 * 1000, // weekly + slack
  "cron:margin-guardrail": 26 * 3600 * 1000, // daily + slack
} as const satisfies Record<string, number>;

export type CronKey = keyof typeof CRON_FRESHNESS_MS;

export type CronCompletionHealth = {
  at: string | null;
  stale: boolean;
  state: "fresh" | "stale_completion" | "awaiting_first_completion" | "missing_completion";
};

// Render runs this app as a long-lived Node process. Process start is the
// earliest reliable deployment-local instant available without adding a new
// database field or requiring another environment variable.
const deploymentGraceStartedAtMs = Date.now() - Math.max(0, process.uptime()) * 1000;

export function cronDeploymentGraceStartedAt(): Date {
  return new Date(deploymentGraceStartedAtMs);
}

/**
 * Build health from COMPLETION stamps. A brand-new deployment/database gets
 * one full schedule interval plus slack for each job to complete naturally;
 * after that, a never-seen completion is unhealthy instead of green forever.
 */
export function cronCompletionHealth(
  stamps: ReadonlyArray<{ key: string; at: Date }>,
  now = new Date(),
  graceStartedAt = cronDeploymentGraceStartedAt(),
): Record<CronKey, CronCompletionHealth> {
  const result = {} as Record<CronKey, CronCompletionHealth>;
  const nowMs = now.getTime();
  // Once any completion exists, it proves monitoring has been live since at
  // least that instant. Use it as an earlier grace anchor so a routine process
  // restart cannot repeatedly hide a different never-completed job.
  const missingGraceStartedAtMs = stamps.reduce(
    (earliest, stamp) => Math.min(earliest, stamp.at.getTime()),
    graceStartedAt.getTime(),
  );

  for (const [key, freshMs] of Object.entries(CRON_FRESHNESS_MS) as Array<
    [CronKey, number]
  >) {
    const stamp = stamps.find((candidate) => candidate.key === key);
    if (stamp) {
      const stale = nowMs - stamp.at.getTime() > freshMs;
      result[key] = {
        at: stamp.at.toISOString(),
        stale,
        state: stale ? "stale_completion" : "fresh",
      };
      continue;
    }

    const graceElapsed = nowMs - missingGraceStartedAtMs > freshMs;
    result[key] = {
      at: null,
      stale: graceElapsed,
      state: graceElapsed ? "missing_completion" : "awaiting_first_completion",
    };
  }

  return result;
}

export function staleCronKeys(
  stamps: ReadonlyArray<{ key: string; at: Date }>,
  now = new Date(),
  graceStartedAt = cronDeploymentGraceStartedAt(),
): CronKey[] {
  return (Object.entries(cronCompletionHealth(stamps, now, graceStartedAt)) as Array<
    [CronKey, CronCompletionHealth]
  >)
    .filter(([, status]) => status.stale)
    .map(([key]) => key);
}
