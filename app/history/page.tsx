import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { inr } from "@/lib/utils";
import type { PlatformResult } from "@/types";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/history");

  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const history = await prisma.comparisonResult.findMany({
    where: { userId: session.user.id, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, items: true, results: true, bestApp: true, totalSaved: true, createdAt: true },
  });

  return (
    <div>
      <h1 className="mb-1.5 text-[22px] font-bold tracking-tight">Comparison History</h1>
      <p className="mb-6 text-sm text-muted-foreground">Last 30 days.</p>

      {history.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <div className="mb-2 text-3xl">🛒</div>
          <p className="mb-4 text-sm text-muted-foreground">
            Abhi tak koi comparison nahi. Pehli list compare karo!
          </p>
          <Link
            href="/"
            className="inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
          >
            Compare now →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {history.map((h) => {
            const items = (h.items as { raw: string }[]) ?? [];
            const results = (h.results as unknown as PlatformResult[]) ?? [];
            const best = results[0];
            return (
              <div key={h.id} className="rounded-lg border border-border bg-card p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">
                    🏆 {h.bestApp}
                    {best && <span className="ml-2 text-primary">{inr(best.effectiveTotal)}</span>}
                  </span>
                  <span className="text-xs text-muted-foreground/60">
                    {h.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                </div>
                <div className="truncate text-[13px] text-muted-foreground">
                  {items.map((i) => i.raw).join(" · ")}
                </div>
                {h.totalSaved > 0 && (
                  <div className="mt-1.5 text-xs text-[#00A854]">Saved {inr(h.totalSaved)} vs costliest app</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
