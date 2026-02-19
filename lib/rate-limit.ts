type Bucket = {
  count: number;
  resetAtMs: number;
};

const buckets = new Map<string, Bucket>();

export function consumeRateLimit(options: {
  key: string;
  limit: number;
  windowMs: number;
}): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const bucket = buckets.get(options.key);

  if (!bucket || bucket.resetAtMs <= now) {
    buckets.set(options.key, {
      count: 1,
      resetAtMs: now + options.windowMs,
    });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (bucket.count >= options.limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAtMs - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}
