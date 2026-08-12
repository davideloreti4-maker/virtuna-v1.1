"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { PrimaryCta } from "./cta";

/**
 * Sticky mobile CTA bar — phones only.
 *
 * IG/TikTok traffic is overwhelmingly one-thumb mobile, and on a long page the
 * hero's ask is gone after two swipes. The bar keeps the $1 within thumb reach
 * from the moment the hero scrolls out until the end of the page.
 *
 * Appears after ~90% of a viewport of scroll (the hero CTA is still on screen
 * before that — showing both at once reads as begging), slides in, and stays.
 * Solid surface, hairline top border, safe-area padding for home-indicator
 * phones. Never on ≥md: desktop keeps the nav CTA instead.
 */
export function StickyBar() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > window.innerHeight * 0.9);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 md:hidden",
        "border-t border-[color:var(--lp-line)] bg-[color:var(--lp-bg-alt)]",
        "transition-transform duration-300",
        shown ? "translate-y-0" : "translate-y-full",
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium leading-tight text-[color:var(--lp-fg)]">
            Try everything for $1
          </p>
          <p className="lp-mono mt-0.5 text-[10px] text-[color:var(--lp-fg-3)]">
            3 days · cancel anytime
          </p>
        </div>
        <PrimaryCta size="md" className="shrink-0" />
      </div>
    </div>
  );
}
