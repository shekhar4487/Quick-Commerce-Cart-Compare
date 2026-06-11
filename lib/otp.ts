import { createHash, randomInt } from "crypto";
import { getRedis } from "@/lib/redis";

const OTP_TTL_SEC = 10 * 60;
const MAX_VERIFY_ATTEMPTS = 5;

export type OtpChannel = "email" | "phone";

export function classifyIdentifier(identifier: string): OtpChannel | null {
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) return "email";
  if (/^\+91[6-9]\d{9}$/.test(identifier)) return "phone";
  return null;
}

/** Accepts "9876543210" / "+919876543210" / "+91 98765 43210" → "+919876543210". */
export function normalizeIdentifier(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.includes("@")) return trimmed;
  const digits = trimmed.replace(/[\s-]/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  return digits;
}

const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const otpKey = (id: string) => `otp:${id}`;
const attemptsKey = (id: string) => `otp:attempts:${id}`;

export async function createAndSendOtp(identifier: string): Promise<{ ok: boolean; error?: string }> {
  const redis = getRedis();
  if (!redis) return { ok: false, error: "OTP login requires Redis (set REDIS_URL)." };

  const channel = classifyIdentifier(identifier);
  if (!channel) return { ok: false, error: "Enter a valid email or +91 mobile number." };

  const code = randomInt(100000, 999999).toString();
  try {
    await redis.set(otpKey(identifier), hash(code), "EX", OTP_TTL_SEC);
    await redis.del(attemptsKey(identifier));
  } catch (e) {
    console.error("[otp] redis write failed:", (e as Error).message);
    return { ok: false, error: "Login service is temporarily unavailable. Try again shortly." };
  }

  try {
    if (channel === "email") {
      await sendEmailOtp(identifier, code);
    } else {
      await sendSmsOtp(identifier, code);
    }
  } catch (e) {
    console.error("[otp] send failed:", (e as Error).message);
    return { ok: false, error: "Could not send the OTP. Try again in a minute." };
  }
  return { ok: true };
}

export async function verifyOtp(identifier: string, code: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  try {
    const attempts = await redis.incr(attemptsKey(identifier));
    if (attempts === 1) await redis.expire(attemptsKey(identifier), OTP_TTL_SEC);
    if (attempts > MAX_VERIFY_ATTEMPTS) return false;

    const stored = await redis.get(otpKey(identifier));
    if (!stored || stored !== hash(code.trim())) return false;

    // Single-use.
    await redis.del(otpKey(identifier), attemptsKey(identifier));
    return true;
  } catch (e) {
    console.error("[otp] redis read failed:", (e as Error).message);
    return false;
  }
}

async function sendEmailOtp(email: string, code: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    devLog(email, code);
    return;
  }
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.OTP_EMAIL_FROM ?? "CartCompare <onboarding@resend.dev>",
    to: email,
    subject: `${code} is your CartCompare login code`,
    text: `Your CartCompare login code is ${code}. It expires in 10 minutes.\n\nIf you didn't request this, ignore this email.`,
  });
}

async function sendSmsOtp(phone: string, code: string): Promise<void> {
  if (!process.env.TWILIO_SID || !process.env.TWILIO_TOKEN) {
    devLog(phone, code);
    return;
  }
  const twilio = (await import("twilio")).default;
  const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
  await client.messages.create({
    to: phone,
    from: process.env.TWILIO_FROM,
    body: `${code} is your CartCompare login code. Valid for 10 minutes.`,
  });
}

function devLog(identifier: string, code: string): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("OTP delivery is not configured (RESEND_API_KEY / TWILIO_SID).");
  }
  console.log(`\n[otp:dev] code for ${identifier}: ${code}\n`);
}
