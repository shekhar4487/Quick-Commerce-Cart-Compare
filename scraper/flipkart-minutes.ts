import type { Page } from "playwright";
import type { ScrapedProduct } from "@/types";
import { extractProducts, parsePrice } from "./browser";
import { getPlatform } from "@/lib/platforms";

/**
 * Flipkart grocery/Minutes search. Product anchors carry /p/ in the href and
 * the marketplace=GROCERY param keeps results in the grocery catalogue.
 * Flipkart aggressively rotates obfuscated class names — rely on href shape
 * plus ₹-regex extraction only.
 */
export async function scrapeFlipkartMinutes(page: Page, query: string): Promise<ScrapedProduct[]> {
  const url = getPlatform("flipkart-minutes")!.searchUrl(query);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  // Close the login modal if it appears.
  await page.click('button:has-text("✕")', { timeout: 3000 }).catch(() => undefined);
  await page.waitForSelector('a[href*="/p/"]', { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(1500);

  const raw = await extractProducts(page, { linkSelector: 'a[href*="/p/"]' });

  const seen = new Set<string>();
  return raw.flatMap((r) => {
    const price = parsePrice(r.priceText);
    if (!price || seen.has(r.name)) return [];
    seen.add(r.name);
    const unit = r.name.match(/(\d+(?:\.\d+)?\s*(?:kg|g|gm|l|ltr|ml)|\d+\s*(?:pcs?|pack))/i)?.[0] ?? null;
    return [{ name: r.name, price, unit, url: r.href ? `https://www.flipkart.com${r.href}` : null }];
  });
}
