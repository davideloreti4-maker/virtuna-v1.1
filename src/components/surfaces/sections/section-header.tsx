"use client";

/** SectionHeader — the `<h3>` + optional right-aligned action for a start-page block. */

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionHeader({
  title,
  action,
  className,
}: {
  title: string;
  action?: { label: string; onClick: () => void; withChevron?: boolean };
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 px-1 pb-3", className)}>
      <h3 className="m-0 text-[15px] font-semibold tracking-[-0.01em] text-foreground">
        {title}
      </h3>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="ml-auto inline-flex items-center gap-1 text-[11.5px] text-foreground-muted transition-colors hover:text-foreground-secondary"
        >
          {action.label}
          {action.withChevron && <ChevronRight aria-hidden className="size-3" />}
        </button>
      )}
    </div>
  );
}
