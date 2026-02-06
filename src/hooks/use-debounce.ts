"use client";

import { useRef, useCallback } from "react";

/**
 * Returns a debounced version of the provided callback.
 * Delays invocation until `delay` ms after the last call.
 *
 * @param callback - Function to debounce
 * @param delay - Debounce delay in milliseconds
 * @returns A debounced function with the same signature
 *
 * @example
 * ```tsx
 * const debouncedSearch = useDebouncedCallback((query: string) => {
 *   setFilteredQuery(query);
 * }, 300);
 *
 * <input onChange={(e) => debouncedSearch(e.target.value)} />
 * ```
 */
export function useDebouncedCallback(
  callback: (value: string) => void,
  delay: number
): (value: string) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback(
    (value: string) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => callback(value), delay);
    },
    [callback, delay]
  );
}
