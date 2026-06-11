import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "crypto";

let client: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).");
  }
  client ??= new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  return client;
}

export const PLAN_IDS = {
  monthly: () => process.env.RAZORPAY_PLAN_MONTHLY ?? "",
  yearly: () => process.env.RAZORPAY_PLAN_YEARLY ?? "",
};

/** Constant-time verification of the X-Razorpay-Signature webhook header. */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
