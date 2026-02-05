"use client";

import type { ValidTab } from "@/types/trending";

interface TrendingClientProps {
  defaultTab: ValidTab;
}

/** Trending page client shell -- stub for Task 1 verification, replaced in Task 2. */
export function TrendingClient({ defaultTab }: TrendingClientProps) {
  return (
    <div className="mx-auto max-w-[1280px] px-6 py-8 md:px-8">
      <p className="text-foreground">Trending — {defaultTab}</p>
    </div>
  );
}
