"use client";

import { cn } from "@/lib/utils";
import { List, X } from "@phosphor-icons/react";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface HeaderProps {
  className?: string;
}

/**
 * Header component matching societies.io design.
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
      <header
        ref={menuRef}
        className={cn(
          "sticky top-0 z-50 w-full bg-background",
          className
        )}
      >
        <nav className="flex items-center justify-between px-8 py-3.5">
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
            <span className="font-sans text-white">Artificial Societies</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-4 md:flex">
            <Link
              href="/auth/login"
              className="cursor-pointer text-white transition-colors hover:text-white/80"
            >
              Sign in
            </Link>
            <Link
              href="https://calendly.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90"
            >
              Book a Meeting
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-white hover:text-white/80 md:hidden"
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

        {/* Mobile Menu - Slide Down */}
        <div
          className={cn(
            "absolute left-0 right-0 top-full bg-background transition-all duration-200 ease-out md:hidden",
            mobileMenuOpen
              ? "visible translate-y-0 opacity-100"
              : "invisible -translate-y-2 opacity-0"
          )}
        >
          <div className="flex flex-col gap-4 border-t border-white/10 px-8 py-6">
            <Link
              href="/auth/login"
              className="text-white transition-colors hover:text-white/80"
              onClick={() => setMobileMenuOpen(false)}
            >
              Sign in
            </Link>
            <Link
              href="https://calendly.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full rounded bg-accent px-4 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-accent/90"
              onClick={() => setMobileMenuOpen(false)}
            >
              Book a Meeting
            </Link>
          </div>
        </div>
      </header>

      {/* Overlay for mobile menu */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          style={{ top: "60px" }}
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
