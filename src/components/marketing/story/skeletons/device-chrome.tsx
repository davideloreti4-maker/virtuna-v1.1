import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Device-chrome wrappers (03-04) — the flat-warm browser-window and phone-bezel
 * set-dressing factored out of hero.tsx / simulation-showcase.tsx so 03-05 can
 * reuse the chrome WITHOUT re-importing the hero. Both are pure presentational
 * RSC wrappers — no client directive, no state, no data.
 *
 * The depth here is a layered DARK drop shadow (flat-warm-legal depth, copied
 * verbatim from simulation-showcase.tsx line 97 / hero.tsx) — NOT a glow, NOT a
 * glass surface, NOT a backdrop-blur.
 */

interface ChromeProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * BrowserChrome — slim browser bar (3 dots + a "numen.app" mono pill, optically
 * centered) over an `overflow-hidden rounded-xl border bg-surface-elevated`
 * window that wraps `children`. The window body is the swap slot for 03-05.
 */
export function BrowserChrome({ children, className }: ChromeProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-surface-elevated",
        // layered DARK drop shadow (flat-warm-legal depth, NOT a glow) —
        // copied verbatim from simulation-showcase.tsx line 97.
        "shadow-[0_40px_80px_-24px_rgba(0,0,0,0.72),0_14px_30px_-12px_rgba(0,0,0,0.5)]",
        className
      )}
    >
      {/* slim browser bar (inherits the frame surface) */}
      <div className="flex items-center border-b border-border px-4 py-2.5">
        <span className="flex gap-2" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-foreground-muted/30" />
          <span className="h-2.5 w-2.5 rounded-full bg-foreground-muted/30" />
          <span className="h-2.5 w-2.5 rounded-full bg-foreground-muted/30" />
        </span>
        <span className="mx-auto rounded-md bg-background px-4 py-1 font-mono text-[11px] tracking-wide text-foreground-muted">
          numen.app
        </span>
        {/* spacer keeps the address pill optically centered vs the dots */}
        <span className="w-[42px]" aria-hidden="true" />
      </div>
      {/* window body — children own the content */}
      {children}
    </div>
  );
}

/**
 * PhoneChrome — the rounded phone bezel from hero.tsx lines 141-149
 * (border-[5px] background-elevated bezel, ring-1 ring-border, deep dark
 * shadow) wrapping `children` (the screen). A sibling-friendly wrapper so 03-05
 * can float a phone "in front" of a BrowserChrome window.
 */
export function PhoneChrome({ children, className }: ChromeProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[1.8rem] border-[5px] border-background-elevated bg-background-elevated",
        // deep dark drop shadow + hairline ring so it reads as "in front" —
        // copied verbatim from hero.tsx line 142 (NOT a glow).
        "shadow-[0_28px_52px_-14px_rgba(0,0,0,0.85)] ring-1 ring-border",
        className
      )}
    >
      {children}
    </div>
  );
}
