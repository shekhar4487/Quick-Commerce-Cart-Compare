/** Quick logic smoke test: npm exec tsx scripts/smoke-test.ts */
import { parseGroceryList, estimatePrice, unitPrice } from "../lib/grocery";
import { getBestOffer, type OfferLike } from "../lib/offer-engine";

const items = parseGroceryList("Amul Butter 500 gm x2\nTata Salt 1kg\nMilk 1L X 3\n\nOnion 1 kilo");
console.log("parsed:", JSON.stringify(items));
console.log("estimate amul butter 500g:", estimatePrice("amul butter 500g"));
console.log("unitPrice ₹285 per 500g → per 100g:", unitPrice(285, "500 g"));

const offers: OfferLike[] = [
  { id: "a", platform: "zepto", bankId: "axis", cardKeyword: null, description: "10% off up to ₹100 Axis", offerType: "PERCENT", discountValue: 0.1, maxDiscount: 100, minOrder: 299, appOnly: false, firstOrderOnly: false },
  { id: "b", platform: "zepto", bankId: null, cardKeyword: null, description: "Flat ₹50 first order", offerType: "FLAT", discountValue: 50, maxDiscount: 50, minOrder: 399, appOnly: true, firstOrderOnly: true },
];

console.log("axis card, ₹850 cart:", getBestOffer(offers, 850, [{ bankId: "axis", cardName: "ACE" }], false));
console.log("no cards, first order, ₹850:", getBestOffer(offers, 850, [], true));
console.log("no cards, repeat order, ₹850:", getBestOffer(offers, 850, [], false));
console.log("below min order ₹200:", getBestOffer(offers, 200, [{ bankId: "axis", cardName: "ACE" }], true));
