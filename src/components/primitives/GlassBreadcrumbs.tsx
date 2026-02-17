"use client";

import { cn } from "@/lib/utils";
import { CaretRight, House } from "@phosphor-icons/react";
import { type ReactNode, type CSSProperties } from "react";

export interface BreadcrumbItem {
  /** Display label */
  label: string;
  /** URL or route path (optional for current item) */
  href?: string;
  /** Icon to show before label */
  icon?: ReactNode;
}

export interface GlassBreadcrumbsProps {
  /** Array of breadcrumb items */
  items: BreadcrumbItem[];
  /** Custom separator component */
  separator?: ReactNode;
  /** Show home icon as first item */
  showHomeIcon?: boolean;
  /** Home URL (defaults to "/") */
  homeHref?: string;
  /** Maximum items to show before truncating (0 = no limit) */
  maxItems?: number;
  /** Additional className */
  className?: string;
  /** Custom style */
  style?: CSSProperties;
  /** Click handler for breadcrumb items */
  onItemClick?: (item: BreadcrumbItem, index: number) => void;
}

/**
 * GlassBreadcrumbs - Navigation breadcrumbs with glass pill styling.
 *
 * Features:
 * - Glass background on hover
 * - Raycast-style separator
 * - Optional home icon
 * - Truncation for long paths
 * - Click handler support
 *
 * @example
 * // Basic breadcrumbs
 * <GlassBreadcrumbs
 *   items={[
 *     { label: "Home", href: "/" },
 *     { label: "Products", href: "/products" },
 *     { label: "Details" },
 *   ]}
 * />
 *
 * @example
 * // With home icon and custom separator
 * <GlassBreadcrumbs
 *   showHomeIcon
 *   items={[
 *     { label: "Dashboard", href: "/dashboard" },
 *     { label: "Settings", href: "/settings" },
 *     { label: "Profile" },
 *   ]}
 *   separator={<span>/</span>}
 * />
 *
 * @example
 * // With truncation
 * <GlassBreadcrumbs
 *   maxItems={3}
 *   items={[...longPathItems]}
 * />
 */
export function GlassBreadcrumbs({
  items,
  separator,
  showHomeIcon = false,
  homeHref = "/",
  maxItems = 0,
  className,
  style,
  onItemClick,
}: GlassBreadcrumbsProps) {
  // Handle truncation
  let displayItems = items;
  let showEllipsis = false;

  if (maxItems > 0 && items.length > maxItems) {
    // Show first item, ellipsis, then last (maxItems - 1) items
    const firstItem = items[0];
    const lastItems = items.slice(-(maxItems - 1));
    displayItems = firstItem ? [firstItem, ...lastItems] : lastItems;
    showEllipsis = true;
  }

  const defaultSeparator = (
    <CaretRight
      size={12}
      weight="bold"
      className="text-[var(--color-fg-400)] mx-1"
    />
  );

  const separatorElement = separator || defaultSeparator;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center", className)}
      style={style}
    >
      <ol className="flex items-center gap-0.5 flex-wrap">
        {/* Home icon */}
        {showHomeIcon && (
          <>
            <li>
              <a
                href={homeHref}
                onClick={(e) => {
                  if (onItemClick) {
                    e.preventDefault();
                    onItemClick({ label: "Home", href: homeHref }, -1);
                  }
                }}
                className={cn(
                  "inline-flex items-center justify-center",
                  "px-2 py-1.5 rounded-[var(--rounding-sm)]",
                  "text-[var(--color-fg-300)]",
                  "transition-all duration-[var(--duration-fast)]",
                  "ease-[var(--ease-out)]",
                  "hover:text-[var(--color-fg)]",
                  "hover:bg-white/5",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-transparent)]"
                )}
                aria-label="Home"
              >
                <House size={16} weight="bold" />
              </a>
            </li>
            <li className="flex items-center" aria-hidden="true">
              {separatorElement}
            </li>
          </>
        )}

        {/* Breadcrumb items */}
        {displayItems.map((item, index) => {
          const isLast = index === displayItems.length - 1;
          const originalIndex = showEllipsis && index > 0
            ? items.length - (displayItems.length - index)
            : index;

          // Show ellipsis after first item when truncating
          const showEllipsisBefore = showEllipsis && index === 1;

          return (
            <li key={`${item.label}-${index}`} className="flex items-center">
              {/* Ellipsis */}
              {showEllipsisBefore && (
                <>
                  <span
                    className={cn(
                      "px-2 py-1.5",
                      "text-[var(--color-fg-400)] text-[14px]"
                    )}
                  >
                    ...
                  </span>
                  <span className="flex items-center" aria-hidden="true">
                    {separatorElement}
                  </span>
                </>
              )}

              {/* Separator (not before first item or after ellipsis) */}
              {index > 0 && !showEllipsisBefore && (
                <span className="flex items-center" aria-hidden="true">
                  {separatorElement}
                </span>
              )}

              {/* Breadcrumb item */}
              {isLast || !item.href ? (
                // Current page (no link)
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5",
                    "px-2 py-1.5 rounded-[var(--rounding-sm)]",
                    "text-[14px] font-medium",
                    "text-[var(--color-fg)]"
                  )}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.icon}
                  {item.label}
                </span>
              ) : (
                // Linked breadcrumb
                <a
                  href={item.href}
                  onClick={(e) => {
                    if (onItemClick) {
                      e.preventDefault();
                      onItemClick(item, originalIndex);
                    }
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5",
                    "px-2 py-1.5 rounded-[var(--rounding-sm)]",
                    "text-[14px] font-medium",
                    "text-[var(--color-fg-300)]",
                    "transition-all duration-[var(--duration-fast)]",
                    "ease-[var(--ease-out)]",
                    "hover:text-[var(--color-fg)]",
                    "hover:bg-white/5",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-transparent)]"
                  )}
                >
                  {item.icon}
                  {item.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
