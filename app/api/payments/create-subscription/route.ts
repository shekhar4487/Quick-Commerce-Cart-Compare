import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, unauthorized, jsonError, tooMany } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { getRazorpay, PLAN_IDS } from "@/lib/razorpay";

const bodySchema = z.object({ interval: z.enum(["monthly", "yearly"]) });

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const limit = await rateLimit(`subscribe:${user.id}`, 5, 600);
  if (!limit.ok) return tooMany();

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Pick monthly or yearly.");

  const planId = PLAN_IDS[parsed.data.interval]();
  if (!planId) return jsonError("Subscription plans are not configured yet.", 503);

  if (user.plan === "PRO") return jsonError("You are already on Pro.", 409);

  let razorpay;
  try {
    razorpay = getRazorpay();
  } catch {
    return jsonError("Payments are not configured.", 503);
  }

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { razorpayCustomerId: true, email: true, name: true, phone: true },
  });
  if (!profile) return unauthorized();

  // Reuse the Razorpay customer across subscription attempts.
  let customerId = profile.razorpayCustomerId;
  if (!customerId) {
    const customer = await razorpay.customers.create({
      name: profile.name ?? "CartCompare user",
      email: profile.email ?? undefined,
      contact: profile.phone ?? undefined,
      fail_existing: 0,
    });
    customerId = customer.id;
    await prisma.user.update({ where: { id: user.id }, data: { razorpayCustomerId: customerId } });
  }

  const subscription = await razorpay.subscriptions.create({
    plan_id: planId,
    customer_notify: 1,
    // Monthly: 12 billing cycles before re-authorization; yearly: 5.
    total_count: parsed.data.interval === "monthly" ? 12 : 5,
    notes: { userId: user.id, interval: parsed.data.interval },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { razorpaySubscriptionId: subscription.id },
  });

  return NextResponse.json({
    subscriptionId: subscription.id,
    keyId: process.env.RAZORPAY_KEY_ID,
  });
}
