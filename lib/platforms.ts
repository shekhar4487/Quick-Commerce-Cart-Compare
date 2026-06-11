import type { Bank, PlatformConfig, PlatformSlug } from "@/types";

export const BANKS: Bank[] = [
  { id: "hdfc", name: "HDFC Bank", cards: ["Credit Card", "Debit Card", "Millennia", "Regalia", "Diners Club"] },
  { id: "sbi", name: "SBI", cards: ["Credit Card", "Debit Card", "SimplyCLICK", "Elite", "BPCL"] },
  { id: "icici", name: "ICICI Bank", cards: ["Credit Card", "Debit Card", "Amazon Pay", "Coral", "Sapphiro"] },
  { id: "axis", name: "Axis Bank", cards: ["Credit Card", "Debit Card", "Flipkart", "ACE", "Magnus"] },
  { id: "kotak", name: "Kotak Bank", cards: ["Credit Card", "Debit Card", "811", "League", "White"] },
  { id: "idfc", name: "IDFC First", cards: ["Credit Card", "Debit Card", "Wealth", "Select"] },
  { id: "amex", name: "Amex", cards: ["Gold", "Platinum", "Membership Rewards", "SmartEarn"] },
  { id: "rbl", name: "RBL Bank", cards: ["Credit Card", "Debit Card", "Shoprite", "Popcorn"] },
];

export const PLATFORMS: PlatformConfig[] = [
  {
    slug: "zepto",
    name: "Zepto",
    color: "#8B5CF6",
    deliveryFee: 25,
    freeDeliveryAbove: 1499,
    priceMultiplier: 1,
    webUrl: "https://www.zeptonow.com",
    searchUrl: (q) => `https://www.zeptonow.com/search?query=${encodeURIComponent(q)}`,
  },
  {
    slug: "instamart",
    name: "Swiggy Instamart",
    color: "#FC8019",
    deliveryFee: 30,
    freeDeliveryAbove: Infinity,
    priceMultiplier: 1.03,
    webUrl: "https://www.swiggy.com/instamart",
    searchUrl: (q) => `https://www.swiggy.com/instamart/search?custom_back=true&query=${encodeURIComponent(q)}`,
  },
  {
    slug: "bigbasket",
    name: "BigBasket",
    color: "#84CC16",
    deliveryFee: 0,
    freeDeliveryAbove: 0,
    priceMultiplier: 0.97,
    webUrl: "https://www.bigbasket.com",
    searchUrl: (q) => `https://www.bigbasket.com/ps/?q=${encodeURIComponent(q)}`,
  },
  {
    slug: "flipkart-minutes",
    name: "Flipkart Minutes",
    color: "#3B82F6",
    deliveryFee: 20,
    freeDeliveryAbove: 999,
    priceMultiplier: 1.02,
    webUrl: "https://www.flipkart.com/flipkart-minutes-store",
    searchUrl: (q) => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}&marketplace=GROCERY`,
  },
];

export const PLATFORM_SLUGS = PLATFORMS.map((p) => p.slug) as PlatformSlug[];

export function getPlatform(slug: string): PlatformConfig | undefined {
  return PLATFORMS.find((p) => p.slug === slug);
}

export function getBank(id: string): Bank | undefined {
  return BANKS.find((b) => b.id === id);
}
