import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route skeleton for /referrals. Mirrors the page's centered `max-w-4xl`
 * column: title, a referral-code hero card, a row of stat tiles, then a
 * referred-users list. Container matches the page so there is no layout shift.
 */
export default function ReferralsLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:p-6 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      {/* Referral-code hero card */}
      <Skeleton className="h-24 w-full rounded-xl" />

      {/* Stat tiles */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>

      {/* Referred-users list */}
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
