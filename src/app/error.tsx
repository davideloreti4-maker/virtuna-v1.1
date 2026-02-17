"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#07080a] px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.06] bg-red-500/10">
          <AlertTriangle className="h-8 w-8 text-red-400" />
        </div>
        <h1 className="text-xl font-semibold text-white">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          An unexpected error occurred. Our team has been notified.
          {error.digest && (
            <span className="mt-1 block text-xs text-zinc-600">
              Error ID: {error.digest}
            </span>
          )}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
          >
            <RotateCcw className="h-4 w-4" />
            Try again
          </button>
          <a
            href="/"
            className="flex items-center rounded-lg border border-white/[0.06] px-5 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[0.02]"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
