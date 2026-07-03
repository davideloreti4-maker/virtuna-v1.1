import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * SurfaceHeader — the shared page-header for the app's surfaces (feed / competitors /
 * discover / referrals / …). One H1 treatment (flat-warm charcoal design system:
 * 19→22px semibold, tight tracking) + an optional prose subtitle + optional right-side
 * actions. Matches the header the flagship surfaces (/start · /calendar · /analytics ·
 * /grow) render inline, so every surface reads as one product. Callers own vertical
 * spacing via `className` (e.g. "mb-6").
 */
export function SurfaceHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="text-[19px] font-semibold tracking-[-0.01em] text-foreground lg:text-[22px]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 max-w-2xl text-[12.5px] leading-[1.5] text-foreground-secondary">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2 sm:gap-3">{actions}</div> : null}
    </header>
  );
}
