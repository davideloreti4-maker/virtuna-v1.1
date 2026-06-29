"use client";

import { useEffect } from "react";
import { Warning, ArrowClockwise, House } from "@phosphor-icons/react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl border border-white/[0.06] bg-error/10">
          <Warning className="h-7 w-7 text-error" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-foreground-secondary">
          This page hit an error. Try again, or head back home.
          {error.digest && (
            <span className="mt-1 block text-xs text-foreground-muted">
              Error ID: {error.digest}
            </span>
          )}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="primary" size="sm" onClick={reset}>
            <ArrowClockwise className="h-4 w-4" />
            Try again
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <Link href="/home">
              <House className="h-4 w-4" />
              Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
