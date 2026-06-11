import { Skeleton } from "@/components/ui/skeleton";

/** Loading state while prices are scraped/compared. */
export function ResultsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Comparing prices">
      <div className="mb-5 rounded-lg border border-border p-5 text-center">
        <Skeleton className="mx-auto mb-2 h-3 w-20" />
        <Skeleton className="mx-auto mb-2 h-8 w-40" />
        <Skeleton className="mx-auto h-8 w-24" />
        <div className="mt-3 text-[13px] text-muted-foreground/60">
          Scraping live prices from 4 apps… yeh 10-15 second le sakta hai ⏳
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-border bg-card/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="mb-1.5 h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
