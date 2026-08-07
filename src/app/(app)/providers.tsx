"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { CreditWallListener } from "@/components/app/credit-wall-listener";
import { OfflineNotice } from "@/components/app/offline-notice";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* The credit 402 wall — one mount behind every paid surface (lib/billing/credit-wall.ts). */}
      <CreditWallListener />
      {/* The standing offline condition — renders nothing at all while online. It carries its own
          mobile offset, so it does not depend on being mounted inside <main>. */}
      <OfflineNotice />
    </QueryClientProvider>
  );
}
