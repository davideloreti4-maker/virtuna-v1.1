/**
 * content-pillars/cluster — turn a creator's own post captions into named pillars.
 *
 * Two modes, both cost-gated so the daily cron only pays for the model when there's
 * real work:
 *   - FIRST CLUSTER (no pillars yet, ≥ MIN_POSTS): the model names 3–6 themes and
 *     assigns every captioned post to one. The names are then FROZEN (content_pillars).
 *   - CLASSIFY (pillars exist): only the UNASSIGNED posts are handed to the model,
 *     which sorts each into an EXISTING pillar name (or 'none'). Never re-names — the
 *     creator's vocabulary stays stable across runs.
 *
 * Model I/O is INDEX-BASED (posts presented as [0]…[n], the model returns indices) so
 * it can't hallucinate/typo the long TikTok post ids — we map indices → ids in code.
 *
 * Uses QWEN_REASONING_MODEL (the platform's text model) via the shared DashScope client,
 * temp 0 + fixed seed for reproducibility, mirroring the deepseek.ts JSON convention.
 */

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } from "@/lib/engine/qwen/client";
import { stripModelOutput } from "@/lib/engine/utils/strip";
import { createLogger } from "@/lib/logger";
import {
  listAllPosts,
  assignPostsToPillar,
  type AccountPost,
} from "@/lib/account-metrics/account-posts-repo";
import { listPillars, createPillars } from "./pillars-repo";

const log = createLogger({ module: "content-pillars/cluster" });

/** Below this many captioned posts we don't cluster — too little to find real themes. */
export const MIN_POSTS_TO_CLUSTER = 8;
/** Cap the posts (and the model prompt) — themes are stable well under this. */
const POST_CAP = 80;
/** Truncate each caption in the prompt (themes read from the opening line). */
const CAPTION_MAX = 240;
const MIN_PILLARS = 3;
const MAX_PILLARS = 6;

export type ClusterStatus =
  | "clustered" // first-run: named + assigned fresh pillars
  | "classified" // incremental: sorted new posts into existing pillars
  | "insufficient" // < MIN_POSTS_TO_CLUSTER captioned posts — no pillars yet
  | "noop"; // pillars exist and nothing new to classify

export interface ClusterResult {
  status: ClusterStatus;
  pillarCount: number;
  assigned: number;
}

// ── model call (mirrors the flash text-mode runners: json_object + enable_thinking
//     false + max_tokens cap + abort timeout; 2-attempt retry on bad JSON) ──────────

/** Abort rail. With thinking OFF a small clustering call is ~15s; 90s is generous headroom. */
const CLUSTER_TIMEOUT_MS = 90_000;

async function callModelJSON<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
  const ai = getQwenClient();
  for (let attempt = 0; attempt < 2; attempt++) {
    const finalPrompt =
      attempt === 0
        ? prompt
        : `${prompt}\n\nIMPORTANT: respond with ONLY valid JSON — no markdown fences, no prose.`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLUSTER_TIMEOUT_MS);
    let raw: string;
    try {
      const completion = await ai.chat.completions.create(
        {
          model: QWEN_REASONING_MODEL,
          messages: [{ role: "user", content: finalPrompt }],
          response_format: { type: "json_object" },
          temperature: 0,
          seed: QWEN_SEED,
          enable_thinking: false, // DashScope extension — cast via `as never` below
          max_tokens: 2000, // pillar names + index arrays are small; ample headroom
        } as never,
        { signal: controller.signal },
      );
      raw = completion.choices[0]?.message?.content ?? "";
    } finally {
      clearTimeout(timer);
    }
    try {
      const parsed = schema.safeParse(JSON.parse(stripModelOutput(raw)));
      if (parsed.success) return parsed.data;
      if (attempt === 0) {
        log.warn("cluster JSON validation failed, retrying", {
          issues: parsed.error.issues.slice(0, 3),
        });
      }
    } catch {
      if (attempt === 0) log.warn("cluster response not parseable JSON, retrying");
    }
  }
  throw new Error("cluster model response failed validation after 2 attempts");
}

/** Posts the model can theme (a caption to read from). Index in this array = prompt index. */
function captioned(posts: AccountPost[]): AccountPost[] {
  return posts.filter((p) => p.caption.trim().length > 0);
}

function indexedCaptions(posts: AccountPost[]): string {
  return posts
    .map((p, i) => `[${i}] ${p.caption.trim().replace(/\s+/g, " ").slice(0, CAPTION_MAX)}`)
    .join("\n");
}

// ── first cluster ────────────────────────────────────────────────────────────────

const FirstClusterSchema = z.object({
  pillars: z
    .array(
      z.object({
        name: z.string().min(1).max(40),
        posts: z.array(z.number().int().nonnegative()),
      }),
    )
    .min(1),
});

function firstClusterPrompt(candidates: AccountPost[]): string {
  return `You are organizing a creator's recent short-form posts into their recurring CONTENT PILLARS — the ${MIN_PILLARS}–${MAX_PILLARS} themes their content keeps returning to (the level above any single post).

Here are their posts, one per line, as [index] caption:

${indexedCaptions(candidates)}

Return JSON: {"pillars":[{"name":"...","posts":[0,3,7]}, ...]}

Rules:
- ${MIN_PILLARS} to ${MAX_PILLARS} pillars. Fewer, meaningful themes beat many tiny ones.
- name: 2–4 words, Title Case, human and specific to THIS creator (e.g. "Honest confessionals", "Money & cost", "Myth-busting"). Not generic ("Lifestyle", "Other", "Videos").
- Assign EVERY index to exactly one pillar. Cover all ${candidates.length} posts. No index appears twice.
- posts holds the indices from the list above.`;
}

// ── classify new posts into existing pillars ───────────────────────────────────────

const ClassifySchema = z.object({
  assignments: z.array(
    z.object({ post: z.number().int().nonnegative(), pillar: z.string() }),
  ),
});

function classifyPrompt(unassigned: AccountPost[], pillarNames: string[]): string {
  return `A creator already has these CONTENT PILLARS (themes):
${pillarNames.map((n) => `- ${n}`).join("\n")}

Sort each of these new posts into ONE existing pillar. If a post genuinely fits none, use "none".

${indexedCaptions(unassigned)}

Return JSON: {"assignments":[{"post":0,"pillar":"Money & cost"}, ...]}
- pillar MUST be one of the exact names above, or "none".
- Include every index exactly once.`;
}

// ── orchestration ──────────────────────────────────────────────────────────────────

/**
 * Cluster (first run) or classify (incremental) ONE connected account's pillars from
 * its posts. Best-effort caller (the cron loops every account) — throws only on a hard
 * model/DB failure, which the caller isolates. Returns a status + how many posts were
 * assigned this run.
 *
 * Pillar rows, posts, and assignments are ALL account-scoped (content_pillars.account_id)
 * so each handle keeps its own frozen themes and a secondary account's posts can't leak
 * into the primary's. userId stamps row ownership (RLS + the user-level confirm flow).
 */
export async function clusterPillarsForAccount(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<ClusterResult> {
  const posts = await listAllPosts(supabase, accountId, POST_CAP);
  const existing = await listPillars(supabase, accountId);

  if (existing.length === 0) {
    // First run — need enough captioned posts to find real themes.
    const candidates = captioned(posts);
    if (candidates.length < MIN_POSTS_TO_CLUSTER) {
      return { status: "insufficient", pillarCount: 0, assigned: 0 };
    }
    const result = await callModelJSON(
      firstClusterPrompt(candidates),
      FirstClusterSchema,
    );
    // Clamp to the intended pillar count (keep the first MAX_PILLARS if the model over-produces).
    const chosen = result.pillars.slice(0, MAX_PILLARS);
    const names = chosen.map((p) => p.name.trim()).filter((n) => n.length > 0);
    const pillars = await createPillars(supabase, userId, accountId, names);
    const idByName = new Map(pillars.map((p) => [p.name.toLowerCase(), p.id]));

    let assigned = 0;
    for (const p of chosen) {
      const id = idByName.get(p.name.trim().toLowerCase());
      if (!id) continue;
      const postIds = p.posts
        .map((i) => candidates[i]?.post_id)
        .filter((pid): pid is string => typeof pid === "string");
      if (postIds.length === 0) continue;
      await assignPostsToPillar(supabase, accountId, id, postIds);
      assigned += postIds.length;
    }
    return { status: "clustered", pillarCount: pillars.length, assigned };
  }

  // Incremental — classify only the unassigned, captioned posts into existing pillars.
  const unassigned = captioned(posts).filter((p) => p.pillar_id == null);
  if (unassigned.length === 0) {
    return { status: "noop", pillarCount: existing.length, assigned: 0 };
  }
  const names = existing.map((p) => p.name);
  const result = await callModelJSON(
    classifyPrompt(unassigned, names),
    ClassifySchema,
  );
  const idByName = new Map(existing.map((p) => [p.name.toLowerCase(), p.id]));

  // Group post ids by resolved pillar id (skip 'none' / unknown names).
  const byPillar = new Map<string, string[]>();
  for (const a of result.assignments) {
    const post = unassigned[a.post];
    if (!post) continue;
    const id = idByName.get(a.pillar.trim().toLowerCase());
    if (!id) continue;
    const list = byPillar.get(id) ?? [];
    list.push(post.post_id);
    byPillar.set(id, list);
  }
  let assigned = 0;
  for (const [id, postIds] of byPillar) {
    await assignPostsToPillar(supabase, accountId, id, postIds);
    assigned += postIds.length;
  }
  return { status: "classified", pillarCount: existing.length, assigned };
}
