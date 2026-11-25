/**
 * The multiple's words: what a multiple is measured against, the multiple itself, and a view count.
 * One copy of the rule (the owner settled it on 2026-11-21: "their average" / "their followers", never
 * "usual"), shared by the remix card (`thread-next/remix-answer.tsx`) and Discover
 * (`lib/discover-next/`), so the two screens cannot word one multiple two ways. Pure.
 */

import { formatCount } from "@/lib/competitors-utils";

/**
 * What the multiplier is measured against, in the card's words. The stored `baselineLabel` is never
 * printed: the runners write "vs their usual views" (`blocks.ts`), and spec §3.3 bans "usual". It is
 * read for its meaning only: a usual / average / median / typical baseline is "their average", a
 * follower baseline "their followers", anything else (or none) no basis at all.
 */
export function basisOf(label: string | null | undefined): string | null {
  const l = label?.toLowerCase() ?? "";
  if (/usual|average|median|typical/.test(l)) return "their average";
  if (/follower/.test(l)) return "their followers";
  return null;
}

/** "5.2×" under ten, "40×" from ten: a decimal on a two-digit multiplier says nothing ("40.2×"). */
export function timesLabel(m: number): string {
  return `${m >= 10 ? Math.round(m) : Number(m.toFixed(1))}×`;
}

/**
 * `formatCount` without a decimal from 100K ("849K", not "849.1K"); below that and for millions as it
 * is. Whole thousands that round to a thousand (999,500 and up) are "1M", never "1000K" (nor
 * `formatCount`'s own "999.5K" there).
 */
export function viewsLabel(views: number): string {
  if (views >= 100_000 && views < 1_000_000) {
    const thousands = Math.round(views / 1000);
    return thousands < 1000 ? `${thousands}K` : formatCount(1_000_000);
  }
  return formatCount(views);
}
