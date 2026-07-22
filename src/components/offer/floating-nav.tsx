"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * FloatingNav — the /go top bar as a clean, premium floating island: a
 * content-hugging pill, centered and detached from the top edge. Matte only:
 * a hairline border, a soft DARK shadow (non-zero Y — not a glow), and a
 * backdrop blur applied via inline style (Lightning CSS strips the class form).
 *
 * Scroll-aware depth cue — at the very top the pill sits light; once you begin
 * scrolling it solidifies and its shadow deepens. Only background / border /
 * shadow transition (no transform, no loop), so it is reduced-motion-safe by
 * construction.
 *
 * Coral appears once — the M brand mark (a sanctioned accent use). The CTA
 * stays cream per the dosage rule.
 */
export function FloatingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed inset-x-0 top-3 z-50 flex justify-center px-4 md:top-4">
      <nav
        className={cn(
          "inline-flex items-center gap-2.5 rounded-full border py-2 pl-3 pr-2",
          "transition-[background-color,border-color,box-shadow] duration-300 ease-out",
          scrolled
            ? "border-border-hover/40 bg-surface-elevated/85 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.65)]"
            : "border-border bg-surface-elevated/60 shadow-[0_6px_20px_-10px_rgba(0,0,0,0.5)]",
        )}
        style={{ backdropFilter: "blur(12px)" }}
      >
        <span className="flex items-center gap-2 pl-1 font-semibold tracking-tight text-foreground">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-accent text-[13px] font-extrabold text-accent-foreground">
            M
          </span>
          Maven
          <span className="hidden text-[11px] font-medium text-foreground-muted sm:inline">
            by Numen
          </span>
        </span>

        <a
          href="#pricing"
          className="rounded-full bg-action px-4 py-1.5 text-sm font-semibold text-action-foreground transition-transform hover:scale-[1.02] active:scale-[0.99]"
        >
          Start for $1
        </a>
      </nav>
    </div>
  );
}
