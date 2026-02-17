"use client";

import { useTransition } from "react";
import { retryScrape } from "@/app/actions/competitors/retry-scrape";

interface ScrapeErrorBannerProps {
  handle: string;
}

export function ScrapeErrorBanner({ handle }: ScrapeErrorBannerProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="border border-red-500/20 bg-red-500/[0.05] rounded-lg p-3 flex items-center justify-between">
      <span className="text-sm text-red-400">Data refresh failed</span>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            await retryScrape(handle);
          });
        }}
        className="text-xs font-medium px-3 py-1.5 rounded-lg border border-white/[0.06] text-foreground hover:bg-white/[0.02] disabled:opacity-50 transition-colors"
      >
        {isPending ? "Retrying..." : "Retry"}
      </button>
    </div>
  );
}
