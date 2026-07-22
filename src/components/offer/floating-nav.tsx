"use client";

import { useEffect, useRef, useState } from "react";
import { List, X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import { MavenLogo } from "@/components/brand/maven-logo";

/**
 * FloatingNav — the /go top bar as a clean, premium floating island: a wider,
 * detached pill centered at the top, the real Maven brand mark (the gull) on
 * the left and a burger menu on the right. Matte only: a hairline border, a
 * soft DARK shadow (non-zero Y, not a glow), backdrop blur via inline style
 * (Lightning CSS strips the class form).
 *
 * Scroll-aware depth — the pill solidifies + its shadow deepens once you begin
 * scrolling (bg/border/shadow transition only, so reduced-motion-safe).
 *
 * The burger opens a floating menu card (in-page anchors + the $1 CTA) with the
 * standard disclosure a11y: Escape + click-outside close, close on link tap,
 * focus the first item on open, restore focus to the trigger on close.
 */

const MENU_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
] as const;

export function FloatingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  // scroll-aware pill depth
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Escape + click-outside close; focus the first menu item on open.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("a[href], button")?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  // Restore focus to the trigger on a genuine open→closed transition.
  useEffect(() => {
    if (open) wasOpenRef.current = true;
    else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);

  return (
    <div className="fixed inset-x-0 top-3 z-50 flex justify-center px-4 md:top-4">
      <div ref={rootRef} className="w-full max-w-2xl">
        <nav
          aria-label="Primary"
          className={cn(
            "flex items-center justify-between rounded-full border py-2 pl-4 pr-2.5",
            "transition-[background-color,border-color,box-shadow] duration-300 ease-out",
            scrolled
              ? "border-border-hover/40 bg-surface-elevated/85 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.65)]"
              : "border-border bg-surface-elevated/60 shadow-[0_6px_20px_-10px_rgba(0,0,0,0.5)]",
          )}
          style={{ backdropFilter: "blur(12px)" }}
        >
          {/* Brand — the real Maven gull mark + wordmark; click scrolls to top. */}
          <button
            type="button"
            aria-label="Maven — back to top"
            onClick={() =>
              window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" })
            }
            className="flex items-center rounded-full text-foreground transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10"
          >
            <MavenLogo size={24} />
          </button>

          {/* Burger menu trigger — replaces the inline CTA. Tap target ≥44px. */}
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="offer-nav-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground-secondary transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10"
          >
            {open ? (
              <X size={20} weight="bold" aria-hidden />
            ) : (
              <List size={20} weight="bold" aria-hidden />
            )}
          </button>
        </nav>

        {/* Floating menu card — in-page anchors + the one cream CTA. */}
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              id="offer-nav-menu"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
              transition={reduced ? { duration: 0 } : { duration: 0.18, ease: [0.21, 0.47, 0.32, 0.98] }}
              style={{ backdropFilter: "blur(12px)" }}
              className="mt-2 origin-top rounded-2xl border border-border bg-surface-elevated/90 p-2 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.7)]"
            >
              <div className="flex flex-col gap-0.5">
                {MENU_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-[44px] items-center rounded-xl px-3 text-[15px] font-medium text-foreground-secondary transition-colors hover:bg-white/[0.06] hover:text-foreground"
                  >
                    {link.label}
                  </a>
                ))}
              </div>

              <div className="my-1.5 h-px bg-border" />

              <a
                href="#pricing"
                onClick={() => setOpen(false)}
                className="flex min-h-[44px] items-center justify-center rounded-xl bg-action px-4 text-[15px] font-semibold text-action-foreground transition-transform hover:scale-[1.01] active:scale-[0.99]"
              >
                Start for $1
              </a>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
