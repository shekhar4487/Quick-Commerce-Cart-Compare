"use client";

import { useState } from "react";
import Script from "next/script";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2 } from "lucide-react";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const FREE_FEATURES = ["5 comparisons per month", "All 4 apps compared", "Bank & app offers applied", "Manual cart (deep links)"];
const PRO_FEATURES = [
  "Unlimited comparisons",
  "Auto cart-add on the winning app",
  "Price history graphs",
  "Weekly deal alerts on WhatsApp",
  "Priority live scraping",
];

export default function PricingPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState<"monthly" | "yearly" | null>(null);
  const isPro = session?.user?.plan === "PRO";

  const subscribe = async (interval: "monthly" | "yearly") => {
    if (!session?.user) {
      router.push("/login?callbackUrl=/pricing");
      return;
    }
    setBusy(interval);
    try {
      const res = await fetch("/api/payments/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Could not start the subscription.");
        return;
      }
      if (!window.Razorpay) {
        toast.error("Payment SDK is still loading — try again in a second.");
        return;
      }
      new window.Razorpay({
        key: body.keyId,
        subscription_id: body.subscriptionId,
        name: "CartCompare Pro",
        description: interval === "monthly" ? "₹99/month" : "₹799/year",
        theme: { color: "#00D26A" },
        prefill: { email: session.user.email ?? undefined },
        handler: async () => {
          // Plan flips to PRO when the webhook lands; refresh the session claim.
          toast.success("Payment received! Activating Pro…");
          await update();
          router.refresh();
        },
      }).open();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <h1 className="mb-1.5 text-[22px] font-bold tracking-tight">Simple pricing 💸</h1>
      <p className="mb-7 text-sm text-muted-foreground">
        Ek hi order mein Pro ka paisa wasool — average user saves ₹150+ per comparison.
      </p>

      <div className="flex flex-col gap-4">
        {/* Free */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="mb-1 text-sm font-semibold text-muted-foreground">Free</div>
          <div className="mb-4 text-2xl font-extrabold">
            ₹0 <span className="text-sm font-normal text-muted-foreground">forever</span>
          </div>
          <ul className="space-y-2 text-sm text-foreground/80">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-muted-foreground" /> {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Pro */}
        <div className="relative rounded-lg border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/[0.02] p-5">
          <Badge className="absolute right-4 top-4">Most popular</Badge>
          <div className="mb-1 text-sm font-semibold text-primary">Pro</div>
          <div className="mb-4 text-2xl font-extrabold">
            ₹99<span className="text-sm font-normal text-muted-foreground">/month</span>
            <span className="ml-2 text-sm font-normal text-muted-foreground">or ₹799/year (save 33%)</span>
          </div>
          <ul className="mb-5 space-y-2 text-sm text-foreground/90">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-primary" /> {f}
              </li>
            ))}
          </ul>

          {isPro ? (
            <div className="rounded-md bg-primary/15 py-3 text-center text-sm font-semibold text-primary">
              ✓ You&apos;re on Pro
            </div>
          ) : (
            <div className="flex gap-2.5">
              <Button className="flex-1" onClick={() => subscribe("monthly")} disabled={busy !== null}>
                {busy === "monthly" ? <Loader2 className="h-4 w-4 animate-spin" /> : "₹99/month"}
              </Button>
              <Button variant="outline" className="flex-1 border-primary/40 text-primary" onClick={() => subscribe("yearly")} disabled={busy !== null}>
                {busy === "yearly" ? <Loader2 className="h-4 w-4 animate-spin" /> : "₹799/year"}
              </Button>
            </div>
          )}
        </div>
      </div>

      <p className="mt-5 text-center text-xs text-muted-foreground/60">
        UPI, cards aur netbanking supported · Powered by Razorpay · Cancel anytime
      </p>
    </div>
  );
}
