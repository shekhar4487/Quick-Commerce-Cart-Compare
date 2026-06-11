import type { Page } from "playwright";
import type { ScrapedProduct } from "@/types";
import { extractProducts, parsePrice } from "./browser";
import { getPlatform } from "@/lib/platforms";

/**
 * Zepto web search. Product cards are <a href="/pn/..."> links.
 * NOTE: Zepto gates on delivery location; the Bengaluru geolocation set in
 * browser.ts is usually enough for the search page to render a default store.
 */
export async function scrapeZepto(page: Page, query: string): Promise<ScrapedProduct[]> {
  const url = getPlatform("zepto")!.searchUrl(query);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector('a[href*="/pn/"]', { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(1500); // let lazy prices hydrate

  const raw = await extractProducts(page, {
    linkSelector: 'a[href*="/pn/"]',
    nameSelector: '[data-testid="product-card-name"]',
  });

  return raw.flatMap((r) => {
    const price = parsePrice(r.priceText);
    if (!price) return [];
    const unit = r.name.match(/(\d+(?:\.\d+)?\s*(?:kg|g|gm|l|ltr|ml)|\d+\s*(?:pcs?|pack))/i)?.[0] ?? null;
    return [{ name: r.name, price, unit, url: r.href ? `https://www.zeptonow.com${r.href}` : null }];
  });
}
