/**
 * build-pillars — the content-pillar SSOT. Turns the persisted posts + frozen pillars
 * into the `Pillar[]` view-model the /start, /calendar, and /grow rails all render, so
 * the three surfaces read ONE source and agree.
 *
 * Everything here is REAL, derived from the creator's own posts:
 *   - share / count — the pillar's slice of the assigned posts (their actual posting mix)
 *   - cadence / gap — days since the pillar's most recent NON-pinned post (pinned posts
 *     sit at the top for months and would lie about recency)
 *   - tone — a DIRECTIONAL read of how their people respond to the theme: the pillar's
 *     median engagement RATE (eng/views) vs the creator's own baseline. Real signal from
 *     their own numbers, labeled Directional on the surface — never a fabricated reaction.
 *
 * The compute is a PURE function (buildPillars) taking `nowMs` so it's SSR-safe and unit-
 * testable; buildContentPillars is the async DB wrapper.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pillar } from "@/lib/room-contract/mock-room";
import type { Tone } from "@/lib/room-contract/types";
import { listAllPosts, type AccountPost } from "@/lib/account-metrics/account-posts-repo";
import { getPrimaryAccount } from "@/lib/connected-accounts/connected-accounts-repo";
import { listPillars, type ContentPillarRow } from "./pillars-repo";

const DAY_MS = 86_400_000;
/** A pillar unposted this long is "neglected" → the proactive gap nudge. */
const GAP_DAYS = 21;
/**
 * Tone band. Neutral is the honest DEFAULT — a theme that performs about like the creator's
 * usual isn't a "win" or a "risk". Only a CLEAR deviation (±25% off their own baseline
 * engagement rate) earns a colored dot, so the rail reads as a calm signal, not all-red.
 */
const LOVED_RATIO = 1.25;
const BOUNCED_RATIO = 0.75;
const POST_CAP = 80;

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** How hard the audience engaged per unit of reach. Null when a post has no views to rate. */
function engagementRate(p: AccountPost): number | null {
  if (p.views <= 0) return null;
  return (p.likes + p.comments + p.shares + p.saves) / p.views;
}

/** Human recency label from days since the pillar's most recent real (non-pinned) post. */
function cadenceLabel(days: number | null): string {
  if (days == null) return "no recent posts";
  if (days < 1) return "posted today";
  if (days < 2) return "posted yesterday";
  if (days < 7) return `posted ${Math.round(days)} days ago`;
  if (days < 14) return "posted last week";
  if (days < 21) return "posted 2 weeks ago";
  return `none in ${Math.floor(days / 7)} weeks`;
}

function toneFor(pillarRate: number | null, baseline: number): Tone {
  if (pillarRate == null || baseline <= 0) return "neutral";
  const ratio = pillarRate / baseline;
  if (ratio >= LOVED_RATIO) return "loved";
  if (ratio <= BOUNCED_RATIO) return "bounced";
  return "neutral";
}

/**
 * Pure builder — pillars + posts + now → the rail view-model. Pillars with zero assigned
 * posts are dropped (nothing to show); shares are over the ASSIGNED posts so they sum to 1.
 * `gap` is set on the SINGLE most-neglected pillar past GAP_DAYS (the widget footer surfaces
 * one nudge). Order follows the pillars' sort_order.
 */
export function buildPillars(
  pillarRows: ContentPillarRow[],
  posts: AccountPost[],
  nowMs: number,
): Pillar[] {
  const byPillar = new Map<string, AccountPost[]>();
  for (const p of posts) {
    if (!p.pillar_id) continue;
    (byPillar.get(p.pillar_id) ?? byPillar.set(p.pillar_id, []).get(p.pillar_id)!).push(p);
  }

  const assigned = [...byPillar.values()].flat();
  const totalAssigned = assigned.length;
  if (totalAssigned === 0) return [];

  // Creator baseline = MEAN engagement rate across the themed (assigned) posts. Mean (not
  // median) on purpose: the median sits on whichever pillar has the most posts, which would
  // pin that dominant pillar to "neutral" forever and starve "loved". The mean lets a genuinely
  // strong theme clear the bar. Unassigned/untitled posts are excluded so they can't skew it.
  const baseline = mean(
    assigned.map(engagementRate).filter((r): r is number => r != null),
  );

  const built: Array<Pillar & { _days: number | null }> = [];
  for (const row of pillarRows) {
    const ps = byPillar.get(row.id);
    if (!ps || ps.length === 0) continue;

    const rates = ps.map(engagementRate).filter((r): r is number => r != null);
    const pillarRate = rates.length > 0 ? median(rates) : null;

    // recency from the most recent NON-pinned dated post
    const dates = ps
      .filter((p) => !p.is_pinned && p.posted_at)
      .map((p) => new Date(p.posted_at as string).getTime())
      .filter((t) => Number.isFinite(t));
    const days = dates.length > 0 ? (nowMs - Math.max(...dates)) / DAY_MS : null;

    built.push({
      id: row.id,
      name: row.name,
      share: ps.length / totalAssigned,
      count: ps.length,
      tone: toneFor(pillarRate, baseline),
      cadence: cadenceLabel(days),
      _days: days,
    });
  }

  // Mark the single most-neglected pillar past the gap threshold.
  let gapId: string | null = null;
  let gapDays = GAP_DAYS;
  for (const b of built) {
    if (b._days != null && b._days >= gapDays) {
      gapDays = b._days;
      gapId = b.id;
    }
  }

  return built.map(({ _days, ...p }) => (p.id === gapId ? { ...p, gap: true } : p));
}

/**
 * Async wrapper — read one account's frozen pillars + posts, then build. Pillar rows,
 * posts, and assignments are all account-scoped, so the mix/cadence/tone reflect one
 * handle, never merged. Defaults to the user's primary account; pass `accountId` (the
 * "Your account" switcher) to build for a specific connected account. Empty ⇒ honest
 * empty state (the account genuinely hasn't been clustered / has too few posts).
 */
export async function buildContentPillars(
  supabase: SupabaseClient,
  userId: string,
  accountId?: string,
): Promise<Pillar[]> {
  const resolvedAccountId =
    accountId ?? (await getPrimaryAccount(supabase, userId))?.id;
  if (!resolvedAccountId) return [];
  const [pillarRows, posts] = await Promise.all([
    listPillars(supabase, resolvedAccountId),
    listAllPosts(supabase, resolvedAccountId, POST_CAP),
  ]);
  if (pillarRows.length === 0) return [];
  return buildPillars(pillarRows, posts, Date.now());
}
