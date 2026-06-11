import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface SessionUser {
  id: string;
  email?: string | null;
  plan: "FREE" | "PRO";
}

/** Returns the authenticated user from the NextAuth JWT session, or null. */
export async function requireUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return { id: session.user.id, email: session.user.email, plan: session.user.plan ?? "FREE" };
}

export function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export const unauthorized = () => jsonError("Sign in required.", 401);
export const tooMany = () => jsonError("Too many requests. Slow down.", 429);

export const FREE_COMPARISONS_PER_MONTH = 5;

/** Comparisons remaining this calendar month; null = unlimited (Pro). */
export async function remainingComparisons(user: SessionUser): Promise<number | null> {
  if (user.plan === "PRO") return null;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const used = await prisma.comparisonResult.count({
    where: { userId: user.id, createdAt: { gte: monthStart } },
  });
  return Math.max(0, FREE_COMPARISONS_PER_MONTH - used);
}
