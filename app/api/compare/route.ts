import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, unauthorized, jsonError, tooMany, remainingComparisons } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { parseGroceryList } from "@/lib/grocery";
import { compareCart } from "@/lib/compare";
import { PLATFORM_SLUGS } from "@/lib/platforms";
import type { CompareResponse, PlatformSlug } from "@/types";

export const maxDuration = 60; // allow time for the live-scrape wait

const bodySchema = z.object({
  /** Raw grocery list text, one item per line */
  text: z.string().min(1).max(4000),
  listId: z.string().cuid().optional(),
  platforms: z.array(z.enum(PLATFORM_SLUGS as [string, ...string[]])).optional(),
});

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const ipLimit = await rateLimit(`compare:ip:${clientIp(req)}`, 30, 60);
  const userLimit = await rateLimit(`compare:user:${user.id}`, 15, 60);
  if (!ipLimit.ok || !userLimit.ok) return tooMany();

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Send a grocery list with at least one item.");

  const items = parseGroceryList(parsed.data.text);
  if (items.length === 0) return jsonError("Your list is empty.");

  // Plan gate: Free = 5 comparisons per calendar month.
  const remainingBefore = await remainingComparisons(user);
  if (remainingBefore !== null && remainingBefore <= 0) {
    return jsonError("Free plan limit reached (5/month). Upgrade to Pro for unlimited comparisons.", 402);
  }

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { firstOrderDone: true, preferredPlatforms: true, cards: { select: { bankId: true, cardName: true } } },
  });
  if (!profile) return unauthorized();

  const platforms =
    parsed.data.platforms ??
    (profile.preferredPlatforms.length > 0 ? profile.preferredPlatforms : undefined);

  const results = await compareCart({
    items,
    userCards: profile.cards,
    platforms: platforms as PlatformSlug[] | undefined,
    firstOrderDone: profile.firstOrderDone,
  });

  if (results.length === 0) return jsonError("No platforms enabled. Check your profile settings.");

  const best = results[0];
  const worst = results[results.length - 1];
  const totalSaved = worst.effectiveTotal - best.effectiveTotal;

  const saved = await prisma.comparisonResult.create({
    data: {
      userId: user.id,
      listId: parsed.data.listId,
      items: items as object[],
      results: results as unknown as object[],
      bestApp: best.name,
      totalSaved,
    },
    select: { id: true },
  });

  const response: CompareResponse = {
    id: saved.id,
    results,
    bestApp: best.name,
    totalSaved,
    remainingComparisons: remainingBefore === null ? null : remainingBefore - 1,
  };
  return NextResponse.json(response);
}
