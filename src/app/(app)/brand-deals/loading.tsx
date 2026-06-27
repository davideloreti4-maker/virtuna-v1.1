import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route skeleton for /brand-deals. Mirrors BrandDealsPage: a title, the
 * tab bar (Deals / Affiliates / Earnings), then a grid of deal cards.
 * Container matches the page's `p-4 sm:p-6 space-y-6` root — no layout shift.
 */
export default function BrandDealsLoading() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <Skeleton className="h-8 w-48" />

      {/* Tab bar */}
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-lg" />
        ))}
      </div>

      {/* Deal cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
