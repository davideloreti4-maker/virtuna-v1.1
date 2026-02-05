"use client";

import { useState } from "react";

import { Spinner } from "@/components/ui";

export function SpinnerDemo() {
  const [progress, setProgress] = useState(65);

  return (
    <div className="space-y-6">
      {/* Indeterminate spinners in all sizes */}
      <div>
        <p className="mb-3 text-sm font-medium text-foreground-secondary">
          Indeterminate (all sizes)
        </p>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <Spinner size="sm" />
            <span className="text-xs text-foreground-muted">sm (16px)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Spinner size="md" />
            <span className="text-xs text-foreground-muted">md (24px)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Spinner size="lg" />
            <span className="text-xs text-foreground-muted">lg (32px)</span>
          </div>
        </div>
      </div>

      {/* Determinate progress with slider */}
      <div>
        <p className="mb-3 text-sm font-medium text-foreground-secondary">
          Determinate progress
        </p>
        <div className="flex items-center gap-6">
          <Spinner size="lg" value={progress} />
          <div className="flex flex-1 flex-col gap-2">
            <input
              type="range"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full max-w-xs accent-accent"
              aria-label="Progress value"
            />
            <span className="text-xs text-foreground-muted">
              {progress}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
