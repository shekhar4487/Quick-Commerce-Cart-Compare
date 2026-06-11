import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis?: Redis | null };

/**
 * Lazily creates a shared Redis connection. Returns null when REDIS_URL is not
 * configured — every caller degrades gracefully (no cache / no rate limiting),
 * so the app still works in minimal local setups.
 */
export function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  if (globalForRedis.redis === undefined) {
    const client = new Redis(process.env.REDIS_URL, {
      // Queue commands while (re)connecting; maxRetriesPerRequest keeps a hard
      // failure bound so a down Redis still rejects quickly instead of hanging.
      maxRetriesPerRequest: 2,
      connectTimeout: 5000,
      lazyConnect: false,
    });
    client.on("error", (e) => console.error("[redis]", e.message));
    globalForRedis.redis = client;
  }
  return globalForRedis.redis ?? null;
}

export async function cacheGet(key: string): Promise<string | null> {
  try {
    return (await getRedis()?.get(key)) ?? null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: string, ttlSec: number): Promise<void> {
  try {
    await getRedis()?.set(key, value, "EX", ttlSec);
  } catch {
    /* cache is best-effort */
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  try {
    if (keys.length) await getRedis()?.del(...keys);
  } catch {
    /* best-effort */
  }
}

export const PRICE_CACHE_TTL_SEC = 15 * 60; // 15 minutes per spec
export const OFFERS_CACHE_TTL_SEC = 15 * 60;

export const priceCacheKey = (platform: string, query: string) => `price:${platform}:${query}`;
export const offersCacheKey = (platform: string) => `offers:${platform}`;
