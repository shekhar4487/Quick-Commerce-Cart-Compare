import Fuse from "fuse.js";
import type { ParsedItem } from "@/types";

/**
 * Parses a free-text grocery list (one item per line) into normalized items.
 * Supports quantity suffixes: "Milk 1L x2", "Onion 1kg X 3", "Bread *2".
 */
export function parseGroceryList(text: string): ParsedItem[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 30) // hard cap to keep scrape fan-out bounded
    .map((raw) => {
      let quantity = 1;
      let query = raw;
      const qtyMatch = raw.match(/[x*]\s*(\d{1,2})\s*$/i);
      if (qtyMatch) {
        quantity = Math.max(1, parseInt(qtyMatch[1], 10));
        query = raw.slice(0, qtyMatch.index).trim();
      }
      return { raw, query: normalizeQuery(query), quantity };
    });
}

/** Lowercase, collapse whitespace, normalize unit spellings ("500 gm" → "500g"). */
export function normalizeQuery(q: string): string {
  return q
    .toLowerCase()
    .replace(/(\d+(?:\.\d+)?)\s*(kgs?|kilo(?:gram)?s?)\b/g, "$1kg")
    .replace(/(\d+(?:\.\d+)?)\s*(gms?|grams?|g)\b/g, "$1g")
    .replace(/(\d+(?:\.\d+)?)\s*(ltrs?|litres?|liters?|l)\b/g, "$1l")
    .replace(/(\d+(?:\.\d+)?)\s*(mls?|millilitres?)\b/g, "$1ml")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parses a unit string out of a product name/label and returns the size in a
 * base unit (grams or ml). Used for ₹-per-100g normalization so "Amul Butter
 * 500g" and "Amul Butter 500 gm" compare correctly.
 */
export function parseUnit(text: string): { amount: number; base: "g" | "ml" } | null {
  const m = text.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(kg|g|gm|gms|l|ltr|litre|ml)\b/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  switch (m[2]) {
    case "kg":
      return { amount: n * 1000, base: "g" };
    case "g":
    case "gm":
    case "gms":
      return { amount: n, base: "g" };
    case "l":
    case "ltr":
    case "litre":
      return { amount: n * 1000, base: "ml" };
    case "ml":
      return { amount: n, base: "ml" };
    default:
      return null;
  }
}

/** ₹ per 100g/100ml, or null when the unit can't be parsed. */
export function unitPrice(price: number, text: string): number | null {
  const u = parseUnit(text);
  if (!u || u.amount <= 0) return null;
  return Math.round((price / u.amount) * 100 * 100) / 100;
}

// ── Estimate fallback ─────────────────────────────────────────────────────────
// Used when there is no live or cached price yet (first ever query, scraper
// blocked, Redis down…). Approximate Indian MRPs, June 2026.

const ESTIMATED_PRICES: Record<string, number> = {
  "amul butter 500g": 285,
  "amul butter 100g": 62,
  "tata salt 1kg": 30,
  "aashirvaad atta 5kg": 270,
  "aashirvaad atta 10kg": 525,
  "fortune sunflower oil 1l": 145,
  "milk 500ml": 30,
  "milk 1l": 60,
  "amul taaza 1l": 75,
  "curd 400g": 35,
  "paneer 200g": 95,
  "bread": 45,
  "brown bread": 55,
  "eggs 6": 48,
  "eggs 12": 95,
  "eggs 30": 210,
  "onion 1kg": 40,
  "potato 1kg": 35,
  "tomato 1kg": 45,
  "ginger 100g": 20,
  "garlic 100g": 30,
  "banana 6": 40,
  "apple 1kg": 180,
  "maggi 12 pack": 168,
  "maggi": 15,
  "tata tea gold 500g": 290,
  "nescafe classic 100g": 350,
  "sugar 1kg": 48,
  "basmati rice 5kg": 580,
  "sona masoori rice 5kg": 380,
  "toor dal 1kg": 165,
  "moong dal 1kg": 140,
  "chana dal 1kg": 110,
  "besan 1kg": 95,
  "poha 500g": 45,
  "surf excel 1kg": 145,
  "vim bar": 10,
  "colgate 200g": 115,
  "dettol handwash 750ml": 99,
  "harpic 1l": 192,
};

const estimateFuse = new Fuse(
  Object.keys(ESTIMATED_PRICES).map((name) => ({ name })),
  { keys: ["name"], threshold: 0.45, includeScore: true }
);

const DEFAULT_ESTIMATE = 80;

/** Best-effort price estimate for an unknown grocery query. */
export function estimatePrice(query: string): number {
  const hit = estimateFuse.search(query)[0];
  if (hit) return ESTIMATED_PRICES[hit.item.name];
  return DEFAULT_ESTIMATE;
}
