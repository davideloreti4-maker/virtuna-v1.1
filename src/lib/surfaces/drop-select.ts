/**
 * drop-select.ts — which six corpus rows are today's drops.
 *
 * Selection = rank.ts's structural round-robin ("six examples, six ways to open"),
 * over only the rows a drop card can honestly render (isDropReady), with a DAILY
 * rotating window over the full deterministic sequence — "rotates daily; 489 ready
 * rows ≈ ~80 daily sixes before repeat" (spec §1 freshness). Deep in the sequence
 * (small archetypes exhausted) a window may repeat a shape — a corpus constraint,
 * not a bug; cadence/saturation is owner call #5.
 */
import type { SharedMatchRow } from "@/lib/grounding/corpus";
import { hasHookStructure, selectStructuralExamples } from "@/lib/grounding/rank";

/** rehostCover writes public storage objects — the durable-cover marker. */
const DURABLE_COVER = "/storage/v1/object/public/";

/**
 * The shelf's proof bar (owner ruling 2026-08-10): only rows whose outlier
 * multiplier is ABOVE this print — the card's receipt is "N× their usual views".
 */
export const DROP_MIN_MULTIPLIER = 3;

/** Can a drop card honestly render this row? (Face: still + views + >3× receipt. Receipt: handle.) */
export function isDropReady(row: SharedMatchRow): boolean {
  return (
    typeof row.cover_url === "string" &&
    row.cover_url.includes(DURABLE_COVER) &&
    typeof row.views === "number" &&
    row.views > 0 &&
    typeof row.outlier_multiplier === "number" &&
    row.outlier_multiplier > DROP_MIN_MULTIPLIER &&
    Boolean(row.creator_handle?.trim()) &&
    hasHookStructure(row)
  );
}

/** Days since the Unix epoch, UTC — the daily rotation key (server-side only). */
export function utcDayIndex(now: Date = new Date()): number {
  return Math.floor(now.getTime() / 86_400_000);
}

/**
 * Deterministic daily pick: full structural round-robin sequence, then the day's
 * rotating window of `count` (wrapping; Math.min keeps a small pool duplicate-free).
 */
export function selectDailyDrops(
  rows: SharedMatchRow[],
  count: number,
  dayIndex: number,
): SharedMatchRow[] {
  const ready = rows.filter(isDropReady);
  const seq = selectStructuralExamples(ready, ready.length);
  if (seq.length === 0) return [];
  const take = Math.min(count, seq.length);
  const start = (((dayIndex * count) % seq.length) + seq.length) % seq.length;
  return Array.from({ length: take }, (_, i) => seq[(start + i) % seq.length]!);
}
