/**
 * corpus-reads.ts — the Discover hub's read layer over the teardown corpus.
 *
 * `outlier_teardowns` + `teardown_collections` are the grounding corpus: until this module
 * they reached the MODEL only (lib/grounding/corpus.ts, vector-ordered RPC) and no
 * user-facing surface rendered them. Both tables have RLS enabled with no policies, so all
 * reads go through the same service client the grounding layer uses (getCorpusClient) —
 * the corpus is global curated content, not user data.
 *
 * Honesty rules are the shipped ones, imported, not re-rolled:
 *   - a row with no baseline_label makes NO claim (hasKnownBaseline);
 *   - "proven" = baselined AND ≥ MIN_OUTLIER_MULTIPLIER (isProofGrade);
 *   - above EXTREME_MULTIPLIER the ratio is a thin-baseline artifact (a creator whose
 *     "usual" was ~1k and one post hit millions — the corpus runs to 20,154×). Those rows
 *     are SHOWN, with the printed number clamped to the top of the band and the ⚠ flag
 *     kept — they are not dropped (B1, owner ruling 2026-08-11). Clamping the display does
 *     not make a thin baseline trustworthy, which is why `extreme` and `proven` are both
 *     still keyed off the RAW multiplier and the row never renders in proven green.
 *
 * ⚠️ Collections come from `teardown_collections` (the curated table), never derived from
 * the teardown taxonomy columns — deriving produced a worse, different set once already.
 *
 * ⚠️ This read deliberately does NOT select `why_it_works` or the three taxonomy columns
 * (`format`, `visual_hook`, `editing_style`). They are DETAIL fields: one open dialog reads
 * one row's worth, and shipping all 524 to every visitor cost 38KB gzip for text nothing
 * rendered (measured 2026-08-02: 113KB gzip with a 220-char excerpt, 173KB with the full
 * essay — which is what it takes to show it whole, since `why_it_works` is a p50 of 578
 * chars, so any excerpt short enough to be cheap breaks mid-sentence). The detail fetches
 * one row by id instead — `app/actions/discover/teardown.ts`.
 */

import { getCorpusClient } from "@/lib/grounding/corpus";
import { hasKnownBaseline, isProofGrade } from "@/lib/grounding/retrieve";
import { MAX_PRINTABLE_MULTIPLIER } from "@/lib/grounding/outlier-gate";

/**
 * Above this, a real ratio stops being a signal a card may present as proof.
 *
 * Re-exported from `outlier-gate.ts` so Discover and the composed card cannot disagree about
 * the band (B1). This file used to declare its own `= 100`; two literals that happen to agree
 * is exactly the drift the shared constant exists to prevent.
 */
export const EXTREME_MULTIPLIER = MAX_PRINTABLE_MULTIPLIER;

export type CollectionCategory =
  | "formats"
  | "visual_hooks"
  | "editing_styles"
  | "signature_series";

/** One extracted teardown, trimmed to what the Discover cards + detail render. */
export interface CorpusVideo {
  id: string;
  /** Source URL — what the discover→remix chain handoff posts. */
  videoUrl: string | null;
  coverUrl: string | null;
  handle: string | null;
  /** What the video actually says in its first seconds — the card line. */
  spokenHook: string | null;
  /** The reusable pattern — the detail line, never the card line. */
  template: string | null;
  archetype: string | null;
  niche: string | null;
  views: number;
  /** `instagram` | `tiktok` | `youtube` — all three are real in the corpus (63/33/4%). */
  platform: string | null;
  /** Fraction, not percent: 0.024 is 2.4%. Present on 531 of 532 rows, max 0.24 —
   *  so a 0-100% range control would leave three quarters of its track dead. */
  engagement: number | null;
  postedAt: string | null;
  /** Honest multiplier — null when the row has no baseline (no basis, no number). */
  multiplier: number | null;
  baselineLabel: string | null;
  /** Baselined AND ≥3× (isProofGrade). */
  proven: boolean;
  /** Baselined but past the thin-baseline bar — shown flagged, never as proof. */
  extreme: boolean;
}

export interface CollectionSummary {
  slug: string;
  name: string;
  category: CollectionCategory;
  subcategory: string | null;
  /** Member teardown ids, sorted by views desc (NOT by multiplier — ratio-sorting puts
   *  the least trustworthy rows on top of every collection). */
  itemIds: string[];
  provenCount: number;
  /** Up to 4 durable cover urls for the mosaic. */
  coverUrls: string[];
}

export interface DiscoverCorpus {
  /** Every extracted teardown, keyed by id. */
  teardowns: Record<string, CorpusVideo>;
  /** The outliers feed pool: proven (extremes included, clamped + flagged), posted_at desc. */
  feedIds: string[];
  /** All curated collections, grouped/ordered by the UI. */
  collections: CollectionSummary[];
  // `niches` (niche → count over the feed pool) was removed 2026-08-04 with the counted chip
  // row it fed. The filter panel derives its niche options from the pool it is filtering, so
  // a select can never offer a value that yields nothing — and this file's own rule is that
  // the payload carries only what something renders.
  totals: {
    videos: number;
    proven: number;
    collections: number;
    creators: number;
  };
}

/**
 * The shape a FAILED corpus read degrades to.
 *
 * `getDiscoverCorpus` throws on a Supabase error — the grounding layer's own convention
 * ("RPC failures throw; the caller wraps in try/catch + graceful degradation"). Until
 * 2026-08-02 the caller did neither, so one bad corpus read replaced the whole of
 * Discover with the (app) error screen — taking out Watchlist, which does not read this
 * table at all. `/feed` now catches per-read and falls back to this. It is deliberately
 * empty rather than partial: the surface says it couldn't read, and never renders a
 * confident "0 outliers" that would be indistinguishable from an empty library.
 */
export const EMPTY_CORPUS: DiscoverCorpus = {
  teardowns: {},
  feedIds: [],
  collections: [],
  totals: { videos: 0, proven: 0, collections: 0, creators: 0 },
};

/** Durable covers only for mosaics: rehosted to our storage or ytimg. Signed TikTok CDN
 *  urls expire and 403 — cards handle those with an onError poster, mosaics never get them. */
const isDurableCover = (url: string | null): url is string =>
  !!url && /supabase\.co|ytimg\.com/.test(url);

interface TeardownRow {
  id: string;
  video_url: string | null;
  cover_url: string | null;
  creator_handle: string | null;
  spoken_hook: string | null;
  hook_template: string | null;
  hook_archetype: string | null;
  niche: string | null;
  views: number | null;
  platform: string | null;
  engagement_rate: number | string | null;
  posted_at: string | null;
  outlier_multiplier: number | string | null;
  baseline_label: string | null;
}

/** PostgREST hands `numeric` back as a string. Every numeric column here needs this. */
const num = (v: number | string | null): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

interface MembershipRow {
  teardown_id: string;
  category: CollectionCategory;
  subcategory: string | null;
  name: string;
  slug: string;
}

export function toCorpusVideo(row: TeardownRow): CorpusVideo {
  // numeric columns can arrive as strings through PostgREST — normalize before judging.
  const receiptRow = {
    baseline_label: row.baseline_label,
    outlier_multiplier: num(row.outlier_multiplier),
  };
  const baselined = hasKnownBaseline(receiptRow);
  /** What was MEASURED. Every honesty judgement below reads this, never the clamped display. */
  const rawMultiplier =
    baselined && receiptRow.outlier_multiplier !== null && receiptRow.outlier_multiplier >= 1
      ? receiptRow.outlier_multiplier
      : null;
  // Clamp the DISPLAY at the top of the band (B1) — same rule as composed-card-receipt.ts.
  const multiplier =
    rawMultiplier !== null && rawMultiplier > EXTREME_MULTIPLIER ? EXTREME_MULTIPLIER : rawMultiplier;
  return {
    id: row.id,
    videoUrl: row.video_url,
    coverUrl: row.cover_url,
    handle: row.creator_handle,
    spokenHook: row.spoken_hook,
    template: row.hook_template,
    archetype: row.hook_archetype,
    niche: row.niche,
    views: row.views ?? 0,
    platform: row.platform,
    engagement: num(row.engagement_rate),
    postedAt: row.posted_at,
    multiplier,
    baselineLabel: row.baseline_label,
    proven: isProofGrade(receiptRow),
    extreme: rawMultiplier !== null && rawMultiplier >= EXTREME_MULTIPLIER,
  };
}

/**
 * May this row appear in the outliers feed? Proof-grade is the whole bar (B1).
 *
 * An `extreme` row used to be excluded here. It is now admitted with a clamped number and its
 * ⚠ flag — dropping it and clamping it were the two halves of one band rule disagreeing.
 */
export function isFeedEligible(video: CorpusVideo): boolean {
  return video.proven;
}

/** The whole Discover corpus in one read — feed pool, collections index, niche counts. */
export async function getDiscoverCorpus(): Promise<DiscoverCorpus> {
  const client = getCorpusClient();

  const [teardownRes, membershipRes] = await Promise.all([
    client
      .from("outlier_teardowns")
      .select(
        "id, video_url, cover_url, creator_handle, spoken_hook, hook_template, hook_archetype, niche, views, platform, engagement_rate, posted_at, outlier_multiplier, baseline_label",
      )
      .eq("status", "extracted")
      .limit(1000),
    client
      .from("teardown_collections")
      .select("teardown_id, category, subcategory, name, slug")
      .limit(2000),
  ]);

  if (teardownRes.error) throw teardownRes.error;
  if (membershipRes.error) throw membershipRes.error;

  const rows = (teardownRes.data ?? []) as TeardownRow[];
  const memberships = (membershipRes.data ?? []) as MembershipRow[];

  const teardowns: Record<string, CorpusVideo> = {};
  for (const row of rows) teardowns[row.id] = toCorpusVideo(row);

  const feedIds = Object.values(teardowns)
    .filter(isFeedEligible)
    .sort((a, b) => (Date.parse(b.postedAt ?? "") || 0) - (Date.parse(a.postedAt ?? "") || 0))
    .map((t) => t.id);

  // Group memberships into collections. Key on category+name: `slug` is unique per
  // collection except one reuse across categories, so the pair is the safe identity.
  const grouped = new Map<string, { meta: MembershipRow; ids: string[] }>();
  for (const m of memberships) {
    const key = `${m.category}|${m.name}`;
    const entry = grouped.get(key) ?? { meta: m, ids: [] };
    entry.ids.push(m.teardown_id);
    grouped.set(key, entry);
  }

  const collections: CollectionSummary[] = [...grouped.values()]
    .map(({ meta, ids }) => {
      const items = ids
        .map((id) => teardowns[id])
        .filter((t): t is CorpusVideo => Boolean(t))
        .sort((a, b) => b.views - a.views);
      return {
        slug: meta.slug,
        name: meta.name,
        category: meta.category,
        subcategory: meta.subcategory,
        itemIds: items.map((t) => t.id),
        provenCount: items.filter((t) => t.proven).length,
        coverUrls: items
          .map((t) => t.coverUrl)
          .filter(isDurableCover)
          .slice(0, 4),
      };
    })
    .filter((c) => c.itemIds.length > 0);

  return {
    teardowns,
    feedIds,
    collections,
    totals: {
      videos: rows.length,
      proven: feedIds.length,
      collections: collections.length,
      creators: new Set(rows.map((r) => r.creator_handle).filter(Boolean)).size,
    },
  };
}
