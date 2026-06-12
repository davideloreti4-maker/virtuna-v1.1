"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";
import { Menu, X } from "lucide-react";

import { NumenLogo } from "@/components/brand/numen-logo";
import { cn } from "@/lib/utils";

/**
 * Nav — the Numen landing top navigation (D-05 / D-06).
 *
 * Sticky OPAQUE bar (`bg-bg` + hairline `border-b border-border`, no glass/blur —
 * dodges the Lightning-CSS backdrop-filter strip). Desktop shows inline anchor
 * links + a primary CTA; mobile collapses the anchors into a hamburger that
 * slides a `bg-panel` sheet down, closes on outside-click / anchor tap, and
 * locks body scroll while open. Rebuilt clean from the stale societies header —
 * Lucide icons, `.numen-surface` tokens, focus rings (no glass pill, no
 * third-party icon kit).
 */

// Locked anchor id set (must match section-shell ids + footer repeat).
const ANCHORS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#honesty", label: "Honesty" },
  { href: "#gallery", label: "Gallery" },
];

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export function Nav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        mobileMenuOpen
      ) {
        setMobileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileMenuOpen]);

  // Lock body scroll while the mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  return (
    <>
      <nav
        ref={menuRef}
        className="sticky top-0 z-50 bg-bg border-b border-border"
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6 md:h-16">
          {/* Left: brand */}
          <Link
            href="#hero"
            aria-label="Numen home"
            className={cn("flex items-center text-text rounded-lg", FOCUS_RING)}
          >
            <NumenLogo size={26} />
          </Link>

          {/* Desktop anchor cluster — explicit JSX so the locked ids are greppable */}
          <div className="hidden items-center gap-8 md:flex">
            <Link
              href="#how-it-works"
              className={cn(
                "rounded-md text-sm text-text-muted transition-colors hover:text-text",
                FOCUS_RING
              )}
            >
              How it works
            </Link>
            <Link
              href="#honesty"
              className={cn(
                "rounded-md text-sm text-text-muted transition-colors hover:text-text",
                FOCUS_RING
              )}
            >
              Honesty
            </Link>
            <Link
              href="#gallery"
              className={cn(
                "rounded-md text-sm text-text-muted transition-colors hover:text-text",
                FOCUS_RING
              )}
            >
              Gallery
            </Link>
          </div>

          {/* Right: CTA (always inline) + mobile hamburger */}
          <div className="flex items-center gap-2">
            <Link
              href="#cta"
              className={cn(
                "inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-bg transition-opacity hover:opacity-90",
                FOCUS_RING
              )}
            >
              Try Numen
            </Link>

            <button
              type="button"
              className={cn(
                "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-text md:hidden",
                FOCUS_RING
              )}
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile slide-down menu */}
        <div
          className={cn(
            "overflow-hidden border-border bg-panel transition-all duration-200 ease-out md:hidden",
            mobileMenuOpen
              ? "max-h-60 border-t opacity-100"
              : "max-h-0 opacity-0"
          )}
        >
          <div className="mx-auto flex max-w-6xl flex-col px-6 py-2">
            {ANCHORS.map((anchor) => (
              <Link
                key={anchor.href}
                href={anchor.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex min-h-11 items-center rounded-md text-text",
                  FOCUS_RING
                )}
              >
                {anchor.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Dimming overlay closes the menu on tap */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
