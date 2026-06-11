import type { Page } from "playwright";
import type { ScrapedProduct } from "@/types";
import { extractProducts, parsePrice } from "./browser";
import { getPlatform } from "@/lib/platforms";

/**
 * BigBasket product search (/ps/?q=...). Product cards link to /pd/<sku>/.
 * BigBasket is the most scraper-hostile of the four (Akamai); keep request
 * rates low and expect occasional captcha pages — the worker treats an empty
 * result as a soft failure and keeps the last cached price.
 */
export async function scrapeBigBasket(page: Page, query: string): Promise<ScrapedProduct[]> {
  const url = getPlatform("bigbasket")!.searchUrl(query);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector('a[href*="/pd/"]', { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(1500);

  const raw = await extractProducts(page, {
    linkSelector: 'li a[href*="/pd/"], div a[href*="/pd/"]',
  });

  const seen = new Set<string>();
  return raw.flatMap((r) => {
    const price = parsePrice(r.priceText);
    if (!price || seen.has(r.name)) return [];
    seen.add(r.name);
    const unit = r.name.match(/(\d+(?:\.\d+)?\s*(?:kg|g|gm|l|ltr|ml)|\d+\s*(?:pcs?|pack))/i)?.[0] ?? null;
    return [{ name: r.name, price, unit, url: r.href ? `https://www.bigbasket.com${r.href}` : null }];
  });
}
