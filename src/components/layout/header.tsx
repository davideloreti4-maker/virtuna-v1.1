"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { NumenLogo } from "@/components/brand/numen-logo";
import { Button } from "@/components/ui/button";
import { SIGNUP_URL, LOGIN_URL } from "@/lib/routes";

interface HeaderProps {
  className?: string;
}

/** In-page anchor links (NAV-01) — target the scroll-skeleton section ids. */
const NAV_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "The Simulation", href: "#the-simulation" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
] as const;

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

  const closeMenu = () => setMobileMenuOpen(false);

  // Lock body scroll while the mobile panel is open; always restore on close/unmount.
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
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
          className="flex items-center text-foreground"
        >
          <NumenLogo size={26} />
        </Link>

        {/* Desktop in-page anchor links (NAV-01). */}
        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-foreground-secondary transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop actions — subtle "Sign in" ghost + terracotta "Try it free" CTA. */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href={LOGIN_URL}
            className="text-sm text-foreground-secondary transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <Button asChild variant="primary" size="sm">
            <Link href={SIGNUP_URL}>Try it free</Link>
          </Button>
        </div>

        {/* Mobile menu trigger (NAV-03). Tap target ≥44px. */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-nav-panel"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          className="inline-flex h-11 min-h-[44px] w-11 min-w-[44px] items-center justify-center rounded-md text-foreground-secondary transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background-elevated md:hidden"
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
                className="flex min-h-[44px] items-center rounded-md px-2 text-sm text-foreground-secondary transition-colors hover:bg-hover hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}

            <Link
              href={LOGIN_URL}
              onClick={closeMenu}
              className="flex min-h-[44px] items-center rounded-md px-2 text-sm text-foreground-secondary transition-colors hover:bg-hover hover:text-foreground"
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
