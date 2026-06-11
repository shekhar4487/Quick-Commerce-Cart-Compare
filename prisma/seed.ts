/**
 * Seeds the Offers table with the launch offer set (migrated from the original
 * cart-compare.jsx prototype). Run: npm run db:seed
 */
import { PrismaClient, OfferType } from "@prisma/client";

const prisma = new PrismaClient();

type SeedOffer = {
  platform: string;
  bankId: string | null;
  cardKeyword: string | null;
  description: string;
  offerType: OfferType;
  discountValue: number;
  maxDiscount: number;
  minOrder: number;
  appOnly?: boolean;
  firstOrderOnly?: boolean;
};

const OFFERS: SeedOffer[] = [
  // Zepto
  { platform: "zepto", bankId: "axis", cardKeyword: null, description: "10% off up to ₹100 on all Axis cards", offerType: "PERCENT", discountValue: 0.1, maxDiscount: 100, minOrder: 299 },
  { platform: "zepto", bankId: "hdfc", cardKeyword: null, description: "5% cashback on HDFC Debit/Credit cards", offerType: "PERCENT", discountValue: 0.05, maxDiscount: 75, minOrder: 199 },
  { platform: "zepto", bankId: null, cardKeyword: null, description: "Flat ₹50 off on orders above ₹399", offerType: "FLAT", discountValue: 50, maxDiscount: 50, minOrder: 399, appOnly: true },
  // Swiggy Instamart
  { platform: "instamart", bankId: "hdfc", cardKeyword: null, description: "15% off up to ₹150 on HDFC cards", offerType: "PERCENT", discountValue: 0.15, maxDiscount: 150, minOrder: 299 },
  { platform: "instamart", bankId: "kotak", cardKeyword: null, description: "10% off up to ₹100 on Kotak cards", offerType: "PERCENT", discountValue: 0.1, maxDiscount: 100, minOrder: 249 },
  { platform: "instamart", bankId: null, cardKeyword: null, description: "Flat ₹75 off on first order above ₹499", offerType: "FLAT", discountValue: 75, maxDiscount: 75, minOrder: 499, appOnly: true, firstOrderOnly: true },
  // BigBasket
  { platform: "bigbasket", bankId: "icici", cardKeyword: null, description: "10% instant discount on ICICI cards", offerType: "PERCENT", discountValue: 0.1, maxDiscount: 200, minOrder: 999 },
  { platform: "bigbasket", bankId: "hdfc", cardKeyword: "Millennia", description: "5% off on HDFC Millennia/Regalia", offerType: "PERCENT", discountValue: 0.05, maxDiscount: 100, minOrder: 599 },
  { platform: "bigbasket", bankId: null, cardKeyword: null, description: "₹100 off on orders above ₹1200", offerType: "FLAT", discountValue: 100, maxDiscount: 100, minOrder: 1200, appOnly: true },
  // Flipkart Minutes
  { platform: "flipkart-minutes", bankId: "axis", cardKeyword: "Flipkart", description: "5% unlimited cashback on Axis Flipkart card", offerType: "PERCENT", discountValue: 0.05, maxDiscount: 500, minOrder: 0 },
  { platform: "flipkart-minutes", bankId: "sbi", cardKeyword: null, description: "10% off up to ₹150 on SBI Credit cards", offerType: "PERCENT", discountValue: 0.1, maxDiscount: 150, minOrder: 399 },
  { platform: "flipkart-minutes", bankId: null, cardKeyword: null, description: "Flat ₹60 off on orders above ₹449", offerType: "FLAT", discountValue: 60, maxDiscount: 60, minOrder: 449, appOnly: true },
];

async function main() {
  // Idempotent: wipe seed-sourced offers and re-insert.
  await prisma.offer.deleteMany({ where: { source: "seed" } });
  await prisma.offer.createMany({
    data: OFFERS.map((o) => ({
      ...o,
      appOnly: o.appOnly ?? false,
      firstOrderOnly: o.firstOrderOnly ?? false,
      source: "seed",
      isActive: true,
    })),
  });
  console.log(`Seeded ${OFFERS.length} offers.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
