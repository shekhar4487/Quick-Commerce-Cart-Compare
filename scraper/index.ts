import Fuse from "fuse.js";
import type { Page } from "playwright";
import type { PlatformSlug, ScrapedProduct } from "@/types";
import { parseUnit } from "@/lib/grocery";
import { withPage } from "./browser";
import { scrapeZepto } from "./zepto";
import { scrapeInstamart } from "./instamart";
import { scrapeBigBasket } from "./bigbasket";
import { scrapeFlipkartMinutes } from "./flipkart-minutes";

const SCRAPERS: Record<PlatformSlug, (page: Page, query: string) => Promise<ScrapedProduct[]>> = {
  zepto: scrapeZepto,
  instamart: scrapeInstamart,
  bigbasket: scrapeBigBasket,
  "flipkart-minutes": scrapeFlipkartMinutes,
};

/**
 * Scrapes search results for a query on one platform. Returns [] on any
 * failure (timeout, captcha, layout change) — callers treat empty as a soft
 * miss and keep serving the last cached price.
 */
export async function scrapeSearch(platform: PlatformSlug, query: string): Promise<ScrapedProduct[]> {
  const scraper = SCRAPERS[platform];
  if (!scraper) return [];
  try {
    return await withPage((page) => scraper(page, query));
  } catch (e) {
    console.error(`[scraper:${platform}] "${query}" failed:`, (e as Error).message);
    return [];
  }
}

/**
 * Picks the product that best matches the user's query, fuzzy-matched with
 * Fuse.js so "amul butter 500g" matches "Amul Butter - Pasteurised, 500 g".
 * When the query specifies a size, products within ±25% of that size are
 * strongly preferred (stops a 100g pack winning a 500g query on name alone).
 */
export function pickBestMatch(products: ScrapedProduct[], query: string): ScrapedProduct | null {
  if (products.length === 0) return null;

  const fuse = new Fuse(products, { keys: ["name"], threshold: 0.55, includeScore: true });
  const ranked = fuse.search(query);
  if (ranked.length === 0) return products[0];

  const wantedUnit = parseUnit(query);
  if (wantedUnit) {
    const sized = ranked.filter((r) => {
      const u = parseUnit(r.item.unit ?? r.item.name);
      return u && u.base === wantedUnit.base && Math.abs(u.amount - wantedUnit.amount) / wantedUnit.amount <= 0.25;
    });
    if (sized.length > 0) return sized[0].item;
  }

  return ranked[0].item;
}
