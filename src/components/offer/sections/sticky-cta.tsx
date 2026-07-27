"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { CTA_VARIANT } from "@/components/offer/cta-config";
import { useFreeEntry } from "@/components/offer/free-entry-cta";

/**
 * The always-available close, on BOTH breakpoints.
 *
 * It used to be mobile-only (`lg:hidden`), which left desktop visitors with no
 * ask between the hero and pricing — thousands of pixels apart on this page. Now:
 *   • mobile  — a full-width bottom bar, thumb-reachable
 *   • desktop — a compact bottom-right pill, so it never covers the content
 *
 * It reveals once the hero has scrolled ~70% away, and RETIRES over the pricing
 * and final-CTA sections: a floating "start" button competing with the real
 * buttons it points at is friction, not urgency. Both bars carry the page's one
 * entry ask (FREE_ENTRY → the hero composer): the free test IS the flow; "$1"
 * and /signup here contradicted the fold and routed around the funnel.
 *
 * backdrop-filter is applied via inline style, NOT a Tailwind class (Lightning
 * CSS strips the class form). Reduced motion = fade only, no slide.
 */

/** Sections whose own CTA should own the viewport — the floater stands down. */
const YIELD_TO = ["#pricing", "#final-cta"];

export function StickyCta() {
  const [visible, setVisible] = useState(false);
  const reduced = useReducedMotion();
  // Both bars are the same entry as every other CTA — session minted on click, prewarmed on
  // hover. The bespoke markup ("no account" sub-label) is why this spreads props rather than
  // mounting FreeEntryCta.
  const { linkProps, label } = useFreeEntry();

  const coral = CTA_VARIANT === "coral";
  const ctaBg = coral ? "bg-accent text-accent-foreground" : "bg-action text-action-foreground";
  const ctaSub = coral ? "text-accent-foreground/70" : "text-action-foreground/70";

  useEffect(() => {
    const onScroll = () => {
      const pastHero = window.scrollY > window.innerHeight * 0.7;

      // Stand down while a section that carries its own primary CTA is on screen.
      const yielding = YIELD_TO.some((sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.top < window.innerHeight * 0.85 && r.bottom > 0;
      });

      setVisible(pastHero && !yielding);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const transition = reduced
    ? { duration: 0 }
    : { duration: 0.32, ease: [0.21, 0.47, 0.32, 0.98] as const };

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* mobile — full-width bar */}
          <motion.div
            key="sticky-mobile"
            className="fixed inset-x-0 bottom-0 z-50 lg:hidden"
            initial={reduced ? { opacity: 0 } : { y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { y: 80, opacity: 0 }}
            transition={transition}
          >
            <div
              className="border-t border-border bg-background/90 px-4 pt-3"
              style={{
                backdropFilter: "blur(10px)",
                paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)",
              }}
            >
              <a
                {...linkProps}
                className={`flex h-12 w-full items-center justify-center gap-2 rounded-lg text-[15px] font-semibold transition-transform active:scale-[0.99] ${ctaBg}`}
              >
                {label}
                <span className={`text-xs font-normal ${ctaSub}`}>no account</span>
              </a>
            </div>
          </motion.div>

          {/* desktop — a compact pill, out of the reading column */}
          <motion.div
            key="sticky-desktop"
            className="fixed bottom-6 right-6 z-50 hidden lg:block"
            initial={reduced ? { opacity: 0 } : { y: 24, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { y: 24, opacity: 0, scale: 0.97 }}
            transition={transition}
          >
            <a
              {...linkProps}
              className={`flex h-12 items-center gap-2.5 rounded-full px-6 text-[14.5px] font-semibold shadow-[0_18px_40px_-16px_rgba(0,0,0,0.7)] transition-transform hover:scale-[1.02] active:scale-[0.99] ${ctaBg}`}
            >
              {label}
              <span className={`text-[12px] font-normal ${ctaSub}`}>no account</span>
            </a>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
