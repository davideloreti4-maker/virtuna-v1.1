"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { CreditWallListener } from "@/components/app/credit-wall-listener";

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
    </QueryClientProvider>
  );
}
