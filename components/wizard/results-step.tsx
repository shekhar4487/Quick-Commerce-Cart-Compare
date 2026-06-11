"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { inr, cn } from "@/lib/utils";
import type { CompareResponse } from "@/types";
import { Loader2, Sparkles } from "lucide-react";

interface Props {
  data: CompareResponse;
  groceryText: string;
  plan: "FREE" | "PRO";
  onEditList: () => void;
}

/** Step 3 — comparison results, migrated from the prototype. */
export function ResultsStep({ data, groceryText, plan, onEditList }: Props) {
  const [autoAdding, setAutoAdding] = useState(false);
  const { results } = data;
  const best = results[0];
  const worst = results[results.length - 1];
  const spread = worst.effectiveTotal - best.effectiveTotal;
  const items = groceryText.split("\n").map((l) => l.trim()).filter(Boolean);
  const anyEstimated = results.some((r) => r.estimated);

  const openBest = () => window.open(best.deepLink, "_blank", "noopener,noreferrer");

  const autoAdd = async () => {
    setAutoAdding(true);
    try {
      const res = await fetch("/api/cart/auto-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: best.platform, items }),
      });
      const body = await res.json();
      if (res.ok) {
        toast.success("Auto cart-add queued! Items will be in your cart shortly.");
        openBest();
      } else {
        toast.error(body.error ?? "Auto-add failed.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setAutoAdding(false);
    }
  };

  return (
    <div>
      {/* Winner banner */}
      <div className="mb-5 rounded-lg border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/[0.03] p-5 text-center">
        <div className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-primary">🏆 Best Deal</div>
        <div className="mb-1 text-[26px] font-extrabold tracking-tight">{best.name}</div>
        <div className="text-[28px] font-extrabold text-primary">{inr(best.effectiveTotal)}</div>
        {best.saving > 0 && (
          <div className="mt-1 text-[13px] text-[#5A7A5E]">Saving {inr(best.saving)} vs no-offer price</div>
        )}
        {spread > 0 && (
          <Badge className="mt-2">{inr(spread)} cheaper than most expensive option</Badge>
        )}
      </div>

      {anyEstimated && (
        <div className="mb-4 rounded-md border border-[#1A3040] bg-[#0D1A1F] px-3.5 py-3 text-[13px] leading-relaxed text-[#5A8A9F]">
          ℹ️ Some prices are estimates — live scraping is still warming up for these items. Re-run in a minute for fresher numbers.
        </div>
      )}

      {/* All results */}
      <div className="mb-6 flex flex-col gap-2.5">
        {results.map((r, i) => (
          <div
            key={r.platform}
            className={cn(
              "rounded-lg border p-4",
              i === 0 ? "border-primary/20 bg-primary/[0.04]" : "border-border bg-card/60"
            )}
          >
            <div className="mb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
                <span className="text-[15px] font-semibold">{r.name}</span>
                {i === 0 && <Badge>Best</Badge>}
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">{inr(r.effectiveTotal)}</div>
                {i > 0 && (
                  <div className="text-xs text-[#FF6B6B]">+{inr(r.effectiveTotal - best.effectiveTotal)} more</div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1 text-xs text-muted-foreground/70">
              <div className="flex justify-between">
                <span>Cart value</span>
                <span className="text-muted-foreground">{inr(r.cartValue)}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery</span>
                {r.deliveryFee > 0 ? (
                  <span className="text-muted-foreground">+{inr(r.deliveryFee)}</span>
                ) : (
                  <span className="text-primary">Free</span>
                )}
              </div>
              {r.saving > 0 && r.offer ? (
                <div className="mt-1.5 flex justify-between border-t border-border pt-1.5 text-[#00A854]">
                  <span>🏷️ {r.offer.description}</span>
                  <span className="shrink-0 pl-2">-{inr(r.saving)}</span>
                </div>
              ) : (
                <div className="mt-1 italic text-muted-foreground/50">No eligible offers for your cards</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Items compared */}
      {items.length > 0 && (
        <div className="mb-5 rounded-lg border border-border bg-card/60 p-4">
          <div className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            Your List
          </div>
          {items.map((item, i) => (
            <div
              key={i}
              className={cn("py-1 text-sm text-foreground/60", i < items.length - 1 && "border-b border-border/50")}
            >
              {item}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2.5">
        <Button variant="outline" className="flex-1" onClick={onEditList}>
          Edit List
        </Button>
        <Button className="flex-[3]" onClick={openBest}>
          Open {best.name} →
        </Button>
      </div>

      {plan === "PRO" ? (
        <Button variant="outline" className="mt-2.5 w-full border-primary/30 text-primary" onClick={autoAdd} disabled={autoAdding}>
          {autoAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Auto-add items to {best.name} cart
        </Button>
      ) : (
        <a
          href="/pricing"
          className="mt-3 block text-center text-[13px] text-muted-foreground/60 transition-colors hover:text-primary"
        >
          ✨ Pro members get one-tap auto cart-add — upgrade for ₹99/mo
        </a>
      )}

      {data.remainingComparisons !== null && (
        <div className="mt-4 text-center text-xs text-muted-foreground/50">
          {data.remainingComparisons} free comparison{data.remainingComparisons === 1 ? "" : "s"} left this month
        </div>
      )}
    </div>
  );
}
