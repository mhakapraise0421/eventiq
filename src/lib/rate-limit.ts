type Bucket = { count: number; resetAt: number };

const MAX_BUCKETS = 10_000;
const SWEEP_INTERVAL_MS = 30_000;

const globalStore = globalThis as typeof globalThis & {
  __eventiqRateLimits?: Map<string, Bucket>;
  __eventiqRateLimitSweptAt?: number;
};

function store() {
  if (!globalStore.__eventiqRateLimits) {
    globalStore.__eventiqRateLimits = new Map();
  }
  return globalStore.__eventiqRateLimits;
}

// Removes expired counters so sprayed keys cannot grow memory without bound.
function sweep(buckets: Map<string, Bucket>, now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  if (buckets.size > MAX_BUCKETS) {
    const oldest = [...buckets.entries()]
      .sort((a, b) => a[1].resetAt - b[1].resetAt)
      .slice(0, buckets.size - MAX_BUCKETS);
    for (const [key] of oldest) buckets.delete(key);
  }
  globalStore.__eventiqRateLimitSweptAt = now;
}

export function rateLimit(key: string, limit: number, windowMs = 60_000) {
  const buckets = store();
  const now = Date.now();
  const sweptAt = globalStore.__eventiqRateLimitSweptAt || 0;
  const existing = buckets.get(key);
  if (now - sweptAt > SWEEP_INTERVAL_MS || (!existing && buckets.size >= MAX_BUCKETS)) {
    sweep(buckets, now);
  }
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }
  if (existing.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.ceil((existing.resetAt - now) / 1000),
    };
  }
  existing.count += 1;
  return { ok: true, remaining: limit - existing.count, retryAfter: 0 };
}
