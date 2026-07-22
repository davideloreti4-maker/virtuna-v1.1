"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { CTA_VARIANT } from "@/components/offer/cta-config";

/**
 * Sticky mobile CTA — the always-available close. Hidden on desktop and until
 * the hero has scrolled away (~70% of the first viewport), then slides up. On a
 * cold mobile scroll the ask is never more than a thumb away.
 *
 * backdrop-filter is applied via inline style, NOT a Tailwind class (Lightning
 * CSS strips the class form). Reduced motion = fade only, no slide.
 */
export function StickyCta() {
  const [visible, setVisible] = useState(false);
  const reduced = useReducedMotion();

  const coral = CTA_VARIANT === "coral";
  const ctaBg = coral ? "bg-accent text-accent-foreground" : "bg-action text-action-foreground";
  const ctaSub = coral ? "text-accent-foreground/70" : "text-action-foreground/70";

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.7);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-x-0 bottom-0 z-50 lg:hidden"
          initial={reduced ? { opacity: 0 } : { y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { y: 80, opacity: 0 }}
          transition={
            reduced ? { duration: 0 } : { duration: 0.32, ease: [0.21, 0.47, 0.32, 0.98] }
          }
        >
          <div
            className="border-t border-border bg-background/90 px-4 pt-3"
            style={{
              backdropFilter: "blur(10px)",
              paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)",
            }}
          >
            <a
              href="#pricing"
              className={`flex h-12 w-full items-center justify-center gap-2 rounded-lg text-[15px] font-semibold transition-transform active:scale-[0.99] ${ctaBg}`}
            >
              Test your first video — $1
              <span className={`text-xs font-normal ${ctaSub}`}>$1 for 3 days</span>
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
