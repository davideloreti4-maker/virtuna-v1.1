"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/* ============================================
 * TESTIMONIAL CARD — Raycast-style testimonial pattern
 * Quote with attribution (avatar, name, role, company)
 * ============================================ */

/**
 * Author information for the testimonial.
 */
interface TestimonialAuthor {
  /** Author's display name */
  name: string;
  /** Author's role/title */
  role?: string;
  /** Author's company or organization */
  company?: string;
  /** URL to the author's avatar image */
  avatar?: string;
}

/**
 * Props for the TestimonialCard component.
 */
export interface TestimonialCardProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** The testimonial quote text */
  quote: string;
  /** Author information with name, role, company, and avatar */
  author: TestimonialAuthor;
  /**
   * Featured variant with accent glow border.
   * @default false
   */
  featured?: boolean;
}

/**
 * Extracts initials from a name (first letter of first and last name).
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? "";
  const last = parts[parts.length - 1] ?? first;
  if (parts.length === 1) return first.charAt(0).toUpperCase();
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

/**
 * TestimonialCard — Raycast-style testimonial with quote and attribution.
 *
 * Displays a blockquote with author information including avatar (or initials
 * fallback), name, role, and company. Supports a featured variant with
 * an accent glow border for highlighted testimonials.
 *
 * @example
 * ```tsx
 * // Basic testimonial
 * <TestimonialCard
 *   quote="Virtuna transformed our workflow. The design system is incredibly polished."
 *   author={{
 *     name: "Sarah Chen",
 *     role: "Design Lead",
 *     company: "Acme Inc",
 *   }}
 * />
 *
 * // Featured testimonial with avatar
 * <TestimonialCard
 *   quote="The best design system I've used. Period."
 *   author={{
 *     name: "John Doe",
 *     role: "CTO",
 *     company: "Startup Co",
 *     avatar: "/avatars/john.jpg",
 *   }}
 *   featured
 * />
 *
 * // Minimal testimonial (name only)
 * <TestimonialCard
 *   quote="Clean, fast, and beautiful."
 *   author={{ name: "Alex" }}
 * />
 * ```
 */
const TestimonialCard = React.forwardRef<HTMLDivElement, TestimonialCardProps>(
  ({ quote, author, featured = false, className, ...props }, ref) => {
    const { name, role, company, avatar } = author;
    const initials = getInitials(name);

    return (
      <div
        ref={ref}
        className={cn(
          "relative rounded-[12px] border bg-transparent p-6 transition-colors duration-150 hover:bg-white/[0.02]",
          featured
            ? "border-accent/20 shadow-[0_0_20px_oklch(0.72_0.16_40_/_0.05)]"
            : "border-border",
          className,
        )}
        style={{
          boxShadow: "rgba(255, 255, 255, 0.05) 0px 1px 0px 0px inset",
        }}
        {...props}
      >
        {/* Quote */}
        <blockquote className="mb-6 text-sm leading-relaxed text-foreground">
          <span
            className="mr-0.5 text-foreground-secondary/30"
            aria-hidden="true"
          >
            &ldquo;
          </span>
          {quote}
          <span
            className="ml-0.5 text-foreground-secondary/30"
            aria-hidden="true"
          >
            &rdquo;
          </span>
        </blockquote>

        {/* Attribution */}
        <div className="flex items-center gap-3">
          {/* Avatar or initials fallback */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-elevated text-sm font-medium text-foreground-secondary">
            {avatar ? (
              <img
                src={avatar}
                alt={name}
                className="h-full w-full object-cover"
              />
            ) : (
              initials
            )}
          </div>

          <div>
            <div className="text-sm font-medium text-foreground">{name}</div>
            {(role || company) && (
              <div className="text-xs text-foreground-muted">
                {role}
                {role && company && " at "}
                {company}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);
TestimonialCard.displayName = "TestimonialCard";

export { TestimonialCard };
