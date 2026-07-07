import { db } from "@/lib/db";

/**
 * Cron heartbeat stamps (P7.4): every cron route upserts its key at tick
 * start; /api/health flags staleness so a silently-dead cron becomes an
 * alertable signal. Stamping must never break the tick it observes.
 */
export async function stampCron(key: string, at = new Date()): Promise<void> {
  try {
    await db.opsStamp.upsert({ where: { key }, create: { key, at }, update: { at } });
  } catch (err) {
    console.error(`ops stamp failed for ${key}`, err);
  }
}

/** Staleness thresholds per cron (generous: schedule interval + slack). */
export const CRON_FRESHNESS_MS: Record<string, number> = {
  "cron:sequences": 45 * 60 * 1000, // */30 schedule + slack
  "cron:discovery": 26 * 3600 * 1000, // daily + slack
  "cron:weekly-report": 8 * 24 * 3600 * 1000, // weekly + slack
  "cron:margin-guardrail": 26 * 3600 * 1000, // daily + slack
};
