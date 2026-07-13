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

/**
 * Strip one layer of wrapping quotes from a model-emitted string.
 *
 * Every surface that shows a verbatim — an audience quote, a behavioral tell's evidence, a
 * persona's reasoning — renders it inside typographic quotes the COMPONENT owns
 * (`&ldquo;{value}&rdquo;`). That is correct: the quoting is presentation, so the mark matches
 * the design system rather than whatever the model happened to type.
 *
 * But nothing stops a model from also quoting the string itself, and then the reader sees
 * ""like this"" — which reads as a rendering fault and undercuts the one thing a verbatim is
 * for (sounding like a real person actually said it). Seen live on Profile Read's evidence
 * lines. The fix belongs here, at the boundary where untrusted text meets a quoting component,
 * not in eleven separate renderers.
 *
 * Strips a SINGLE matched pair of straight or curly quotes, and only when the string both opens
 * and closes with one — so an internal quote (He said "no") and a one-sided quote survive
 * untouched. Idempotent for our purposes: the component adds exactly one pair back.
 */
export function stripWrappingQuotes(value: string | null | undefined): string {
  const s = (value ?? '').trim();
  if (s.length < 2) return s;
  const first = s[0]!;
  const last = s[s.length - 1]!;
  const pairs: Record<string, string> = { '"': '"', '“': '”', "'": "'", '‘': '’' };
  return pairs[first] === last ? s.slice(1, -1).trim() : s;
}
