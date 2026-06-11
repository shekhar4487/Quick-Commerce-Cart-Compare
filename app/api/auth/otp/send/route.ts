import { NextResponse } from "next/server";
import { z } from "zod";
import { createAndSendOtp, normalizeIdentifier } from "@/lib/otp";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { jsonError, tooMany } from "@/lib/api";

const bodySchema = z.object({ identifier: z.string().min(3).max(254) });

export async function POST(req: Request) {
  const ip = clientIp(req);
  const ipLimit = await rateLimit(`otp-send:ip:${ip}`, 10, 600);
  if (!ipLimit.ok) return tooMany();

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Enter a valid email or +91 mobile number.");

  const identifier = normalizeIdentifier(parsed.data.identifier);
  const idLimit = await rateLimit(`otp-send:id:${identifier}`, 3, 600);
  if (!idLimit.ok) return tooMany();

  const result = await createAndSendOtp(identifier);
  if (!result.ok) return jsonError(result.error ?? "Could not send OTP.", 400);

  return NextResponse.json({ ok: true, identifier });
}
