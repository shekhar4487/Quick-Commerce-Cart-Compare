import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

interface SubscriptionEntity {
  id: string;
  status: string;
  current_end?: number | null;
  notes?: { userId?: string; interval?: string };
}

/**
 * Razorpay webhook. Configure in the dashboard with the events:
 *   subscription.activated, subscription.charged, subscription.cancelled,
 *   subscription.halted, subscription.completed, subscription.expired
 * Signature is verified on the RAW body — do not parse before verifying.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { event: string; payload?: { subscription?: { entity?: SubscriptionEntity } } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  const sub = event.payload?.subscription?.entity;
  if (!sub) return NextResponse.json({ ok: true, skipped: "no subscription entity" });

  // Resolve the user: prefer the userId we stamped in notes, fall back to the
  // stored subscription id.
  const userId = sub.notes?.userId;
  const where = userId ? { id: userId } : { razorpaySubscriptionId: sub.id };
  const user = await prisma.user.findFirst({ where, select: { id: true } });
  if (!user) return NextResponse.json({ ok: true, skipped: "user not found" });

  switch (event.event) {
    case "subscription.activated":
    case "subscription.charged": {
      const expiresAt = sub.current_end ? new Date(sub.current_end * 1000) : null;
      await prisma.user.update({
        where: { id: user.id },
        data: { plan: "PRO", planExpiresAt: expiresAt, razorpaySubscriptionId: sub.id },
      });
      break;
    }
    case "subscription.cancelled":
    case "subscription.halted":
    case "subscription.completed":
    case "subscription.expired": {
      await prisma.user.update({
        where: { id: user.id },
        data: { plan: "FREE", planExpiresAt: null },
      });
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ ok: true });
}
