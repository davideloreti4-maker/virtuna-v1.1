"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState, type ReactNode, type CSSProperties } from "react";

export interface GlassNavbarProps {
  /** Logo/brand element */
  logo?: ReactNode;
  /** Navigation items (center) */
  children?: ReactNode;
  /** Right side actions (buttons, etc.) */
  actions?: ReactNode;
  /** Make navbar sticky at top */
  sticky?: boolean;
  /** Blur amount increases on scroll */
  blurOnScroll?: boolean;
  /** Height variant */
  height?: "sm" | "md" | "lg";
  /** Additional className */
  className?: string;
  /** Custom style */
  style?: CSSProperties;
}

// Raycast navbar: height 76px, blur 5px, rounded 16px, padding 16px 32px
const heightConfig = {
  sm: "h-14 py-3 px-4",
  md: "h-[76px] py-4 px-6", // Raycast exact
  lg: "h-20 py-5 px-8",
};

/**
 * GlassNavbar - Floating glass navigation bar with Raycast styling.
 *
 * Features:
 * - Glassmorphic background with backdrop blur
 * - Blur intensifies on scroll (optional)
 * - Sticky positioning support
 * - Logo + nav items + actions layout
 * - Height variants
 *
 * @example
 * // Basic navbar
 * <GlassNavbar
 *   logo={<Logo />}
 *   actions={<Button>Sign In</Button>}
 * >
 *   <nav className="flex gap-4">
 *     <a href="/">Home</a>
 *     <a href="/features">Features</a>
 *   </nav>
 * </GlassNavbar>
 *
 * @example
 * // Sticky with blur on scroll
 * <GlassNavbar
 *   sticky
 *   blurOnScroll
 *   logo={<Logo />}
 *   actions={<UserMenu />}
 * >
 *   {navLinks}
 * </GlassNavbar>
 */
export function GlassNavbar({
  logo,
  children,
  actions,
  sticky = false,
  blurOnScroll = false,
  height = "md",
  className,
  style,
}: GlassNavbarProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!blurOnScroll) return;

    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [blurOnScroll]);

  const blurAmount = blurOnScroll
    ? scrolled
      ? "blur(20px)"
      : "blur(5px)" // Raycast default: 5px
    : "blur(10px)";

  return (
    <header
      className={cn(
        // Positioning
        sticky && "sticky top-0 z-40",
        // Container width - Raycast: 1204px
        "w-full max-w-[1204px] mx-auto",
        className
      )}
      style={style}
    >
      <nav
        className={cn(
          // Layout
          "flex items-center justify-between",
          heightConfig[height],
          // Raycast: rounded 16px
          "rounded-[var(--rounding-lg)]",
          // Border
          "border border-white/[0.06]",
          // Transitions
          "transition-all duration-[var(--duration-normal)]",
          "ease-[var(--ease-out)]",
          // Shadow when scrolled
          scrolled && "shadow-lg"
        )}
        style={{
          backgroundColor: scrolled
            ? "rgba(16, 17, 17, 0.8)" // More opaque when scrolled
            : "rgba(16, 17, 17, 0.6)", // Raycast bg-100 with opacity
          backdropFilter: blurAmount,
          WebkitBackdropFilter: blurAmount,
        }}
      >
        {/* Logo */}
        {logo && (
          <div className="flex-shrink-0">
            {logo}
          </div>
        )}

        {/* Center content (nav items) */}
        {children && (
          <div className="flex items-center justify-center flex-1 px-4">
            {children}
          </div>
        )}

        {/* Right side actions */}
        {actions && (
          <div className="flex-shrink-0 flex items-center gap-3">
            {actions}
          </div>
        )}
      </nav>
    </header>
  );
}

export interface NavLinkProps {
  /** Link URL */
  href: string;
  /** Link content */
  children: ReactNode;
  /** Active state */
  active?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * NavLink - Styled navigation link for use within GlassNavbar.
 */
export function NavLink({
  href,
  children,
  active = false,
  className,
}: NavLinkProps) {
  return (
    <a
      href={href}
      className={cn(
        // Base
        "px-3 py-2 rounded-[var(--rounding-sm)]",
        "text-[14px] font-medium",
        "transition-all duration-[var(--duration-fast)]",
        "ease-[var(--ease-out)]",
        // States
        active
          ? "text-[var(--color-fg)] bg-white/5"
          : "text-[var(--color-fg-200)] hover:text-[var(--color-fg)] hover:bg-white/5",
        // Focus
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-transparent)]",
        className
      )}
    >
      {children}
    </a>
  );
}
