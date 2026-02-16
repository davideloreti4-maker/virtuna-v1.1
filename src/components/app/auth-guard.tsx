"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * Client-side authentication guard and loading state handler.
 *
 * The middleware handles primary auth enforcement (redirecting unauth users
 * to /login). This component is the client-side safety net that:
 * 1. Shows the full-page skeleton while checking session
 * 2. Handles edge cases where middleware might not catch (e.g., session expires mid-use)
 * 3. Subscribes to auth state changes for real-time session monitoring
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // Edge case: middleware should have caught this, but handle gracefully
        router.replace("/login");
        return;
      }

      setIsLoading(false);
    }

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT" || !session) {
          // Session expired or user signed out — redirect to landing page
          router.replace("/");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router]);

  if (isLoading) {
    return <AppShellSkeleton />;
  }

  return <>{children}</>;
}

/**
 * Skeleton layout matching the app shell structure.
 * Shows while auth is being verified.
 */
function AppShellSkeleton() {
  return (
    <div className="flex h-screen bg-[#0A0A0A]">
      {/* Sidebar skeleton - hidden on mobile */}
      <div className="hidden w-[248px] shrink-0 flex-col border-r border-zinc-800 p-4 md:flex">
        <Skeleton className="mb-6 h-6 w-6" />
        <div className="mt-6 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="mt-4 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="mt-4">
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="flex-1" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
        <Skeleton className="mx-auto mt-2 h-3 w-16" />
      </div>
      {/* Main content skeleton */}
      <div className="flex-1 p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-28 rounded-full" />
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>
        </div>
        <Skeleton className="mt-4 h-[calc(100%-56px)] w-full rounded-lg" />
      </div>
    </div>
  );
}
