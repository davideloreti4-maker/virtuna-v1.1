"use client";

import * as React from "react";
import { TrafficLights } from "@/components/primitives";

export function TrafficLightsDemo() {
  const [lastAction, setLastAction] = React.useState<string | null>(null);

  return (
    <div className="space-y-8">
      {/* Sizes */}
      <div>
        <p className="mb-4 text-sm font-medium text-foreground-secondary">
          Sizes
        </p>
        <div className="flex items-center gap-10">
          <div className="flex flex-col items-center gap-3">
            <TrafficLights size="sm" />
            <span className="text-xs text-foreground-muted">sm (10px)</span>
          </div>
          <div className="flex flex-col items-center gap-3">
            <TrafficLights size="md" />
            <span className="text-xs text-foreground-muted">md (12px)</span>
          </div>
          <div className="flex flex-col items-center gap-3">
            <TrafficLights size="lg" />
            <span className="text-xs text-foreground-muted">lg (14px)</span>
          </div>
        </div>
      </div>

      {/* Interactive */}
      <div>
        <p className="mb-4 text-sm font-medium text-foreground-secondary">
          Interactive
        </p>
        <div className="flex items-center gap-6">
          <TrafficLights
            interactive
            size="lg"
            onClose={() => setLastAction("Close clicked")}
            onMinimize={() => setLastAction("Minimize clicked")}
            onMaximize={() => setLastAction("Maximize clicked")}
          />
          {lastAction && (
            <span className="text-xs text-foreground-muted animate-in fade-in">
              {lastAction}
            </span>
          )}
        </div>
      </div>

      {/* Disabled */}
      <div>
        <p className="mb-4 text-sm font-medium text-foreground-secondary">
          Disabled
        </p>
        <TrafficLights disabled size="md" />
      </div>
    </div>
  );
}
