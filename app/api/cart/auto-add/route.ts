import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, unauthorized, jsonError, tooMany } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { enqueueAutoCart } from "@/jobs/queue";
import { PLATFORM_SLUGS } from "@/lib/platforms";

const bodySchema = z.object({
  platform: z.enum(PLATFORM_SLUGS as [string, ...string[]]),
  items: z.array(z.string().min(1).max(120)).min(1).max(30),
});

/** Pro-only: queue a background auto cart-add run on the winning platform. */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  if (user.plan !== "PRO") {
    return jsonError("Auto cart-add is a Pro feature. Upgrade to use it.", 402);
  }

  const limit = await rateLimit(`autocart:${user.id}`, 5, 300);
  if (!limit.ok) return tooMany();

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid auto-cart payload.");

  const job = await enqueueAutoCart({ ...parsed.data, userId: user.id });
  if (!job) return jsonError("Background jobs are unavailable right now.", 503);

  return NextResponse.json({ ok: true, jobId: job.id });
}
