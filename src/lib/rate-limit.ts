type Bucket = { count: number; resetAt: number };

const globalStore = globalThis as typeof globalThis & {
  __eventiqRateLimits?: Map<string, Bucket>;
};

function store() {
  if (!globalStore.__eventiqRateLimits) {
    globalStore.__eventiqRateLimits = new Map();
  }
  return globalStore.__eventiqRateLimits;
}

export function rateLimit(key: string, limit: number, windowMs = 60_000) {
  const buckets = store();
  const now = Date.now();
  const existing = buckets.get(key);
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
