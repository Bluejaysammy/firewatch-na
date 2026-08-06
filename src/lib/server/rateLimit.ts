import "server-only";

interface Bucket {
  tokens: number;
  updatedAt: number;
}

const buckets: Map<string, Bucket> = ((globalThis as Record<string, unknown>)
  .__firewatchBuckets as Map<string, Bucket>) ?? new Map();
(globalThis as Record<string, unknown>).__firewatchBuckets = buckets;

let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of buckets) {
    if (now - b.updatedAt > 10 * 60_000) buckets.delete(k);
  }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}

/**
 * Token-bucket limiter (per IP + group). Per-instance in-memory state; for
 * horizontally scaled deployments use a shared store — see README.
 * Returns null when allowed, or a 429 Response when the limit is exceeded.
 */
export function rateLimit(
  req: Request,
  group: string,
  perMinute: number
): Response | null {
  if (process.env.RATE_LIMIT_DISABLED === "1") return null;
  const now = Date.now();
  sweep(now);
  const key = `${group}:${clientIp(req)}`;
  const bucket = buckets.get(key) ?? { tokens: perMinute, updatedAt: now };
  const refill = ((now - bucket.updatedAt) / 60_000) * perMinute;
  bucket.tokens = Math.min(perMinute, bucket.tokens + refill);
  bucket.updatedAt = now;
  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": "10",
      },
    });
  }
  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return null;
}
