// src/lib/affiliate-utils.ts

// ---------------------------------------------------------------------------
// Currency Formatting
// ---------------------------------------------------------------------------

/**
 * Formats a number as USD currency without decimal places.
 *
 * Uses `Intl.NumberFormat` for locale-aware formatting with
 * thousands separators.
 *
 * @example
 * ```ts
 * formatCurrency(2725)  // "$2,725"
 * formatCurrency(0)     // "$0"
 * formatCurrency(15000) // "$15,000"
 * ```
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ---------------------------------------------------------------------------
// Number Formatting
// ---------------------------------------------------------------------------

/**
 * Formats a number with locale-aware thousands separators.
 *
 * @example
 * ```ts
 * formatNumber(5420)  // "5,420"
 * formatNumber(0)     // "0"
 * formatNumber(1000000) // "1,000,000"
 * ```
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}
