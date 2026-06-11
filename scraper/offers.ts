import type { Page } from "playwright";
import type { PlatformSlug } from "@/types";
import { getPlatform, BANKS } from "@/lib/platforms";
import { withPage } from "./browser";

export interface ScrapedOffer {
  platform: PlatformSlug;
  bankId: string | null;
  description: string;
  offerType: "PERCENT" | "FLAT";
  discountValue: number;
  maxDiscount: number;
  minOrder: number;
}

/**
 * Scrapes bank-offer banners from a platform's offers/home surface and parses
 * them into structured offers with regexes like:
 *   "10% off up to ₹100 on Axis Bank cards, min order ₹299"
 *   "Flat ₹50 off on orders above ₹399"
 *
 * Parsing is conservative: anything that doesn't yield a complete offer is
 * dropped, and scraped offers are written with source="scraped" so the seeded
 * set is never clobbered. Offer surfaces frequently require a logged-in
 * session — expect this to need per-platform maintenance.
 */
export async function scrapeOffers(platform: PlatformSlug): Promise<ScrapedOffer[]> {
  const config = getPlatform(platform);
  if (!config) return [];
  try {
    return await withPage(async (page: Page) => {
      await page.goto(config.webUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2500);

      const texts = await page.$$eval("*", (els) =>
        els
          .filter((el) => {
            const t = el.textContent ?? "";
            return t.length < 200 && /off|cashback|discount/i.test(t) && /₹|%/.test(t) && el.children.length === 0;
          })
          .map((el) => (el.textContent ?? "").trim())
      );

      const offers: ScrapedOffer[] = [];
      for (const text of Array.from(new Set(texts))) {
        const parsed = parseOfferText(platform, text);
        if (parsed) offers.push(parsed);
      }
      return offers;
    });
  } catch (e) {
    console.error(`[offers:${platform}] failed:`, (e as Error).message);
    return [];
  }
}

export function parseOfferText(platform: PlatformSlug, text: string): ScrapedOffer | null {
  const bank = BANKS.find((b) => text.toLowerCase().includes(b.name.toLowerCase().replace(" bank", "")));
  const minOrder = parseInt(text.match(/(?:above|min(?:imum)?(?:\s+order)?)\s*₹?\s*([\d,]+)/i)?.[1]?.replace(/,/g, "") ?? "0", 10);

  const percent = text.match(/(\d{1,2})\s*%\s*(?:off|cashback|discount)/i);
  if (percent) {
    const maxDiscount = parseInt(text.match(/up\s*to\s*₹\s*([\d,]+)/i)?.[1]?.replace(/,/g, "") ?? "0", 10);
    if (!maxDiscount) return null;
    return {
      platform,
      bankId: bank?.id ?? null,
      description: text,
      offerType: "PERCENT",
      discountValue: parseInt(percent[1], 10) / 100,
      maxDiscount,
      minOrder,
    };
  }

  const flat = text.match(/(?:flat\s*)?₹\s*([\d,]+)\s*off/i);
  if (flat) {
    const value = parseInt(flat[1].replace(/,/g, ""), 10);
    return {
      platform,
      bankId: bank?.id ?? null,
      description: text,
      offerType: "FLAT",
      discountValue: value,
      maxDiscount: value,
      minOrder,
    };
  }

  return null;
}
