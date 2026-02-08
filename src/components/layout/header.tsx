"use client";

import { cn } from "@/lib/utils";
import { List, X } from "@phosphor-icons/react";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface HeaderProps {
  className?: string;
}

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Trending", href: "/trending" },
  { label: "Dashboard", href: "/dashboard" },
] as const;

/**
 * Raycast-style sticky navbar for Virtuna landing page.
 * - Glass blur background with gradient
 * - Logo + nav links (Features, Trending, Dashboard) + CTA
 * - Mobile hamburger with slide-out panel
 */
export function Header({ className }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // Prevent body scroll when menu is open
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
    <>
      <header
        ref={menuRef}
        className={cn(
          "sticky top-0 z-50 w-full border-b border-white/[0.06]",
          className
        )}
        style={{
          background:
            "linear-gradient(137deg, rgba(17, 18, 20, 0.75) 4.87%, rgba(12, 13, 15, 0.9) 75.88%)",
          backdropFilter: "blur(5px)",
          WebkitBackdropFilter: "blur(5px)",
          boxShadow: "rgba(255, 255, 255, 0.15) 0px 1px 1px 0px inset",
        }}
      >
        <nav className="mx-auto flex max-w-[72rem] items-center justify-between px-6 py-3 md:px-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
              <span className="text-sm font-bold text-accent-foreground">V</span>
            </div>
            <span className="text-sm font-medium text-foreground">Virtuna</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="rounded-md px-3 py-2 text-sm text-foreground-secondary transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/auth/login"
              className="px-3 py-2 text-sm text-foreground-secondary transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="inline-flex h-9 min-h-[36px] items-center justify-center rounded-md bg-accent px-3 text-sm font-medium text-accent-foreground shadow-button transition-colors hover:bg-accent-hover active:bg-accent-active"
            >
              Get started
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-foreground-secondary hover:text-foreground md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" weight="bold" />
            ) : (
              <List className="h-5 w-5" weight="bold" />
            )}
          </button>
        </nav>

        {/* Mobile Menu - Slide Down */}
        <div
          className={cn(
            "absolute left-0 right-0 top-full border-t border-white/[0.06] transition-all duration-200 ease-out md:hidden",
            mobileMenuOpen
              ? "visible translate-y-0 opacity-100"
              : "invisible -translate-y-2 opacity-0"
          )}
          style={{
            background:
              "linear-gradient(137deg, rgba(17, 18, 20, 0.95) 4.87%, rgba(12, 13, 15, 0.98) 75.88%)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <div className="flex flex-col gap-1 px-6 py-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="rounded-md px-3 py-3 text-sm text-foreground-secondary transition-colors hover:bg-white/[0.05] hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="my-2 border-t border-white/[0.06]" />
            <Link
              href="/auth/login"
              className="rounded-md px-3 py-3 text-sm text-foreground-secondary transition-colors hover:bg-white/[0.05] hover:text-foreground"
              onClick={() => setMobileMenuOpen(false)}
            >
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="mt-2 inline-flex h-11 min-h-[44px] w-full items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground shadow-button transition-colors hover:bg-accent-hover active:bg-accent-active"
              onClick={() => setMobileMenuOpen(false)}
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Overlay for mobile menu */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          style={{ top: "56px" }}
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
