"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { List, X } from "@phosphor-icons/react";
import { useState } from "react";

interface HeaderProps {
  className?: string;
  variant?: "landing" | "app";
}

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Case Studies", href: "#case-studies" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

/**
 * Header component with logo, navigation, and CTA.
 * Sticky with backdrop blur for modern look.
 */
export function Header({ className, variant = "landing" }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-sm",
        className
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2">
          <span className="font-display text-xl font-bold text-foreground">
            Virtuna
          </span>
        </a>

        {/* Desktop Navigation */}
        {variant === "landing" && (
          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-foreground-muted transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
        )}

        {/* CTA Buttons */}
        <div className="flex items-center gap-4">
          {variant === "landing" && (
            <>
              <Button variant="ghost" className="hidden sm:inline-flex">
                Log in
              </Button>
              <Button variant="primary">Get Started</Button>
            </>
          )}

          {/* Mobile Menu Button */}
          {variant === "landing" && (
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md p-2 text-foreground-muted hover:text-foreground md:hidden"
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
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      {variant === "landing" && mobileMenuOpen && (
        <div className="border-t border-border/50 bg-background md:hidden">
          <nav className="flex flex-col gap-1 px-4 py-4">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="rounded-md px-3 py-2 text-sm text-foreground-muted transition-colors hover:bg-background-elevated hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="mt-4 flex flex-col gap-2">
              <Button variant="ghost" className="w-full justify-center">
                Log in
              </Button>
              <Button variant="primary" className="w-full justify-center">
                Get Started
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
