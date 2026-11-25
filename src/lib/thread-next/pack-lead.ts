/**
 * pack-lead.ts — who leads a hook or idea pack, and the one computed sentence under it
 * (spec §3 rule 6).
 *
 * "Best" only when EVERY row is simulated and the leader is at least 10 points ahead of the
 * second. The sentence is computed from the numbers; the app has no source for a reason, so none
 * is written. It always says who is ahead and by how much (review 2026-11-23: "No clear winner."
 * left the creator with nothing after paying for the runs, while the button still named a row).
 *
 * Pure: no React.
 */

export interface Lead {
  /** Every row has a number. */
  allDone: boolean;
  /** 0-based row of the highest number (first on a tie); null when no row has one. */
  top: number | null;
  /** `top`, only when all rows are done, there are at least 2, and it leads by 10 or more. */
  best: number | null;
  /** Points between the top and the second, only when all rows are done and there are at least 2. */
  lead: number | null;
}

/** The lead a "Best" needs. */
export const BEST_MARGIN = 10;

const isNumber = (v: number | null): v is number => typeof v === "number" && Number.isFinite(v);

export function leadOf(values: readonly (number | null)[]): Lead {
  const allDone = values.every(isNumber);

  let top: number | null = null;
  let topValue = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i] ?? null;
    if (isNumber(v) && v > topValue) {
      top = i;
      topValue = v;
    }
  }

  if (!allDone || values.length < 2 || top === null) return { allDone, top, best: null, lead: null };

  // allDone: every value is a number here.
  const second = Math.max(...values.filter((_, i) => i !== top) as number[]);
  const lead = topValue - second;
  return { allDone, top, best: lead >= BEST_MARGIN ? top : null, lead };
}

/**
 * The sentence under a pack, null until every row (of 2 or more) is done:
 * - a clear lead (10 or more): "Hook 3 leads by 15 points."
 * - a small lead: "It's close. Hook 1 is ahead by 7 points." (the row the primary scripts)
 * - the top two level: "It's a tie."
 */
export function leadSentence(kind: "hook" | "idea", l: Lead): string | null {
  if (!l.allDone || l.lead === null || l.top === null) return null;
  const noun = kind === "hook" ? "Hook" : "Idea";
  if (l.best !== null) return `${noun} ${l.best + 1} leads by ${l.lead} points.`;
  if (l.lead === 0) return "It's a tie.";
  return `It's close. ${noun} ${l.top + 1} is ahead by ${l.lead} ${l.lead === 1 ? "point" : "points"}.`;
}
