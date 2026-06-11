import type { Page } from "playwright";
import type { ScrapedProduct } from "@/types";
import { getPlatform } from "@/lib/platforms";

/**
 * Swiggy Instamart search. Instamart's web app renders product tiles inside
 * data-testid containers; prices live in <div data-testid="item-offer-price">
 * (or fall back to ₹-regex on the tile text). Location is required — Swiggy
 * usually honours browser geolocation on first load.
 */
export async function scrapeInstamart(page: Page, query: string): Promise<ScrapedProduct[]> {
  const url = getPlatform("instamart")!.searchUrl(query);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page
    .waitForSelector('[data-testid*="item"], [data-testid*="product"]', { timeout: 15000 })
    .catch(() => undefined);
  await page.waitForTimeout(2000);

  return page.evaluate(() => {
    const out: { name: string; price: number; unit: string | null; url: string | null }[] = [];
    const tiles = Array.from(
      document.querySelectorAll('[data-testid="default_container_ux4"], [data-testid*="item-card"]')
    );
    // Fallback: any element that looks like a product tile.
    const candidates = tiles.length
      ? tiles
      : Array.from(document.querySelectorAll("div")).filter(
          (d) => d.childElementCount > 1 && /₹\s*\d/.test(d.textContent ?? "") && (d.textContent ?? "").length < 400
        );

    for (const tile of candidates.slice(0, 8)) {
      const text = (tile as HTMLElement).innerText ?? "";
      const priceMatch = text.match(/₹\s*([\d,]+(?:\.\d{1,2})?)/);
      if (!priceMatch) continue;
      const price = parseFloat(priceMatch[1].replace(/,/g, ""));
      if (!Number.isFinite(price) || price <= 0) continue;
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      const name =
        lines.filter((l) => l.length > 3 && !l.includes("₹") && !/^(ADD|\d+% OFF|\d+ MINS?)/i.test(l)).sort((a, b) => b.length - a.length)[0] ?? "";
      if (!name) continue;
      const unit = text.match(/(\d+(?:\.\d+)?\s*(?:kg|g|gm|l|ltr|ml)|\d+\s*(?:pcs?|pack))/i)?.[0] ?? null;
      if (!out.some((p) => p.name === name)) out.push({ name, price, unit, url: null });
    }
    return out;
  });
}
