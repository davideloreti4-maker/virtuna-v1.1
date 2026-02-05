"use client";

import { HoverScale } from "@/components/motion";

export function HoverScaleDemo() {
  return (
    <div className="flex flex-wrap items-center gap-6">
      {/* Default scale */}
      <HoverScale>
        <div className="flex h-28 w-44 items-center justify-center rounded-lg border border-border-glass bg-surface/60 text-sm font-medium text-foreground-secondary transition-colors">
          <div className="text-center">
            <p>Hover me</p>
            <p className="mt-1 text-xs text-foreground-muted">scale: 1.02</p>
          </div>
        </div>
      </HoverScale>

      {/* Dramatic scale */}
      <HoverScale scale={1.05} tapScale={0.95}>
        <div className="flex h-28 w-44 items-center justify-center rounded-lg border border-accent/20 bg-accent/5 text-sm font-medium text-foreground-secondary transition-colors">
          <div className="text-center">
            <p>Hover me</p>
            <p className="mt-1 text-xs text-foreground-muted">scale: 1.05</p>
          </div>
        </div>
      </HoverScale>

      {/* Subtle scale */}
      <HoverScale scale={1.01} tapScale={0.99}>
        <div className="flex h-28 w-44 items-center justify-center rounded-lg border border-border-glass bg-surface/60 text-sm font-medium text-foreground-secondary transition-colors">
          <div className="text-center">
            <p>Hover me</p>
            <p className="mt-1 text-xs text-foreground-muted">scale: 1.01</p>
          </div>
        </div>
      </HoverScale>
    </div>
  );
}
