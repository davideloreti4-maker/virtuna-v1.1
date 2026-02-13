"use client";

import { X } from "lucide-react";
import { useTooltipStore, type TooltipId } from "@/stores/tooltip-store";
import { cn } from "@/lib/utils";

interface ContextualTooltipProps {
  id: TooltipId;
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
  children: React.ReactNode;
}

const positionStyles: Record<string, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

const arrowStyles: Record<string, string> = {
  top: "top-full left-1/2 -translate-x-1/2 border-t-white/[0.1] border-x-transparent border-b-transparent",
  bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-white/[0.1] border-x-transparent border-t-transparent",
  left: "left-full top-1/2 -translate-y-1/2 border-l-white/[0.1] border-y-transparent border-r-transparent",
  right: "right-full top-1/2 -translate-y-1/2 border-r-white/[0.1] border-y-transparent border-l-transparent",
};

export function ContextualTooltip({
  id,
  title,
  description,
  position = "bottom",
  children,
}: ContextualTooltipProps) {
  const { isTooltipVisible, dismissTooltip, _isHydrated } = useTooltipStore();

  const visible = _isHydrated && isTooltipVisible(id);

  return (
    <div className="relative">
      {children}
      {visible && (
        <div
          className={cn(
            "absolute z-50 w-64 animate-in fade-in slide-in-from-bottom-1 duration-200",
            positionStyles[position]
          )}
        >
          <div
            className="rounded-lg border border-white/[0.1] p-3"
            style={{
              backgroundImage:
                "linear-gradient(137deg, rgba(17, 18, 20, 0.95) 4.87%, rgba(12, 13, 15, 0.98) 75.88%)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              boxShadow:
                "rgba(255,255,255,0.1) 0px 1px 0px 0px inset, 0 4px 12px rgba(0,0,0,0.4)",
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">{title}</p>
                <p className="mt-1 text-xs text-foreground-secondary">
                  {description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => dismissTooltip(id)}
                className="shrink-0 rounded p-0.5 text-foreground-secondary hover:text-foreground transition-colors"
                aria-label="Dismiss tooltip"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          {/* Arrow */}
          <div
            className={cn(
              "absolute h-0 w-0 border-[6px]",
              arrowStyles[position]
            )}
          />
        </div>
      )}
    </div>
  );
}
