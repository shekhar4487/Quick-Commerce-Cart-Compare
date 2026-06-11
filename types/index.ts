export type PlatformSlug = "zepto" | "instamart" | "bigbasket" | "flipkart-minutes";

export interface PlatformConfig {
  slug: PlatformSlug;
  name: string;
  color: string;
  /** Flat delivery fee in ₹ */
  deliveryFee: number;
  /** Cart value above which delivery is free (Infinity = never) */
  freeDeliveryAbove: number;
  /** Estimate fallback: relative price level vs market average */
  priceMultiplier: number;
  webUrl: string;
  searchUrl: (query: string) => string;
}

export interface Bank {
  id: string;
  name: string;
  cards: string[];
}

export interface UserCardInput {
  bankId: string;
  bankName?: string;
  cardName: string;
  cardType?: "CREDIT" | "DEBIT";
}

export interface ParsedItem {
  /** Raw line as the user typed it */
  raw: string;
  /** Normalized search query (quantity suffix stripped) */
  query: string;
  quantity: number;
}

export type PriceSource = "live" | "cached" | "estimate";

export interface ItemPrice extends ParsedItem {
  matchedName: string | null;
  unit: string | null;
  /** Unit price in ₹ for ONE of this item */
  price: number;
  /** price * quantity */
  lineTotal: number;
  source: PriceSource;
}

export interface AppliedOffer {
  id: string;
  description: string;
  bankId: string | null;
  appOnly: boolean;
}

export interface PlatformResult {
  platform: PlatformSlug;
  name: string;
  color: string;
  cartValue: number;
  deliveryFee: number;
  saving: number;
  offer: AppliedOffer | null;
  effectiveTotal: number;
  items: ItemPrice[];
  deepLink: string;
  /** true when every item price came from estimates (no live/cached data) */
  estimated: boolean;
}

export interface CompareResponse {
  id: string;
  results: PlatformResult[];
  bestApp: string;
  totalSaved: number;
  remainingComparisons: number | null; // null = unlimited (Pro)
}

export interface ScrapedProduct {
  name: string;
  price: number;
  unit: string | null;
  url: string | null;
}
