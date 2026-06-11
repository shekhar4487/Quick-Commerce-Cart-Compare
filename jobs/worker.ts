/**
 * BullMQ worker — runs the Playwright scrapers as background jobs.
 * Start with: npm run worker   (deploy separately from the Next.js app:
 * Railway/Render service or the Dockerfile in /docker).
 */
import { Worker, type Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import { cacheSet, priceCacheKey, cacheDel, offersCacheKey, PRICE_CACHE_TTL_SEC } from "@/lib/redis";
import { unitPrice } from "@/lib/grocery";
import { scrapeSearch, pickBestMatch } from "@/scraper";
import { scrapeOffers } from "@/scraper/offers";
import { autoAddToCart } from "@/scraper/autocart";
import { getBullConnection, QUEUE_NAMES, type AutoCartJobData, type ScrapePriceJobData } from "./queue";
import type { PlatformSlug } from "@/types";

const connection = getBullConnection();
if (!connection) {
  console.error("REDIS_URL is required to run the worker.");
  process.exit(1);
}

// ── scrape-prices ─────────────────────────────────────────────────────────────

async function handlePriceScrape(job: Job<ScrapePriceJobData>) {
  const { platform, query } = job.data;
  const products = await scrapeSearch(platform as PlatformSlug, query);
  const best = pickBestMatch(products, query);

  if (!best) {
    // Soft failure: keep last cached price, let the next compare retry.
    console.warn(`[worker] no match for "${query}" on ${platform}`);
    return { ok: false };
  }

  await prisma.scrapedPrice.create({
    data: {
      platform,
      productName: best.name,
      productQuery: query,
      price: best.price,
      unit: best.unit,
      unitPrice: unitPrice(best.price, best.unit ?? best.name),
      url: best.url,
    },
  });

  await cacheSet(
    priceCacheKey(platform, query),
    JSON.stringify({ name: best.name, price: best.price, unit: best.unit }),
    PRICE_CACHE_TTL_SEC
  );

  return { ok: true, name: best.name, price: best.price };
}

// ── scrape-offers ─────────────────────────────────────────────────────────────

async function handleOfferScrape(job: Job<{ platform: PlatformSlug }>) {
  const { platform } = job.data;
  const offers = await scrapeOffers(platform);
  if (offers.length === 0) return { ok: false, count: 0 };

  await prisma.$transaction([
    prisma.offer.deleteMany({ where: { platform, source: "scraped" } }),
    prisma.offer.createMany({
      data: offers.map((o) => ({
        platform: o.platform,
        bankId: o.bankId,
        description: o.description,
        offerType: o.offerType,
        discountValue: o.discountValue,
        maxDiscount: o.maxDiscount,
        minOrder: o.minOrder,
        source: "scraped",
        isActive: true,
      })),
    }),
  ]);
  await cacheDel(offersCacheKey(platform));

  return { ok: true, count: offers.length };
}

// ── auto-cart ─────────────────────────────────────────────────────────────────

async function handleAutoCart(job: Job<AutoCartJobData>) {
  const { platform, items } = job.data;
  return autoAddToCart(platform as PlatformSlug, items);
}

// ── workers ───────────────────────────────────────────────────────────────────

const workers = [
  new Worker(QUEUE_NAMES.prices, handlePriceScrape, {
    connection,
    concurrency: 2,
    // Polite scraping: at most 6 page loads / 10s across the fleet.
    limiter: { max: 6, duration: 10000 },
  }),
  new Worker(QUEUE_NAMES.offers, handleOfferScrape, {
    connection,
    concurrency: 1,
    limiter: { max: 2, duration: 60000 },
  }),
  new Worker(QUEUE_NAMES.autocart, handleAutoCart, { connection, concurrency: 1 }),
];

for (const w of workers) {
  w.on("completed", (job) => console.log(`[worker:${w.name}] ${job.id} done`));
  w.on("failed", (job, err) => console.error(`[worker:${w.name}] ${job?.id} failed: ${err.message}`));
}

console.log("CartCompare worker running. Queues:", workers.map((w) => w.name).join(", "));

async function shutdown() {
  console.log("Shutting down workers…");
  await Promise.all(workers.map((w) => w.close()));
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
