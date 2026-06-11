import type { PlatformSlug } from "@/types";
import { getPlatform } from "@/lib/platforms";
import { withPage } from "./browser";

export interface AutoCartResult {
  platform: PlatformSlug;
  added: string[];
  failed: string[];
}

/**
 * Pro feature: opens the winning platform and adds each list item to the cart
 * (first search result). The user then just logs in / checks out.
 *
 * HONEST LIMITATION — adding to a *user's* cart requires the user's own
 * session on that platform. This runs against an anonymous browser session:
 * Zepto/Instamart bind carts to a logged-in account, so for those platforms
 * the practical UX is the deep link the API already returns; BigBasket and
 * Flipkart keep anonymous carts in cookies, which only helps if the browser
 * runs on the user's machine (e.g. a future browser-extension companion).
 * The flow below is the working skeleton for that extension/local-agent mode,
 * and runs headful locally for demos (SCRAPER_HEADLESS=false).
 */
export async function autoAddToCart(platform: PlatformSlug, items: string[]): Promise<AutoCartResult> {
  const config = getPlatform(platform);
  const result: AutoCartResult = { platform, added: [], failed: [] };
  if (!config) return { ...result, failed: items };

  try {
    await withPage(async (page) => {
      for (const item of items) {
        try {
          await page.goto(config.searchUrl(item), { waitUntil: "domcontentloaded", timeout: 30000 });
          await page.waitForTimeout(2000);
          // Every platform renders an ADD button on product tiles.
          const addButton = page.locator('button:has-text("ADD"), button:has-text("Add")').first();
          await addButton.click({ timeout: 8000 });
          await page.waitForTimeout(800);
          result.added.push(item);
        } catch {
          result.failed.push(item);
        }
      }
    });
  } catch {
    result.failed.push(...items.filter((i) => !result.added.includes(i) && !result.failed.includes(i)));
  }

  return result;
}
