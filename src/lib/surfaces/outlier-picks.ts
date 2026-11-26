/**
 * outlier-picks.ts — Home's remix carousel, straight from the collection (owner 2026-11-26: "we can
 * just use videos from the … cache that we have from the collection").
 *
 * No model call, no cache, no spend: the day's six come out of the curated outliers already in
 * `outlier_teardowns`, the same six for everyone (owner: one daily set — outliers are a curated,
 * structural library; niche matters to adapting one, never to choosing it). Each card says the
 * source's own spoken hook, as it was said; the rewrite for the creator's niche happens when they
 * Remix it (the Remix skill, which charges for itself on send).
 *
 * Only rows Remix can take: the Remix route fetches the source with the TikTok scraper, so a card is
 * a TikTok video with a link (`remixOffered`). On top of the shelf's own bar (`isDropReady`: a durable
 * still, views, a >3× receipt, a handle), the hook must be the spoken one — a template ("[X] did Y")
 * is not a line a card can say.
 */

import type { SharedMatchRow } from "@/lib/grounding/corpus";
import { remixOffered } from "@/lib/discover-next/remix";
import { isDropReady, selectDailyDrops } from "./drop-select";
import { compactViews } from "./live-cards";

/** Six a day, as the shelf had. */
export const PICK_COUNT = 6;

/** The columns a pick is chosen and drawn from (`selectStructuralExamples` reads the hook fields). */
export const PICK_COLUMNS =
  "id, platform, platform_video_id, video_url, cover_url, creator_handle, views, outlier_multiplier, spoken_hook, hook_template, hook_archetype";

/** One card, as the carousel draws it (`RemixDrop`'s shape) plus the handle for its receipt. */
export interface OutlierPick {
  contentId: string;
  hook: string;
  coverUrl: string;
  videoUrl: string;
  views: string;
  multiplier: number;
  handle: string;
}

/** Can the carousel show this row, and can its Remix run? */
export function isPickable(row: SharedMatchRow): boolean {
  return isDropReady(row) && Boolean(row.spoken_hook?.trim()) && remixOffered(row.platform, row.video_url);
}

/** Today's six, the same for everyone: the shelf's structural round-robin, rotated by the UTC day. */
export function dailyOutlierPicks(rows: SharedMatchRow[], dayIndex: number): OutlierPick[] {
  // A table read comes back in no set order, and the round-robin keeps its input's order among equals:
  // sort first, or two requests on the same day could draw different sixes.
  const pickable = rows.filter(isPickable).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return selectDailyDrops(pickable, PICK_COUNT, dayIndex).map((row) => ({
    contentId: row.id,
    hook: row.spoken_hook!.trim(),
    coverUrl: row.cover_url!,
    videoUrl: row.video_url!,
    views: compactViews(row.views ?? 0),
    multiplier: row.outlier_multiplier!,
    handle: row.creator_handle!.trim(),
  }));
}
