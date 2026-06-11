import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, unauthorized } from "@/lib/api";

/** Last 30 days of comparisons, newest first. */
export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();

  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const history = await prisma.comparisonResult.findMany({
    where: { userId: user.id, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      items: true,
      results: true,
      bestApp: true,
      totalSaved: true,
      createdAt: true,
      list: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ history });
}
