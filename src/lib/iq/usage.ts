import "server-only";
import { createHash } from "node:crypto";
import { get, run } from "@/lib/db";
import { iqConfig } from "./config";

export interface QuotaDecision {
  ok: boolean;
  used: number;
  limit: number;
  resetAt: string;
}

/**
 * Durable daily IQ counters. The in-memory rate limiter only covers short
 * bursts and resets with the process, so it cannot cap provider spend per
 * person per day. This table adds one atomic row per principal per UTC day.
 */
export function utcDay(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function resetAtIso(now = new Date()) {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return next.toISOString();
}

function keyHash(prefix: string, value: string) {
  return `${prefix}:${createHash("sha256").update(value).digest("hex").slice(0, 32)}`;
}

function bump(key: string, day: string, limit: number) {
  // One statement, so concurrent requests cannot both read the same count.
  // The counter stops at limit + 1 to keep rows small.
  const row = get<{ requests: number }>(
    `INSERT INTO iq_usage (principal_key, day, requests, updated_at)
     VALUES (?, ?, 1, ?)
     ON CONFLICT(principal_key, day) DO UPDATE SET
       requests = MIN(iq_usage.requests + 1, ?),
       updated_at = excluded.updated_at
     RETURNING requests`,
    key,
    day,
    new Date().toISOString(),
    limit + 1,
  );
  const requests = Number(row?.requests || 1);
  return { allowed: requests <= limit, used: requests };
}

let lastPrune = 0;
function prune(daysOld = 8) {
  if (Date.now() - lastPrune < 60 * 60_000) return;
  lastPrune = Date.now();
  const cutoff = new Date(Date.now() - daysOld * 86_400_000).toISOString().slice(0, 10);
  run("DELETE FROM iq_usage WHERE day < ?", cutoff);
}

/**
 * Counts one IQ question. Signed-in users get one bucket keyed by user id.
 * Anonymous visitors get a bucket keyed by the hash of their visitor token
 * plus a looser per-IP bucket, so clearing cookies does not reset the limit.
 */
export function consumeIqQuota(input: {
  userId?: string | null;
  visitorTokenHash?: string | null;
  ip?: string | null;
}): QuotaDecision {
  const config = iqConfig();
  const now = new Date();
  const day = utcDay(now);
  const resetAt = resetAtIso(now);
  prune();

  if (input.userId) {
    const bucket = bump(`u:${input.userId}`, day, config.dailyQuota);
    return {
      ok: bucket.allowed,
      used: Math.min(bucket.used, config.dailyQuota),
      limit: config.dailyQuota,
      resetAt,
    };
  }

  const tokenBucket = input.visitorTokenHash
    ? bump(keyHash("v", input.visitorTokenHash), day, config.dailyQuota)
    : null;
  const ipBucket = input.ip
    ? bump(keyHash("ip", input.ip), day, config.anonymousIpQuota)
    : null;

  const allowed = (tokenBucket?.allowed ?? true) && (ipBucket?.allowed ?? true);
  return {
    ok: allowed,
    used: Math.min(tokenBucket?.used ?? 0, config.dailyQuota),
    limit: config.dailyQuota,
    resetAt,
  };
}

export function quotaMessage(decision: QuotaDecision) {
  const reset = new Date(decision.resetAt);
  const hours = Math.max(1, Math.ceil((reset.getTime() - Date.now()) / 3_600_000));
  return `IQ has reached today's limit of ${decision.limit} questions for this account or browser. It resets in about ${hours} hour${hours === 1 ? "" : "s"} (midnight UTC).`;
}
