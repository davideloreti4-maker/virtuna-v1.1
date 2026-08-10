"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Wordmark } from "./brand";
import { PrimaryCta } from "./cta";

/**
 * The fixed header.
 *
 * Transparent over the hero, then SOLID `--lp-bg-alt` with a hairline once the
 * page scrolls — deliberately not a translucent blurred pill. Backdrop blur is
 * glass, glass is the one texture this product's design system rules out, and
 * Lightning CSS strips `backdrop-filter` from CSS classes here anyway. A solid
 * bar is also simply more legible over a page whose content scrolls beneath it.
 *
 * Three scroll behaviours, all cheap and all cream (the accent budget has no
 * nav line item):
 *   · the bar compacts from h-16 to h-14 once the page moves — the reference
 *     pages' headers all get out of the way when reading starts;
 *   · the section link whose target is on screen reads active (underline, not
 *     colour — colour is how the CTA speaks);
 *   · a 1px cream progress hairline along the bar's bottom edge tracks scroll
 *     position. Written via a transform on a ref, not state — a re-render per
 *     scroll frame for a progress bar is how janky navs are made.
 */

const LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#proof", label: "Results" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
] as const;

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      if (progressRef.current) {
        const p = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
        progressRef.current.style.transform = `scaleX(${p})`;
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const targets = LINKS.map((l) => document.getElementById(l.href.slice(1))).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (!targets.length) return;

    // A band across the upper-middle of the viewport: the section occupying it
    // is the one being read. At most one or two intersect; first in page order
    // wins, and scrolling above the first section clears the state.
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const current = LINKS.find((l) => visible.has(l.href.slice(1)));
        setActive(current ? current.href : null);
      },
      { rootMargin: "-25% 0px -65% 0px" },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled
          ? "border-b border-[color:var(--lp-line)] bg-[color:var(--lp-bg-alt)]"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div
        className={cn(
          "lp-measure-wide flex items-center justify-between gap-6",
          "transition-[height] duration-300",
          scrolled ? "h-14" : "h-16",
        )}
      >
        <Link href="/trial" aria-label="Maven — home">
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Page sections">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                "text-[13px] transition-colors",
                active === link.href
                  ? "text-[color:var(--lp-fg)] underline decoration-[rgba(236,231,222,0.35)] decoration-1 underline-offset-8"
                  : "text-[color:var(--lp-fg-2)] hover:text-[color:var(--lp-fg)]",
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-[13px] text-[color:var(--lp-fg-2)] transition-colors hover:text-[color:var(--lp-fg)]"
          >
            Sign in
          </Link>
          {/* Hidden on phones: the hero CTA and the sticky bottom bar already
              carry the ask there, and a third coral pill in the nav means two
              accent CTAs on screen at once — pushy, and off-budget. */}
          <PrimaryCta size="md" className="hidden md:inline-flex" />
        </div>
      </div>

      {/* Scroll progress — cream, 1px, origin left. Sits on the bar's bottom
          hairline; hidden until the bar is solid so it never floats alone. */}
      <div
        ref={progressRef}
        aria-hidden
        className={cn(
          "absolute inset-x-0 bottom-[-1px] h-px origin-left transition-opacity duration-300",
          scrolled ? "opacity-100" : "opacity-0",
        )}
        style={{
          background: "rgba(236,231,222,0.28)",
          transform: "scaleX(0)",
        }}
      />
    </header>
  );
}
