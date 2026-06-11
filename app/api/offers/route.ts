import { NextResponse } from "next/server";
import { requireUser, unauthorized, jsonError } from "@/lib/api";
import { isAdminEmail } from "@/lib/auth";
import { getActiveOffers } from "@/lib/offer-engine";
import { cacheDel, offersCacheKey } from "@/lib/redis";
import { enqueueOfferScrape } from "@/jobs/queue";
import { PLATFORM_SLUGS } from "@/lib/platforms";

/**
 * GET /api/offers           → active offers for all platforms
 * GET /api/offers?refresh=1 → (admin) bust the cache + queue offer re-scrapes
 */
export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const url = new URL(req.url);

  if (url.searchParams.get("refresh") === "1") {
    if (!isAdminEmail(user.email)) return jsonError("Admin only.", 403);
    await cacheDel(...PLATFORM_SLUGS.map(offersCacheKey));
    const jobs = await Promise.all(PLATFORM_SLUGS.map((slug) => enqueueOfferScrape(slug)));
    return NextResponse.json({ ok: true, queued: jobs.filter(Boolean).length });
  }

  const platform = url.searchParams.get("platform");
  const slugs = platform && (PLATFORM_SLUGS as string[]).includes(platform) ? [platform] : PLATFORM_SLUGS;

  const offers = Object.fromEntries(
    await Promise.all(slugs.map(async (slug) => [slug, await getActiveOffers(slug)] as const))
  );
  return NextResponse.json({ offers });
}
