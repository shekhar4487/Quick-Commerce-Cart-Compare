import { chromium, type Browser, type Page } from "playwright";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
];

const VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Runs `fn` with a fresh page in a hardened context: rotated user agent and
 * viewport, Indian locale/timezone, Bengaluru geolocation (quick-commerce
 * sites are location-gated). The browser is always closed, even on failure.
 */
export async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const headless = process.env.SCRAPER_HEADLESS !== "false";
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({
      headless,
      args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
    });
    const context = await browser.newContext({
      userAgent: pick(USER_AGENTS),
      viewport: pick(VIEWPORTS),
      locale: "en-IN",
      timezoneId: "Asia/Kolkata",
      geolocation: { latitude: 12.9716, longitude: 77.5946 },
      permissions: ["geolocation"],
      extraHTTPHeaders: { "Accept-Language": "en-IN,en;q=0.9" },
    });
    // Light stealth: hide the webdriver flag.
    await context.addInitScript(
      "Object.defineProperty(navigator, 'webdriver', { get: () => undefined })"
    );
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    return await fn(page);
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

export interface ExtractConfig {
  /** CSS selector matching product card links */
  linkSelector: string;
  /** Optional selector (within the card) for the product name */
  nameSelector?: string;
  /** Max products to return */
  limit?: number;
}

export interface RawProduct {
  name: string;
  priceText: string;
  href: string | null;
}

/**
 * Generic in-page product extraction. Quick-commerce frontends are
 * obfuscated-class React apps that change layout often, so instead of brittle
 * deep selectors we: find product links, then regex the first ₹-price out of
 * each card's text. Per-platform name selectors refine when available.
 */
export async function extractProducts(page: Page, config: ExtractConfig): Promise<RawProduct[]> {
  return page.$$eval(
    config.linkSelector,
    (els, cfg) => {
      const out: { name: string; priceText: string; href: string | null }[] = [];
      for (const el of els.slice(0, cfg.limit ?? 8)) {
        const text = (el as HTMLElement).innerText ?? "";
        const priceMatch = text.match(/₹\s*([\d,]+(?:\.\d{1,2})?)/);
        if (!priceMatch) continue;
        let name = "";
        if (cfg.nameSelector) {
          name = (el.querySelector(cfg.nameSelector) as HTMLElement | null)?.innerText ?? "";
        }
        if (!name) {
          // Longest line without a ₹ is almost always the product name.
          name =
            text
              .split("\n")
              .map((l) => l.trim())
              .filter((l) => l.length > 3 && !l.includes("₹") && !/^(ADD|\d+% OFF)/i.test(l))
              .sort((a, b) => b.length - a.length)[0] ?? "";
        }
        if (!name) continue;
        out.push({
          name,
          priceText: priceMatch[1],
          href: el.getAttribute("href"),
        });
      }
      return out;
    },
    { nameSelector: config.nameSelector, limit: config.limit }
  );
}

export function parsePrice(priceText: string): number | null {
  const n = parseFloat(priceText.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}
