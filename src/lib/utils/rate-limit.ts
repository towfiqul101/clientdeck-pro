/**
 * In-memory, per-instance sliding-window rate limiter. Best-effort only —
 * Vercel serverless functions don't share memory across instances, so this
 * doesn't enforce a hard global cap, but it's sufficient as basic abuse
 * protection on public-facing endpoints (the portal messages route).
 */
const buckets = new Map<string, number[]>();

/** True if `key` has made fewer than `limit` calls in the trailing `windowMs`. Records this call either way. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

  if (timestamps.length >= limit) {
    buckets.set(key, timestamps);
    return false;
  }

  timestamps.push(now);
  buckets.set(key, timestamps);
  return true;
}

/** Best-effort caller IP from standard proxy headers (Vercel sets x-forwarded-for). */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
