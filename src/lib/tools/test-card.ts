/**
 * test-card.ts — a simulation's (video Test) result card, added to ONE named chat, at most once.
 *
 * Two writers, one card:
 *   - `/api/analyze`, at the end of a run that named the chat it was started in (the server path:
 *     the card lands in that chat even if the creator moved to another one or closed the app);
 *   - `/api/tools/test/card`, the client's seal after `complete` (now mostly a no-op that hands the
 *     stored card back; it still covers runs that named no chat, and the degrade → result page).
 *
 * Idempotent by construction, with no schema change: the message id is derived from (analysisId,
 * chatId), so the second writer hits the primary key (insertMessageOnce). Per chat, not per
 * analysis: a cache-hit re-run in another chat returns the SAME analysis and still gets its card.
 *
 * The card itself is unchanged from the route it was lifted from (was `/api/tools/test/card` §4-§10):
 * the user-scoped row read (a forged id finds nothing), the not-ready gate, the CRAFT mapping, the
 * keyframe re-signing, the best-effort fix grounding, the Ambient v2 video seal.
 */

import { createHash } from "node:crypto";
import { findMessage, insertMessageOnce, lastUserTurnText } from "@/lib/threads/messages";
import { setThreadTitleIfEmpty, type ThreadRow } from "@/lib/threads/threads";
import { simulationChatTitle } from "@/lib/threads/title";
import { runHeaderBlock } from "@/lib/tools/run-header";
import { writeSimSeal } from "@/lib/threads/sim-seals";
import { hasBrainData } from "@/lib/surfaces/ambient-v2-brain";
import { buildVideoPopulation } from "@/lib/surfaces/ambient-v2-video-population";
import { AMBIENT_V2_ENABLED } from "@/lib/flags/ambient-v2";
import { kcStamp } from "@/lib/kc/kc-stamp";
import { getAudience, GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";
import { resolveTier } from "@/lib/audience/resolve-tier";
import { signAnalysisFrames } from "@/lib/engine/filmstrip/storage";
import { executeCorpusSearch } from "@/lib/grounding/corpus-tool";
import { retrieveCachedExamples } from "@/lib/grounding/retrieve";
import { buildProofFromSource } from "@/lib/tools/runners/build-proof";
import { predictionResultToVideoTestCard, deriveFixGroundingQueries, type VideoTestSource } from "@/lib/tools/video-test-card";
import type { createClient } from "@/lib/supabase/server";
import type { Audience } from "@/lib/audience/audience-types";
import type {
  ApolloDimension,
  ApolloRewrite,
  CounterfactualResult,
  GeminiVideoSignals,
  HeatmapPayload,
  PersonaBehavioralAggregate,
  PersonaSimulationResult,
  VerbatimPayload,
} from "@/lib/engine/types";

type UserClient = Awaited<ReturnType<typeof createClient>>;

/**
 * How long a run's `complete` waits for its card (`/api/analyze`). Past it, `complete` goes out
 * anyway and the build carries on in the background (kept alive with after()); the client's seal or
 * a later call finishes or finds it, idempotently. A property so a test can shorten it.
 */
export const testCardTiming = { waitMs: 8000 };

/** Wait for `work`, but no longer than `ms`. Resolves either way; never rejects. */
export function withinWait(work: Promise<unknown>, ms = testCardTiming.waitMs): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    work.then(() => undefined, () => undefined),
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/** Ground at most the top N fixes — cheap cache retrieval, but bounded so the card stays snappy. */
const MAX_GROUNDED_FIXES = 2;

export type TestCardResult =
  | { kind: "added"; block: unknown }
  | { kind: "exists"; block: unknown }
  | { kind: "degraded" }
  | { kind: "not_found" }
  | { kind: "not_ready" };

/**
 * The card's message id for one RUN of an analysis in one chat: a uuid (v5 layout) from a hash.
 * `runNonce` is made by the client when the run is armed and sent with the run and its seal, so
 * the same video run again in the same chat (a cache hit: the SAME analysis id) gets its own card,
 * while the two writers of ONE run (server + seal) still meet on one id. Absent: the pair alone.
 */
export function testCardMessageId(analysisId: string, threadId: string, runNonce?: string | null): string {
  const run = runNonce ? `:${runNonce}` : "";
  const h = createHash("sha256").update(`video-test-card:${analysisId}:${threadId}${run}`).digest("hex");
  const variant = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** The video-test-card stored in a message body (either stored shape), or null. */
function cardIn(body: unknown): unknown {
  const blocks = Array.isArray(body) ? body : ((body as { blocks?: unknown[] } | null)?.blocks ?? []);
  return (blocks as Array<{ type?: string }>).find((b) => b?.type === "video-test-card") ?? null;
}

export async function addTestCardToThread(args: {
  supabase: UserClient;
  userId: string;
  analysisId: string;
  thread: ThreadRow;
  /** The run's own nonce (see testCardMessageId); absent for a caller that has none. */
  runNonce?: string | null;
}): Promise<TestCardResult> {
  const { supabase, userId, analysisId, thread, runNonce } = args;
  const messageId = testCardMessageId(analysisId, thread.id, runNonce);

  // Already there (the other writer came first): hand it back, build nothing.
  const existing = await findMessage(messageId);
  if (existing) return { kind: "exists", block: cardIn(existing.body) };

  // The persisted analysis row, user-scoped (a forged id finds nothing).
  const { data: row, error: rowErr } = await supabase
    .from("analysis_results")
    .select("*")
    .eq("id", analysisId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .single();
  if (rowErr || !row) return { kind: "not_found" };

  // A row still running (placeholder overall_score:null) has no result to card yet.
  const overallRaw = (row as { overall_score?: number | string | null }).overall_score;
  const overall = typeof overallRaw === "string" ? Number.parseFloat(overallRaw) : overallRaw;
  if (overall == null || Number.isNaN(overall)) return { kind: "not_ready" };

  // The chat's audience pin → name + tier. General on any miss/failure.
  let audience: Audience = GENERAL_AUDIENCE;
  const activeAudienceId = (thread as ThreadRow & { active_audience_id?: string | null }).active_audience_id ?? null;
  if (activeAudienceId) {
    try {
      const loaded = await getAudience(supabase, activeAudienceId);
      if (loaded) audience = loaded;
    } catch {
      // Non-fatal — General.
    }
  }

  // The narrow CRAFT source from the row.
  const variants =
    (row as {
      variants?: {
        apollo?: { dimensions?: ApolloDimension[]; rewrites?: ApolloRewrite[] } | null;
        craft?: { video_signals?: GeminiVideoSignals | null } | null;
      } | null;
    }).variants ?? null;
  const source: VideoTestSource = {
    apollo_reasoning: variants?.apollo
      ? { dimensions: variants.apollo.dimensions ?? null, rewrites: variants.apollo.rewrites ?? null }
      : null,
    heatmap: (row as { heatmap?: HeatmapPayload | null }).heatmap ?? null,
    counterfactuals: (row as { counterfactuals?: CounterfactualResult | null }).counterfactuals ?? null,
    verbatim: (row as { verbatim?: VerbatimPayload | null }).verbatim ?? null,
  };

  // Nothing to teach: answered before any signing or searching (the mapping is pure, and whether
  // there is a card does not depend on the frames).
  const cardOpts = { analysisId, audienceName: audience.name, tier: resolveTier(audience) };
  if (!predictionResultToVideoTestCard(source, { ...cardOpts, frames: {} })) return { kind: "degraded" };

  const frames = await signAnalysisFrames(analysisId);
  const block = predictionResultToVideoTestCard(source, { ...cardOpts, frames });
  if (!block) return { kind: "degraded" };

  // Ground the top 1–2 fixes in a real corpus outlier (best-effort, never blocks the card). The
  // searches run together: they are independent reads, and this build sits before `complete`.
  try {
    const queries = deriveFixGroundingQueries(source);
    const n = Math.min(MAX_GROUNDED_FIXES, block.props.fixes.length);
    await Promise.all(
      Array.from({ length: n }, async (_, i) => {
        const q = queries[i];
        if (!q) return;
        try {
          const { citable } = await executeCorpusSearch({ query: q.query, axis: q.axis }, "tiktok", i + 1, retrieveCachedExamples);
          const proof = buildProofFromSource(1, citable);
          if (proof) block.props.fixes[i]!.proof = proof;
        } catch {
          /* one fix failing to ground never fails the card */
        }
      }),
    );
  } catch {
    /* grounding is additive */
  }

  // Insert once: the other writer may have landed while this one built the card.
  const { inserted } = await insertMessageOnce(
    messageId,
    thread.id,
    "assistant",
    [runHeaderBlock({ skill: "test", audienceLabel: audience?.name }), block],
    kcStamp().kcGenVersion,
  );
  if (!inserted) return { kind: "exists", block };

  // Name the chat (write-once) by what the creator knows it by, so it can be found in the drawer:
  // a simulation's only user turn is often the dropped file's name, which the general title rule
  // refuses (live check 2026-11-26: such chats listed with no title). Best-effort.
  try {
    const handle =
      (row as { variants?: { source?: { handle?: string | null } | null } | null }).variants?.source?.handle ?? null;
    const title = simulationChatTitle({ userTurn: await lastUserTurnText(thread.id), handle });
    if (title) await setThreadTitleIfEmpty(userId, thread.id, title);
  } catch {
    /* a missing name never fails the card */
  }

  // The Ambient v2 VIDEO depth into the chat's sim_seals (opt-in, non-fatal). Only by the writer
  // that added the card: writeSimSeal is a read-merge-write of the whole sim_seals map from the
  // thread row it is handed, so a second writer could put back an older map.
  if (AMBIENT_V2_ENABLED && hasBrainData(source.heatmap)) {
    const heatmap = source.heatmap!;
    const hold = heatmap.weighted_hook_score ?? heatmap.weighted_completion_pct ?? null;
    if (hold !== null) {
      const foldPopulation = buildVideoPopulation({
        personas: (row as { personas?: PersonaSimulationResult[] | null }).personas ?? [],
        heatmap,
        aggregate: (row as { persona_behavioral_aggregate?: PersonaBehavioralAggregate | null }).persona_behavioral_aggregate ?? null,
      });
      await writeSimSeal(supabase, thread, analysisId, {
        pct: Math.max(0, Math.min(100, Math.round(hold * 100))),
        band: null,
        at: new Date().toISOString(),
        ...(foldPopulation ? { population: foldPopulation.aggregate } : {}),
        video: {
          analysisId,
          stopPct: Math.max(0, Math.min(100, Math.round(hold * 100))),
          craftScore: block.props.craftScore ?? null,
          heatmap,
          videoSignals: variants?.craft?.video_signals ?? null,
          verbatim: source.verbatim,
          ...(foldPopulation ? { skimmedPct: foldPopulation.skimmedPct } : {}),
          ...(foldPopulation?.intents ? { intents: foldPopulation.intents } : {}),
        },
      });
    }
  }

  return { kind: "added", block };
}
