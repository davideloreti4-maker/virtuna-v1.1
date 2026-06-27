"use client";

import { useEffect } from "react";
import { Warning, ArrowClockwise } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.06] bg-error/10">
          <Warning className="h-8 w-8 text-error" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-foreground-secondary">
          An unexpected error occurred. Our team has been notified.
          {error.digest && (
            <span className="mt-1 block text-xs text-foreground-muted">
              Error ID: {error.digest}
            </span>
          )}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button variant="primary" onClick={reset}>
            <ArrowClockwise className="h-4 w-4" />
            Try again
          </Button>
          {/* Intentional hard navigation (full reload) — in an error boundary a soft
              <Link> nav can preserve the corrupted React tree; <a> escapes it. */}
          <Button variant="secondary" asChild>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/">Go home</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
