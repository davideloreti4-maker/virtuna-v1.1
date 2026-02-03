import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Heading size to Tailwind class mapping.
 * Based on extraction data from raycast.com.
 */
const headingSizeClasses: Record<1 | 2 | 3 | 4 | 5 | 6, string> = {
  1: "text-5xl font-semibold leading-tight tracking-tight font-display",
  2: "text-4xl font-semibold leading-tight tracking-tight font-display",
  3: "text-2xl font-medium leading-snug",
  4: "text-xl font-medium leading-snug",
  5: "text-lg font-medium",
  6: "text-base font-medium",
};

/**
 * Heading component props
 */
export interface HeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement> {
  /**
   * Heading level (1-6), renders as the corresponding HTML tag (h1-h6).
   * Determines semantic hierarchy.
   */
  level: 1 | 2 | 3 | 4 | 5 | 6;

  /**
   * Visual size override (1-6). Defaults to the level value.
   * Use when visual hierarchy differs from semantic hierarchy.
   *
   * @example
   * ```tsx
   * // Renders as h1 but styled as h2 size
   * <Heading level={1} size={2}>Title</Heading>
   * ```
   */
  size?: 1 | 2 | 3 | 4 | 5 | 6;
}

/**
 * Heading component for semantic headings (h1-h6).
 *
 * Features:
 * - Renders correct semantic HTML tag based on level
 * - Visual size can be overridden independently
 * - Uses design system typography scale from extraction
 *
 * @example
 * ```tsx
 * // Page title
 * <Heading level={1}>Welcome to Virtuna</Heading>
 *
 * // Section heading
 * <Heading level={2}>Features</Heading>
 *
 * // Subsection
 * <Heading level={3}>Performance</Heading>
 *
 * // Visual override (h1 tag, h3 styling)
 * <Heading level={1} size={3}>Compact Title</Heading>
 * ```
 */
const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ level, size, className, children, ...props }, ref) => {
    const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    const visualSize = size ?? level;

    return (
      <Tag
        className={cn(
          "text-foreground",
          headingSizeClasses[visualSize],
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </Tag>
    );
  }
);
Heading.displayName = "Heading";

/**
 * Text component props
 */
export interface TextProps
  extends React.HTMLAttributes<HTMLParagraphElement> {
  /**
   * Text size variant.
   * - `sm`: 14px
   * - `base`: 16px (default)
   * - `lg`: 18px
   */
  size?: "sm" | "base" | "lg";

  /**
   * When true, uses muted text color.
   * @default false
   */
  muted?: boolean;

  /**
   * HTML element to render as.
   * @default "p"
   */
  as?: "p" | "span" | "div";
}

/**
 * Text size to Tailwind class mapping
 */
const textSizeClasses: Record<"sm" | "base" | "lg", string> = {
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
};

/**
 * Text component for body text and paragraphs.
 *
 * Features:
 * - 3 sizes: sm (14px), base (16px), lg (18px)
 * - Optional muted color variant
 * - Flexible element rendering (p, span, div)
 *
 * @example
 * ```tsx
 * // Default paragraph
 * <Text>This is body text.</Text>
 *
 * // Small text
 * <Text size="sm">Smaller text for details.</Text>
 *
 * // Large intro text
 * <Text size="lg">Lead paragraph for introductions.</Text>
 *
 * // Muted secondary text
 * <Text muted>Last updated 2 days ago.</Text>
 *
 * // Inline span
 * <Text as="span" size="sm">inline text</Text>
 * ```
 */
const Text = React.forwardRef<HTMLParagraphElement, TextProps>(
  (
    { size = "base", muted = false, as: Component = "p", className, ...props },
    ref
  ) => {
    return (
      <Component
        className={cn(
          textSizeClasses[size],
          muted ? "text-foreground-muted" : "text-foreground",
          className
        )}
        ref={ref as React.Ref<HTMLParagraphElement>}
        {...props}
      />
    );
  }
);
Text.displayName = "Text";

/**
 * Caption component props
 */
export interface CaptionProps
  extends React.HTMLAttributes<HTMLSpanElement> {}

/**
 * Caption component for small, muted text.
 *
 * Use for captions, labels, timestamps, and secondary information.
 * Renders as a span element with xs size (12px) and muted color.
 *
 * @example
 * ```tsx
 * // Image caption
 * <Caption>Photo by John Doe</Caption>
 *
 * // Timestamp
 * <Caption>Updated 3 hours ago</Caption>
 *
 * // Form label hint
 * <Caption>This field is optional.</Caption>
 * ```
 */
const Caption = React.forwardRef<HTMLSpanElement, CaptionProps>(
  ({ className, ...props }, ref) => {
    return (
      <span
        className={cn("text-xs text-foreground-muted", className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Caption.displayName = "Caption";

/**
 * Code component props
 */
export interface CodeProps
  extends React.HTMLAttributes<HTMLElement> {}

/**
 * Code component for inline code snippets.
 *
 * Features:
 * - Monospace font
 * - Subtle background for visual distinction
 * - Proper padding and border radius
 *
 * @example
 * ```tsx
 * // Inline code
 * <Text>
 *   Use the <Code>useState</Code> hook to manage state.
 * </Text>
 *
 * // Commands
 * <Text>
 *   Run <Code>npm install</Code> to install dependencies.
 * </Text>
 *
 * // Variables
 * <Text>
 *   The <Code>NEXT_PUBLIC_API_URL</Code> environment variable is required.
 * </Text>
 * ```
 */
const Code = React.forwardRef<HTMLElement, CodeProps>(
  ({ className, ...props }, ref) => {
    return (
      <code
        className={cn(
          "font-mono text-sm bg-surface px-1.5 py-0.5 rounded",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Code.displayName = "Code";

export { Heading, Text, Caption, Code };
