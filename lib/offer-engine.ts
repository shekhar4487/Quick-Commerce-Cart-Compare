import { prisma } from "@/lib/prisma";
import { cacheGet, cacheSet, offersCacheKey, OFFERS_CACHE_TTL_SEC } from "@/lib/redis";
import type { UserCardInput } from "@/types";

export interface OfferLike {
  id: string;
  platform: string;
  bankId: string | null;
  cardKeyword: string | null;
  description: string;
  offerType: "PERCENT" | "FLAT";
  discountValue: number;
  maxDiscount: number;
  minOrder: number;
  appOnly: boolean;
  firstOrderOnly: boolean;
}

/**
 * Core offer engine — direct migration of getBestOffer() from the prototype,
 * extended with first-order eligibility.
 *
 * Eligibility checks, in order:
 *   1. cart value >= minimum order
 *   2. first-order offers only apply when the user hasn't ordered on the platform
 *   3. bank offers require a matching saved card (and cardKeyword when set)
 * Then picks the single highest-saving offer.
 */
export function getBestOffer(
  offers: OfferLike[],
  cartValue: number,
  userCards: UserCardInput[],
  isFirstOrder: boolean
): { saving: number; offer: OfferLike | null } {
  let bestSaving = 0;
  let bestOffer: OfferLike | null = null;

  for (const offer of offers) {
    if (cartValue < offer.minOrder) continue;
    if (offer.firstOrderOnly && !isFirstOrder) continue;

    if (offer.bankId) {
      const hasBank = userCards.some((c) => c.bankId === offer.bankId);
      if (!hasBank) continue;
      if (offer.cardKeyword) {
        const kw = offer.cardKeyword.toLowerCase();
        const hasCard = userCards.some(
          (c) => c.bankId === offer.bankId && c.cardName.toLowerCase().includes(kw)
        );
        if (!hasCard) continue;
      }
    }

    const saving =
      offer.offerType === "PERCENT"
        ? Math.min(cartValue * offer.discountValue, offer.maxDiscount)
        : Math.min(offer.discountValue, offer.maxDiscount);

    if (saving > bestSaving) {
      bestSaving = saving;
      bestOffer = offer;
    }
  }

  return { saving: Math.round(bestSaving), offer: bestOffer };
}

/** Active offers for a platform, cached in Redis for 15 minutes. */
export async function getActiveOffers(platform: string): Promise<OfferLike[]> {
  const key = offersCacheKey(platform);
  const cached = await cacheGet(key);
  if (cached) {
    try {
      return JSON.parse(cached) as OfferLike[];
    } catch {
      /* fall through to DB */
    }
  }

  const rows = await prisma.offer.findMany({
    where: {
      platform,
      isActive: true,
      OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
    },
  });

  const offers: OfferLike[] = rows.map((r) => ({
    id: r.id,
    platform: r.platform,
    bankId: r.bankId,
    cardKeyword: r.cardKeyword,
    description: r.description,
    offerType: r.offerType,
    discountValue: r.discountValue,
    maxDiscount: r.maxDiscount,
    minOrder: r.minOrder,
    appOnly: r.appOnly,
    firstOrderOnly: r.firstOrderOnly,
  }));

  await cacheSet(key, JSON.stringify(offers), OFFERS_CACHE_TTL_SEC);
  return offers;
}
