import { Queue, QueueEvents, type Job } from "bullmq";
import IORedis from "ioredis";

export const QUEUE_NAMES = {
  prices: "scrape-prices",
  offers: "scrape-offers",
  autocart: "auto-cart",
} as const;

type Globals = {
  bullConnection?: IORedis | null;
  queues?: Map<string, Queue>;
  queueEvents?: Map<string, QueueEvents>;
};
const g = globalThis as unknown as Globals;

/** BullMQ requires maxRetriesPerRequest: null — separate from the cache client. */
export function getBullConnection(): IORedis | null {
  if (!process.env.REDIS_URL) return null;
  if (g.bullConnection === undefined) {
    const conn = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
    conn.on("error", (e) => console.error("[bullmq:redis]", e.message));
    g.bullConnection = conn;
  }
  return g.bullConnection ?? null;
}

export function getQueue(name: string): Queue | null {
  const connection = getBullConnection();
  if (!connection) return null;
  g.queues ??= new Map();
  if (!g.queues.has(name)) {
    g.queues.set(
      name,
      new Queue(name, {
        connection,
        defaultJobOptions: {
          removeOnComplete: { age: 3600, count: 500 },
          removeOnFail: { age: 24 * 3600 },
          attempts: 2,
          backoff: { type: "exponential", delay: 5000 },
        },
      })
    );
  }
  return g.queues.get(name) ?? null;
}

export function getQueueEvents(name: string): QueueEvents | null {
  const connection = getBullConnection();
  if (!connection) return null;
  g.queueEvents ??= new Map();
  if (!g.queueEvents.has(name)) {
    g.queueEvents.set(name, new QueueEvents(name, { connection: connection.duplicate() }));
  }
  return g.queueEvents.get(name) ?? null;
}

export interface ScrapePriceJobData {
  platform: string;
  query: string;
}

/**
 * Enqueues a price scrape, deduped on platform+query so a burst of identical
 * comparisons produces one job. Returns null when Redis isn't configured.
 */
export async function enqueuePriceScrape(platform: string, query: string): Promise<Job | null> {
  const queue = getQueue(QUEUE_NAMES.prices);
  if (!queue) return null;
  try {
    // BullMQ forbids ":" in custom job ids (Redis key separator).
    return await queue.add(
      "scrape",
      { platform, query } satisfies ScrapePriceJobData,
      { jobId: `${platform}--${query}`.replace(/[^a-z0-9_-]/gi, "_") }
    );
  } catch (e) {
    console.error("[queue] enqueue failed:", (e as Error).message);
    return null;
  }
}

export async function enqueueOfferScrape(platform: string): Promise<Job | null> {
  const queue = getQueue(QUEUE_NAMES.offers);
  if (!queue) return null;
  try {
    return await queue.add("scrape-offers", { platform }, { jobId: `offers--${platform}` });
  } catch {
    return null;
  }
}

export interface AutoCartJobData {
  platform: string;
  items: string[];
  userId: string;
}

export async function enqueueAutoCart(data: AutoCartJobData): Promise<Job | null> {
  const queue = getQueue(QUEUE_NAMES.autocart);
  if (!queue) return null;
  try {
    return await queue.add("auto-cart", data);
  } catch {
    return null;
  }
}
