"use client";

import { useEffect, useState } from "react";
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
 */

const LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#proof", label: "Results" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
] as const;

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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
      <div className="lp-measure-wide flex h-16 items-center justify-between gap-6">
        <Link href="/trial" aria-label="Maven — home">
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Page sections">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[13px] text-[color:var(--lp-fg-2)] transition-colors hover:text-[color:var(--lp-fg)]"
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
    </header>
  );
}
