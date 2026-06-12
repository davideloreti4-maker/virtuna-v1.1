import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * SectionShell — the reusable semantic section-slot skeleton for the Numen
 * landing page (D-10 / MOT-02).
 *
 * Each slot is a semantic `<section id>` carrying the locked kero vertical
 * rhythm (`py-24 md:py-32`) and `scroll-mt-*` so the sticky nav offset never
 * hides the heading on an anchor jump. Phases 2–4 fill `children`; Phase 1
 * renders the heading-only skeleton.
 *
 * `heading` is OPTIONAL: when passed it emits the slot's internal `<h2>`; when
 * omitted (the hero) the caller renders its own explicit `<h1>` child instead,
 * which keeps exactly one `<h1>` on the page with no heading-level skip.
 *
 * The caller `className` is merged LAST through `cn()` so a layout override
 * (e.g. the hero's special top padding) wins — mirroring `Surface`'s
 * caller-overrides-win discipline.
 */
export function SectionShell({
  id,
  heading,
  children,
  className,
}: {
  id: string;
  heading?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn("scroll-mt-20 md:scroll-mt-24 py-24 md:py-32", className)}
    >
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        {heading ? (
          <h2 className="text-text text-3xl md:text-4xl font-bold tracking-tight">
            {heading}
          </h2>
        ) : null}
        {children}
      </div>
    </section>
  );
}
