import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines clsx and tailwind-merge for conditional class merging
 * with proper Tailwind CSS conflict resolution.
 *
 * @example
 * cn("bg-red-500", "bg-blue-500") // => "bg-blue-500"
 * cn("p-4", condition && "p-8") // => "p-4" or "p-8"
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Shared keyboard focus ring for plain text links/anchors that are not the
 * <Button> component (which carries its own ring). Visible focus state is a
 * WCAG AA requirement (FOUND-07) — every interactive element must show where
 * keyboard focus lands. Rounded so the ring traces text-sized targets cleanly.
 */
export const FOCUS_RING =
  "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";
