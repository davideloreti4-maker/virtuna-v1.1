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
 *     stay in their collections, flagged, and are kept OUT of the outliers feed entirely.
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

/** Above this, a real ratio stops being a signal a card may present as proof. */
export const EXTREME_MULTIPLIER = 100;

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
  /** The outliers feed pool: proven, non-extreme, posted_at desc. */
  feedIds: string[];
  /** All curated collections, grouped/ordered by the UI. */
  collections: CollectionSummary[];
  /** Niche → count over the feed pool (filter chips). */
  niches: { id: string; count: number }[];
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
  niches: [],
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
  posted_at: string | null;
  outlier_multiplier: number | string | null;
  baseline_label: string | null;
}

interface MembershipRow {
  teardown_id: string;
  category: CollectionCategory;
  subcategory: string | null;
  name: string;
  slug: string;
}

function toCorpusVideo(row: TeardownRow): CorpusVideo {
  // numeric columns can arrive as strings through PostgREST — normalize before judging.
  const raw =
    typeof row.outlier_multiplier === "string"
      ? parseFloat(row.outlier_multiplier)
      : row.outlier_multiplier;
  const receiptRow = {
    baseline_label: row.baseline_label,
    outlier_multiplier: typeof raw === "number" && Number.isFinite(raw) ? raw : null,
  };
  const baselined = hasKnownBaseline(receiptRow);
  const multiplier =
    baselined && receiptRow.outlier_multiplier !== null && receiptRow.outlier_multiplier >= 1
      ? receiptRow.outlier_multiplier
      : null;
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
    postedAt: row.posted_at,
    multiplier,
    baselineLabel: row.baseline_label,
    proven: isProofGrade(receiptRow),
    extreme: multiplier !== null && multiplier >= EXTREME_MULTIPLIER,
  };
}

/** The whole Discover corpus in one read — feed pool, collections index, niche counts. */
export async function getDiscoverCorpus(): Promise<DiscoverCorpus> {
  const client = getCorpusClient();

  const [teardownRes, membershipRes] = await Promise.all([
    client
      .from("outlier_teardowns")
      .select(
        "id, video_url, cover_url, creator_handle, spoken_hook, hook_template, hook_archetype, niche, views, posted_at, outlier_multiplier, baseline_label",
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
    .filter((t) => t.proven && !t.extreme)
    .sort((a, b) => (Date.parse(b.postedAt ?? "") || 0) - (Date.parse(a.postedAt ?? "") || 0))
    .map((t) => t.id);

  const nicheCounts = new Map<string, number>();
  for (const id of feedIds) {
    const niche = teardowns[id]?.niche;
    if (niche) nicheCounts.set(niche, (nicheCounts.get(niche) ?? 0) + 1);
  }

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
    niches: [...nicheCounts.entries()]
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count),
    totals: {
      videos: rows.length,
      proven: feedIds.length,
      collections: collections.length,
      creators: new Set(rows.map((r) => r.creator_handle).filter(Boolean)).size,
    },
  };
}
