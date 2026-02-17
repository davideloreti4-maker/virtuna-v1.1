"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * Mock authentication guard component.
 *
 * Shows a skeleton loading state briefly (350ms) to simulate
 * an auth check, then renders children. In production, this
 * would verify the user's session with Supabase.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Mock auth check - always resolves to "logged in" after delay
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 350); // Brief delay for polish

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <AppShellSkeleton />;
  }

  return <>{children}</>;
}

/**
 * Skeleton layout matching the app shell structure.
 * Shows while AuthGuard is checking authentication.
 */
function AppShellSkeleton() {
  return (
    <div className="flex h-screen bg-[#0A0A0A]">
      {/* Sidebar skeleton - hidden on mobile */}
      <div className="hidden w-[248px] shrink-0 flex-col border-r border-zinc-800 p-4 md:flex">
        {/* Logo placeholder */}
        <Skeleton className="mb-6 h-6 w-6" />

        {/* Society selector section */}
        <div className="mt-6 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* View selector section */}
        <div className="mt-4 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Create test button */}
        <div className="mt-4">
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom nav items */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>

        {/* Version text */}
        <Skeleton className="mx-auto mt-2 h-3 w-16" />
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 p-6">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-28 rounded-full" />
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>
        </div>

        {/* Main content area */}
        <Skeleton className="mt-4 h-[calc(100%-56px)] w-full rounded-lg" />
      </div>
    </div>
  );
}
