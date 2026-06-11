import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeIdentifier, verifyOtp } from "@/lib/otp";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { jsonError, tooMany } from "@/lib/api";

const bodySchema = z.object({
  identifier: z.string().min(3).max(254),
  code: z.string().regex(/^\d{6}$/),
});

/**
 * Standalone OTP check (the NextAuth "otp" credentials provider performs its
 * own verification during signIn — this endpoint exists for pre-validation
 * UX and API clients). NOTE: codes are single-use, so a successful call here
 * consumes the code; web clients should call signIn("otp") directly instead.
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  const limit = await rateLimit(`otp-verify:ip:${ip}`, 15, 600);
  if (!limit.ok) return tooMany();

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid identifier or code format.");

  const ok = await verifyOtp(normalizeIdentifier(parsed.data.identifier), parsed.data.code);
  if (!ok) return jsonError("Incorrect or expired OTP.", 401);

  return NextResponse.json({ ok: true });
}
