import type { Metadata } from "next";
import { Suspense } from "react";
import { TrendingClient } from "./trending-client";
import { VALID_TABS, type ValidTab } from "@/types/trending";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Trending | Virtuna",
  description: "Discover trending TikTok videos across categories",
};

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function TrendingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tabParam = params.tab || "";
  const defaultTab: ValidTab = VALID_TABS.includes(tabParam as ValidTab)
    ? (tabParam as ValidTab)
    : "breaking-out";

  return (
    <Suspense fallback={<TrendingPageSkeleton />}>
      <TrendingClient defaultTab={defaultTab} />
    </Suspense>
  );
}

/** Full-page skeleton matching the trending page layout shape. */
function TrendingPageSkeleton() {
  return (
    <div className="mx-auto max-w-[1280px] px-6 py-8 md:px-8">
      {/* Heading skeleton */}
      <Skeleton className="h-8 w-48 rounded-lg" />

      {/* Stats bar skeleton */}
      <Skeleton className="mt-3 h-5 w-full max-w-lg rounded-md" />

      {/* Tab bar skeleton */}
      <Skeleton className="mt-6 h-10 w-80 rounded-full" />

      {/* Card grid skeleton */}
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
