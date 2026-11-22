/**
 * remix-steps.ts — a remix card's `formatBorrowed` ("Visual Hook → Concept → Tools → Footage") as
 * the numbered steps the card draws (spec §4.4): split on "→" or "->", trimmed, the "Borrowed:"
 * prefix dropped, empty steps dropped, at most four.
 *
 * Pure: no React.
 */

export const MAX_STEPS = 4;

export function formatSteps(formatBorrowed: string): string[] {
  return formatBorrowed
    .replace(/^\s*borrowed\s*:/i, "")
    .split(/→|->/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, MAX_STEPS);
}
