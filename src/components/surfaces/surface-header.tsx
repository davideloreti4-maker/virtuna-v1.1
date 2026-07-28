import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The app's ONE content column.
 *
 * A surface audit found three sibling pages inside the same shell rendering
 * identically-styled 22px/600 headers at three different left edges — 268px on
 * /settings, 462px on /audience, 566px on /audience/new. Navigating between two
 * settings-adjacent pages threw the title 298px sideways. Two centred their
 * container; /settings was flush-left. Three max-widths were in play (896 / 880 /
 * 672). Nothing looks less considered than chrome that moves when the content
 * behind it changes.
 *
 * 880px is canonical because it already WAS the majority — the audience list, the
 * audience detail page, both loading skeletons and /dev/cards all shipped it.
 *
 * Forms that want a narrower measure nest their own max-width INSIDE this shell
 * rather than shrinking it, so the header's left edge never moves between routes.
 * See /audience/new, which reads narrow but aligns with everything else.
 */
export const PAGE_MAX_WIDTH = 880;

export function PageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[880px] px-4 pb-24 pt-6 lg:px-6", className)}>
      {children}
    </div>
  );
}

/**
 * SurfaceHeader — the shared page-header for the app's surfaces. One H1 treatment
 * (18→22px semibold, tight tracking) + an optional prose subtitle + optional
 * right-side actions, so every surface reads as one product.
 *
 * This component already existed and described exactly this job — but it had ZERO
 * importers. It was written for /feed, /competitors, /discover and /referrals,
 * every one of which became a redirect stub, so it was orphaned before it was ever
 * adopted and the live pages went on hand-rolling their headers. Adopting it here
 * is the fix; it is not new code.
 *
 * Callers own vertical spacing via `className` (e.g. "mb-6").
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
        <h1 className="text-subhead font-semibold text-foreground lg:text-heading">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 max-w-2xl text-label text-foreground-secondary">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2 sm:gap-3">{actions}</div> : null}
    </header>
  );
}
