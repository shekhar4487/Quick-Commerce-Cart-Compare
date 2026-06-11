import { prisma } from "@/lib/prisma";
import { cacheGet, priceCacheKey } from "@/lib/redis";
import { estimatePrice } from "@/lib/grocery";
import { getActiveOffers, getBestOffer } from "@/lib/offer-engine";
import { getPlatform, PLATFORMS } from "@/lib/platforms";
import { enqueuePriceScrape, getQueueEvents, QUEUE_NAMES } from "@/jobs/queue";
import type { ItemPrice, ParsedItem, PlatformResult, PlatformSlug, UserCardInput } from "@/types";

interface CachedPrice {
  name: string;
  price: number;
  unit: string | null;
}

const SCRAPE_WAIT_MS = parseInt(process.env.COMPARE_SCRAPE_TIMEOUT_MS ?? "8000", 10);

/**
 * Price one item on one platform. Resolution order:
 *   1. Redis cache (15-min TTL, written by the scrape worker)
 *   2. Last scraped price in Postgres (≤24h old → "cached", older → still used
 *      as fallback rather than failing)
 *   3. Static estimate table (and a scrape job is enqueued so the next
 *      comparison gets real data)
 */
async function priceItem(platform: PlatformSlug, item: ParsedItem): Promise<ItemPrice> {
  const fromCache = await cacheGet(priceCacheKey(platform, item.query));
  if (fromCache) {
    try {
      const p = JSON.parse(fromCache) as CachedPrice;
      return makeItemPrice(item, p.price, p.name, p.unit, "live");
    } catch {
      /* corrupt entry — fall through */
    }
  }

  const row = await prisma.scrapedPrice.findFirst({
    where: { platform, productQuery: item.query },
    orderBy: { scrapedAt: "desc" },
  });
  if (row) {
    // Stale rows still beat estimates; refresh in the background.
    const fresh = Date.now() - row.scrapedAt.getTime() < 24 * 3600 * 1000;
    if (!fresh) void enqueuePriceScrape(platform, item.query);
    return makeItemPrice(item, row.price, row.productName, row.unit, "cached");
  }

  void enqueuePriceScrape(platform, item.query);
  const config = getPlatform(platform)!;
  const estimate = Math.round(estimatePrice(item.query) * config.priceMultiplier);
  return makeItemPrice(item, estimate, null, null, "estimate");
}

function makeItemPrice(
  item: ParsedItem,
  price: number,
  matchedName: string | null,
  unit: string | null,
  source: ItemPrice["source"]
): ItemPrice {
  const rounded = Math.round(price);
  return { ...item, price: rounded, lineTotal: rounded * item.quantity, matchedName, unit, source };
}

/**
 * Best-effort wait for the scrape jobs kicked off above, so first-time queries
 * can return live prices instead of estimates. Bounded by
 * COMPARE_SCRAPE_TIMEOUT_MS; on timeout we proceed with what we have.
 */
async function waitForScrapes(platforms: PlatformSlug[], items: ParsedItem[]): Promise<void> {
  const events = getQueueEvents(QUEUE_NAMES.prices);
  if (!events || SCRAPE_WAIT_MS <= 0) return;

  const waits: Promise<unknown>[] = [];
  for (const platform of platforms) {
    for (const item of items) {
      waits.push(
        (async () => {
          const job = await enqueuePriceScrape(platform, item.query);
          if (job) await job.waitUntilFinished(events, SCRAPE_WAIT_MS);
        })().catch(() => undefined)
      );
    }
  }
  await Promise.race([
    Promise.allSettled(waits),
    new Promise((r) => setTimeout(r, SCRAPE_WAIT_MS)),
  ]);
}

export interface CompareOptions {
  items: ParsedItem[];
  userCards: UserCardInput[];
  /** Platforms the user has enabled; defaults to all */
  platforms?: PlatformSlug[];
  /** Platform slugs where the user has already ordered */
  firstOrderDone: string[];
  /** Wait briefly for live scrapes before answering (default true) */
  waitForLive?: boolean;
}

export async function compareCart(opts: CompareOptions): Promise<PlatformResult[]> {
  const slugs =
    opts.platforms && opts.platforms.length > 0
      ? PLATFORMS.filter((p) => opts.platforms!.includes(p.slug))
      : PLATFORMS;

  if (opts.waitForLive !== false) {
    await waitForScrapes(slugs.map((p) => p.slug), opts.items);
  }

  const results = await Promise.all(
    slugs.map(async (config): Promise<PlatformResult> => {
      const items = await Promise.all(opts.items.map((i) => priceItem(config.slug, i)));
      const cartValue = items.reduce((sum, i) => sum + i.lineTotal, 0);
      const deliveryFee = cartValue >= config.freeDeliveryAbove ? 0 : config.deliveryFee;

      const offers = await getActiveOffers(config.slug);
      const isFirstOrder = !opts.firstOrderDone.includes(config.slug);
      const { saving, offer } = getBestOffer(offers, cartValue, opts.userCards, isFirstOrder);

      const query = opts.items.map((i) => i.query).join(", ");
      return {
        platform: config.slug,
        name: config.name,
        color: config.color,
        cartValue,
        deliveryFee,
        saving,
        offer: offer
          ? { id: offer.id, description: offer.description, bankId: offer.bankId, appOnly: offer.appOnly }
          : null,
        effectiveTotal: cartValue + deliveryFee - saving,
        items,
        deepLink: config.searchUrl(query.slice(0, 120)),
        estimated: items.every((i) => i.source === "estimate"),
      };
    })
  );

  return results.sort((a, b) => a.effectiveTotal - b.effectiveTotal);
}
