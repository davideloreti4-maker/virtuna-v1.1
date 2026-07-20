/**
 * grounding/orchestrator.ts — the gather-and-extract pipeline (§11f build step 1).
 *
 * Productizes the spike loop into a real subsystem call, adding the durable per-account
 * receipt (finding #2) and the §13 cache write:
 *
 *   scrape 30 (search) → cheap select (result-set-median) → profile-scrape survivors
 *   for follower_count → durable receipt (views÷followers) + §12 ≥3× gate → extract
 *   teardowns (Qwen) → cache-write (outlier_teardowns, embedding NULL) → RetrievedExample[]
 *
 * The RetrievedExample[] output is what feeds generation via the one additive
 * assembler.corpus field (§11f step 2). Honesty spine: an example is emitted ONLY for
 * a usable teardown of a real scraped outlier — never fabricated.
 *
 * MVP SCOPE (each an explicit, separable follow-on — NOT silently dropped):
 *  - Query expansion (§11c stage 1) is UPSTREAM — this takes the search query directly.
 *  - Audience-aware prune (§11c stage 2) is DEFERRED → fitLabel is a pre-prune
 *    placeholder ('adjacent'), not the real niche×audience label.
 *  - Embeddings land at cache-write (embedder.ts, DashScope text-embedding-v3 768d —
 *    not gemini), degrade-to-NULL on failure. Reading the cache back is retrieve.ts;
 *    gather-for-run tries it BEFORE calling this scrape pipeline.
 *
 * Runs against prod only after the §13 migration is applied (the upsert targets the new
 * tables). tsc-clean today; live-verified the spike way post-apply.
 */

import { ApifyScrapingProvider } from "@/lib/scraping/apify-provider";
import type { ScrapingProvider, VideoData } from "@/lib/scraping/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RankedOutlier } from "@/lib/discover/outlier-compute";
import { QWEN_REASONING_MODEL } from "@/lib/engine/qwen/client";
import { getCorpusClient, upsertOutlierTeardown } from "./corpus";
import { buildTeardownEmbeddingText, embedTexts } from "./embedder";
import { selectCandidates, accountMultiplier, passesOutlierGate } from "./outlier-gate";
import { extractTeardowns, isUsableTeardown, type ExtractionInput } from "./extract";
import {
  FACET_VOCAB_VERSION,
  type Teardown,
  type RetrievedExample,
  type FitLabel,
  type SourcePool,
} from "./types";

/** Scraped-pool trust (curated > competitor > scraped — §13). */
const TRUST_SCRAPED = 0.6;
/** Pre-prune placeholder fit (real §11c label lands with the audience-prune stage). */
const DEFAULT_FIT: FitLabel = "adjacent";

// ─── Small pure helpers ──────────────────────────────────────────────────────
/** Bare, lowercased @handle parsed from a TikTok video URL (VideoData carries no author). */
export function handleFromUrl(url: string | null | undefined): string | null {
  const m = /@([A-Za-z0-9._]+)/.exec(url ?? "");
  return m?.[1] ? m[1].toLowerCase() : null;
}

/** (likes + comments + shares) / views — the shipped engagement_rate definition. */
function engagementRate(v: VideoData): number | null {
  if (!v.views || v.views <= 0) return null;
  return (v.likes + v.comments + v.shares) / v.views;
}

/** Parse the opening line from a WEBVTT native-subtitle URL (Option A). null on any miss. */
async function fetchOpening(subtitleUrl?: string): Promise<string | null> {
  if (!subtitleUrl) return null;
  try {
    const res = await fetch(subtitleUrl);
    if (!res.ok) return null;
    const vtt = await res.text();
    const lines = vtt
      .split(/\r?\n/)
      .filter((l) => l.trim() && !/^WEBVTT/i.test(l) && !/-->/.test(l) && !/^\d+$/.test(l.trim()));
    const opening = lines.slice(0, 6).join(" ").replace(/\s+/g, " ").trim();
    return opening ? opening.slice(0, 240) : null;
  } catch {
    return null;
  }
}

// ─── Pure mapper (unit-testable without network) ─────────────────────────────
/** Assemble the generation-facing example from a torn-down survivor + its receipt. */
export function toRetrievedExample(args: {
  teardownId: string;
  platform: string;
  ranked: RankedOutlier;
  teardown: Teardown;
  multiplier: number | null;
  baselineLabel: string | null;
  fitLabel: FitLabel;
  sourcePool: SourcePool;
  trustWeight: number;
}): RetrievedExample {
  const { teardownId, platform, ranked, teardown, multiplier, baselineLabel, fitLabel, sourcePool, trustWeight } = args;
  return {
    teardownId,
    handle: handleFromUrl(ranked.videoUrl),
    videoUrl: ranked.videoUrl,
    coverUrl: ranked.coverUrl ?? null,
    platform,
    multiplier,
    views: ranked.views,
    baselineLabel,
    fitLabel,
    hookArchetype: teardown.hookArchetype,
    format: teardown.format,
    visualSetting: teardown.visualHook,
    editingStyle: teardown.editingStyle,
    // The scrape path has no niche classification — that is a corpus-side backfill, not an extraction.
    niche: null,
    spokenHook: teardown.spokenHook,
    hookTemplate: teardown.hookTemplate,
    template: teardown.template,
    idea: teardown.idea,
    whyItWorks: teardown.whyItWorks,
    sourcePool,
    trustWeight,
    fromPersonal: false,
    // Freshly scraped — this row was never matched against a query, so there is no similarity to state.
    similarity: null,
    // No Sandcastles collections either: the technique taxonomy is a property of the CURATED library,
    // and a video we just pulled off Apify was never catalogued by a human. Empty = not catalogued.
    hookTechniques: [],
  };
}

// ─── The pipeline ────────────────────────────────────────────────────────────
export interface GatherInput {
  /** The topic-core search query (query expansion is upstream). */
  query: string;
  platform?: string;
  /** Creator niche slug — stored on the teardown facet (fit label is deferred). */
  niche?: string | null;
  /** Survivors to profile-scrape + tear down (§11c "take ~8"). */
  topN?: number;
  scrapeCount?: number;
}

export interface GatherStats {
  scraped: number;
  selected: number;
  withFollowers: number;
  gated: number;
  usable: number;
}

export interface GatherResult {
  examples: RetrievedExample[];
  stats: GatherStats;
}

/**
 * Gather live outliers for `query`, tear down the survivors, cache them, and return the
 * generation-facing examples. Provider + supabase are injectable (default: real Apify +
 * service client). extractTeardowns may throw on a hard LLM failure → the caller degrades
 * to no-grounding (honesty spine).
 */
export async function gatherAndExtract(
  input: GatherInput,
  deps: { provider?: ScrapingProvider; supabase?: SupabaseClient } = {},
): Promise<GatherResult> {
  const platform = input.platform ?? "tiktok";
  const topN = input.topN ?? 6;
  const scrapeCount = input.scrapeCount ?? 30;
  const provider = deps.provider ?? new ApifyScrapingProvider();
  const supabase = deps.supabase ?? getCorpusClient();

  const empty = (scraped: number): GatherResult => ({
    examples: [],
    stats: { scraped, selected: 0, withFollowers: 0, gated: 0, usable: 0 },
  });

  // 1. scrape (broad, topical) — 2. cheap selection ranking.
  const videos = await provider.scrapeVideos(input.query, scrapeCount, "search");
  if (videos.length === 0) return empty(0);
  const survivors = selectCandidates(videos, topN);
  if (survivors.length === 0) return empty(videos.length);

  // 3. profile-scrape survivors for follower_count (best-effort, parallel — §14 survivors-only).
  const followers = await Promise.all(
    survivors.map(async (v) => {
      const handle = handleFromUrl(v.videoUrl);
      if (!handle) return null;
      try {
        const p = await provider.scrapeProfile(handle);
        return p.followerCount ?? null;
      } catch {
        return null; // honest fallback to the cheap metric below
      }
    }),
  );

  // 4. durable receipt + §12 gate: drop only when we KNOW followers AND it fails ≥3×.
  const gated = survivors
    .map((v, i) => ({ v, followerCount: followers[i], durable: accountMultiplier(v.views, followers[i]) }))
    .filter((g) => !g.durable || passesOutlierGate(g.durable.multiplier));
  const withFollowers = gated.filter((g) => g.durable).length;
  if (gated.length === 0) {
    return { examples: [], stats: { scraped: videos.length, selected: survivors.length, withFollowers: 0, gated: 0, usable: 0 } };
  }

  // 5. extract teardowns (one Qwen call). Openings from native subs where present (mostly Option B).
  const openings = await Promise.all(gated.map((g) => fetchOpening(g.v.subtitleUrl)));
  const inputs: ExtractionInput[] = gated.map((g, i) => ({
    caption: g.v.caption,
    hashtags: g.v.hashtags,
    opening: openings[i] ?? null,
    views: g.v.views,
    multiplier: g.v.multiplier,
    baselineLabel: g.durable?.baselineLabel ?? g.v.baselineLabel,
  }));
  const teardowns = await extractTeardowns(inputs);

  // 5b. embed the usable teardowns (§13 topical formula, ONE batched call).
  // Degrade-safe: an embed failure writes embedding NULL — never blocks the gather.
  const usableIdx = teardowns
    .map((t, i) => (t && isUsableTeardown(t) ? i : -1))
    .filter((i) => i >= 0);
  const embeddings = new Map<number, number[]>();
  try {
    const texts = usableIdx.map((i) =>
      buildTeardownEmbeddingText({
        caption: gated[i]!.v.caption,
        hashtags: gated[i]!.v.hashtags,
        spokenHook: teardowns[i]!.spokenHook,
        ideaAngle: teardowns[i]!.idea?.angle,
      }),
    );
    const embeddable = usableIdx.filter((_, k) => texts[k]!.length > 0);
    const vectors = await embedTexts(texts.filter((t) => t.length > 0));
    embeddable.forEach((idx, k) => embeddings.set(idx, vectors[k]!));
  } catch {
    // embedding is an enhancement, not a gate — rows stay retrievable by facet/recency
  }

  // 6. cache-write each usable teardown + build the example.
  const capturedAt = new Date().toISOString();
  const examples: RetrievedExample[] = [];
  for (let i = 0; i < gated.length; i++) {
    const t = teardowns[i];
    if (!t || !isUsableTeardown(t)) continue;
    const { v, followerCount, durable } = gated[i]!;
    const multiplier = durable?.multiplier ?? v.multiplier;
    const baselineLabel = durable?.baselineLabel ?? v.baselineLabel;

    const teardownId = await upsertOutlierTeardown(supabase, {
      platform,
      platformVideoId: v.platformVideoId,
      videoUrl: v.videoUrl,
      coverUrl: v.coverUrl ?? null,
      creatorHandle: handleFromUrl(v.videoUrl),
      sourcePool: "scraped",
      trustWeight: TRUST_SCRAPED,
      views: v.views,
      followerCount,
      outlierMultiplier: multiplier,
      baselineLabel,
      engagementRate: engagementRate(v),
      postedAt: v.postedAt.toISOString(),
      proofCapturedAt: capturedAt,
      niche: input.niche ?? null,
      hookArchetype: t.hookArchetype,
      format: t.format,
      visualHook: t.visualHook,
      editingStyle: t.editingStyle,
      signatureSeries: t.signatureSeries,
      spokenHook: t.spokenHook,
      hookTemplate: t.hookTemplate,
      hookSource: t.hookSource,
      idea: t.idea,
      template: t.template,
      whyItWorks: t.whyItWorks,
      teardown: t.raw,
      caption: v.caption,
      hashtags: v.hashtags,
      embedding: embeddings.get(i) ?? null,
      extractionTier: t.hookSource === "native_transcript" ? "transcript" : "caption",
      extractionVersion: `v${FACET_VOCAB_VERSION}`,
      model: QWEN_REASONING_MODEL,
      status: "extracted",
    });

    examples.push(
      toRetrievedExample({
        teardownId,
        platform,
        ranked: v,
        teardown: t,
        multiplier,
        baselineLabel,
        fitLabel: DEFAULT_FIT,
        sourcePool: "scraped",
        trustWeight: TRUST_SCRAPED,
      }),
    );
  }

  return {
    examples,
    stats: { scraped: videos.length, selected: survivors.length, withFollowers, gated: gated.length, usable: examples.length },
  };
}
