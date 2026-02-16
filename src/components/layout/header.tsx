"use client";

import { cn } from "@/lib/utils";
import { List, X } from "@phosphor-icons/react";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface HeaderProps {
  className?: string;
}

/**
 * Header component following Raycast design language.
 * - Logo: Custom SVG mark + "Artificial Societies" text
 * - Right side: "Sign in" text link + "Book a Meeting" orange button
 * - Sticky with solid dark background
 * - Mobile hamburger menu with slide-down animation and overlay
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
      <div className="sticky top-0 z-50 flex justify-center px-4 pt-4">
        <header
          ref={menuRef}
          className={cn(
            "relative w-full max-w-[1204px] rounded-2xl border border-border",
            className
          )}
          style={{
            background: "var(--gradient-navbar)",
            backdropFilter: "blur(5px)",
            WebkitBackdropFilter: "blur(5px)",
            boxShadow: "rgba(255, 255, 255, 0.15) 0px 1px 1px 0px inset",
          }}
        >
          <nav className="flex h-[76px] items-center justify-between px-8">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                className="text-white"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M16 6H13L8 27H11L16 6ZM16 6L21 27H24L19 6H16Z"
                  fill="currentColor"
                />
              </svg>
              <span className="font-sans text-white">Virtuna</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden items-center gap-4 md:flex">
              <Link
                href="/pricing"
                className="cursor-pointer text-white/80 transition-colors hover:text-white"
              >
                Pricing
              </Link>
              <Link
                href="/login"
                className="cursor-pointer text-white/80 transition-colors hover:text-white"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
              >
                Start free trial
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              type="button"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-white hover:text-white/80 md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" weight="bold" />
              ) : (
                <List className="h-6 w-6" weight="bold" />
              )}
            </button>
          </nav>

          {/* Mobile Menu - expands pill */}
          <div
            className={cn(
              "overflow-hidden transition-all duration-200 ease-out md:hidden",
              mobileMenuOpen
                ? "max-h-40 opacity-100"
                : "max-h-0 opacity-0"
            )}
          >
            <div className="flex flex-col gap-4 border-t border-border px-8 py-6">
              <Link
                href="/pricing"
                className="text-white/80 transition-colors hover:text-white"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </Link>
              <Link
                href="/login"
                className="text-white/80 transition-colors hover:text-white"
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="w-full rounded-lg bg-accent px-4 py-3 text-center text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
                onClick={() => setMobileMenuOpen(false)}
              >
                Start free trial
              </Link>
            </div>
          </div>
        </header>
      </div>

      {/* Overlay for mobile menu */}
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
