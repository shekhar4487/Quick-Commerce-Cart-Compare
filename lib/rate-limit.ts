import { getRedis } from "@/lib/redis";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
}

/**
 * Fixed-window rate limiter backed by Redis. Fails OPEN (allows the request)
 * if Redis is unavailable so an infra blip never takes the API down.
 */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  const redis = getRedis();
  if (!redis) return { ok: true, remaining: limit };
  try {
    const k = `rl:${key}`;
    const count = await redis.incr(k);
    if (count === 1) await redis.expire(k, windowSec);
    return { ok: count <= limit, remaining: Math.max(0, limit - count) };
  } catch {
    return { ok: true, remaining: limit };
  }
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
