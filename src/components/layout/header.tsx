"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { cn, FOCUS_RING } from "@/lib/utils";
import { NumenLogo } from "@/components/brand/numen-logo";
import { Button } from "@/components/ui/button";
import { SIGNUP_URL, LOGIN_URL } from "@/lib/routes";
import { NAV_LINKS } from "@/lib/nav";

interface HeaderProps {
  className?: string;
}

/**
 * Header — flat-matte sticky chrome for the Numen marketing landing
 * (NAV-01, NAV-03 · CONTEXT D-19/D-20/D-21 · UI-SPEC Component Inventory item 2).
 *
 * A flat OPAQUE sticky bar (no glass, no blur, no inset shine, no drop
 * shadow) resting on a tone-step surface + a hairline bottom border. Contents:
 * the Stele NumenLogo + "Numen" wordmark, 3–4 in-page anchor links, a terracotta
 * "Try it free" primary CTA → /signup, and a subtle "Sign in" ghost link → /login.
 *
 * Mobile (NAV-03): a lightweight useState disclosure (NOT a heavyweight Radix
 * Sheet for 3–4 items) — an icon-button trigger toggles a flat opaque dropdown
 * panel (the ONE allowed shadow, --shadow-float, since it floats) that closes on
 * tap of any link. CTA paths come from the shared @/lib/routes constants.
 */
export function Header({ className }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Tracks whether the panel has actually been opened, so we only restore focus
  // on a genuine open→closed transition (never steal focus on initial mount).
  const wasOpenRef = useRef(false);

  const closeMenu = () => setMobileMenuOpen(false);

  // WR-02 — lock body scroll while the mobile panel is open, saving and
  // restoring the PRIOR overflow value (do not clobber a pre-existing lock to "").
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileMenuOpen]);

  // GAP-4 / WR-03 — accessible disclosure while the panel is open:
  //  - Escape closes the panel
  //  - focus moves into the panel on open (first focusable)
  //  - Tab / Shift+Tab cycle focus within the panel's focusables (focus trap)
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const panel = panelRef.current;
    if (!panel) return;

    const getFocusables = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>("a[href], button")
      ).filter((el) => !el.hasAttribute("disabled"));

    // Move focus into the panel on open.
    getFocusables()[0]?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMobileMenuOpen(false);
        return;
      }
      if (e.key !== "Tab") return;

      const focusables = getFocusables();
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !panel.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  // GAP-4 / WR-03 — restore focus to the trigger on a genuine open→closed
  // transition (Escape, link tap, or toggle). Never steals focus on mount.
  useEffect(() => {
    if (mobileMenuOpen) {
      wasOpenRef.current = true;
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      triggerRef.current?.focus();
    }
  }, [mobileMenuOpen]);

  return (
    <header
      className={cn(
        // Flat opaque sticky bar — tone-step surface + hairline bottom border.
        // No blur, no shine, no drop shadow (flat-matte, D-06/D-19).
        "sticky top-0 z-[200]",
        "border-b border-border bg-background-elevated",
        className
      )}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 w-full max-w-[1204px] items-center justify-between px-4 md:px-6"
      >
        {/* Brand — NumenLogo (cream via currentColor) linking to the hero anchor. */}
        <Link
          href="#hero"
          aria-label="Numen home"
          className={cn("flex items-center text-foreground", FOCUS_RING)}
        >
          <NumenLogo size={26} />
        </Link>

        {/* Desktop in-page anchor links (NAV-01). */}
        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm text-foreground-secondary transition-colors hover:text-foreground",
                FOCUS_RING
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop actions — subtle "Sign in" ghost + terracotta "Try it free" CTA. */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href={LOGIN_URL}
            className={cn(
              "text-sm text-foreground-secondary transition-colors hover:text-foreground",
              FOCUS_RING
            )}
          >
            Sign in
          </Link>
          <Button asChild variant="primary" size="sm">
            <Link href={SIGNUP_URL}>Try it free</Link>
          </Button>
        </div>

        {/* Mobile menu trigger (NAV-03). Tap target ≥44px. */}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav-panel"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          className="inline-flex h-11 min-h-[44px] w-11 min-w-[44px] items-center justify-center rounded-md text-foreground-secondary transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10 focus-visible:ring-offset-2 focus-visible:ring-offset-background-elevated md:hidden"
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Menu className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </nav>

      {/* Mobile disclosure panel (NAV-03) — flat opaque charcoal, hairline border,
          --shadow-float (it floats). Closes on tap of any link. */}
      {mobileMenuOpen && (
        <div
          ref={panelRef}
          id="mobile-nav-panel"
          data-testid="mobile-nav-panel"
          className="border-t border-border bg-background-elevated shadow-float md:hidden"
        >
          <div className="mx-auto flex w-full max-w-[1204px] flex-col gap-1 px-4 py-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMenu}
                className={cn(
                  "flex min-h-[44px] items-center rounded-md px-2 text-sm text-foreground-secondary transition-colors hover:bg-hover hover:text-foreground",
                  FOCUS_RING,
                  "focus-visible:ring-offset-background-elevated"
                )}
              >
                {link.label}
              </Link>
            ))}

            <Link
              href={LOGIN_URL}
              onClick={closeMenu}
              className={cn(
                "flex min-h-[44px] items-center rounded-md px-2 text-sm text-foreground-secondary transition-colors hover:bg-hover hover:text-foreground",
                FOCUS_RING,
                "focus-visible:ring-offset-background-elevated"
              )}
            >
              Sign in
            </Link>

            <Button asChild variant="primary" size="md" className="mt-2 w-full">
              <Link href={SIGNUP_URL} onClick={closeMenu}>
                Try it free
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
