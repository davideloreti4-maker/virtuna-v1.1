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
