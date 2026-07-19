/**
 * corpus-tool.ts — the PULL model. Expose the 532-row corpus to the model as a `search_corpus`
 * function-calling tool and gather the references the model CHOOSES to pull (reference/inspire mode,
 * §4d of DECISION-grounding-as-remix). Everything else in grounding is PUSH: the pipeline pre-injects a
 * fixed slice. Here the model decides — "if it wants or if it needs to" — what to retrieve.
 *
 * Spike-validated on the real model+corpus (docs/SPIKE-CORPUS-FN-TOOL-2026-07-16.md): qwen3.7-plus
 * calls the tool unprompted, self-corrects when a query whiffs (topical 0 rows → structural retry), and
 * grounds its answer in real cited sources. This module is that loop, made reusable + testable.
 *
 * GATE-FREE: reference mode hands the model real evidence, it does not claim to beat a baseline, so the
 * open view-outcome gate (which blocks the GENERATE path) does not apply here.
 *
 * HONESTY SPINE preserved: the reference block reuses `receipt()` — a curated row can never be dressed
 * "proven". Same discipline as the push renderer.
 */

import {
  retrieveCachedExamples,
  resolveRetrieveConfig,
  type RetrieveConfig,
  type RetrieveFacets,
} from "./retrieve";
import { receipt, clip } from "./prompt";
import type { RetrievedExample } from "./types";

// ─── Config ──────────────────────────────────────────────────────────────────
// Declared before the tool schema below, which reads them at module-init time.

/** Rounds of the agentic loop before we stop (self-correction needs >1; runaway guard). */
const DEFAULT_MAX_ROUNDS = 4;
/** Rows fed back to the model per tool call (bounds the model's context per turn). */
const ROWS_PER_CALL = 5;
/** Ceiling on a model-supplied `limit` — it does not get to blow up its own context. */
const MAX_ROWS_PER_CALL = 12;
/** Total distinct references carried forward into the streamed answer (bounds the injected block). */
const MAX_REFERENCES = 6;
/** Output cap for the scout turns — it gathers, it does not write the answer, so keep it cheap. */
const SCOUT_MAX_TOKENS = 300;

/**
 * The WARRANT floor — the cosine above which a row is allowed to count as evidence ABOUT THE SUBJECT.
 *
 * Deliberately NOT the same number as the retrieval floor in `referenceConfig` (0.4), and the gap is
 * the whole point. Two different questions were being answered by one threshold:
 *
 *   • "should the model SEE this row?"   → recall. Cheap to be wrong; the model reads and discards.
 *   • "may the model CITE this row as being about what was asked?" → warrant. Expensive to be wrong;
 *     this is where a tangential row becomes a fabricated citation.
 *
 * Collapsing the two is what produced the spike's arm-B near-miss: an absurd query returned 5 rows at
 * ~0.5 similarity, `grounded = examples.length > 0` said true, and only the model's own judgment kept
 * the answer honest. A contract that depends on the model choosing to be honest is not a contract.
 *
 * 0.5 is the owner-calibrated topical floor (retrieve.ts, measured 2026-07-17 across 12 realistic asks:
 * 0.50 → 9/12 hit). The corpus median similarity is ~0.45, so anything at or below that is indis-
 * tinguishable from "a random row" — which is the definition of ungrounded.
 */
const WARRANT_FLOOR_DEFAULT = 0.5;

/** Rows above the warrant floor needed before an answer may be called grounded on the subject. */
const WARRANT_MIN_ROWS = 1;

function warrantFloor(): number {
  const raw = Number(process.env.GROUNDING_WARRANT_MIN_SIMILARITY);
  return Number.isFinite(raw) && raw > 0 && raw < 1 ? raw : WARRANT_FLOOR_DEFAULT;
}

// ─── The tool contract ───────────────────────────────────────────────────────

// ─── Facet vocabularies ──────────────────────────────────────────────────────
// The EXACT stored values (prod census, 524 extracted rows). These are enums in the schema on purpose:
// a facet is a filter, and a filter the model can misspell is a filter that silently returns zero rows
// and reads as "the corpus doesn't have that". The spike hit exactly this — it asked for greenscreen,
// the corpus holds 81 greenscreen settings + 77 greenscreen edits, and the answer came back
// "no greenscreen tag" because the interface could not express the question.

/** The visual SETTING (`visual_hook` column — a setting taxonomy, NOT a first-frame device). */
export const VISUAL_SETTINGS = [
  "in_world_vlog", "studio_set", "greenscreen", "in_world_skit", "faceless", "other",
] as const;

export const HOOK_ARCHETYPES = [
  "personal-experience", "tutorial", "question", "secret-reveal-breakdown", "authority",
  "scenario-hypothetical", "list", "case-study", "problem", "ranking-rating", "contrarian",
  "comparison", "trap-mistake",
] as const;

export const FORMATS = [
  "skit", "tutorial", "breakdowns-explainers", "listicle", "challenge", "day-in-the-life",
  "case-study", "personal-learning-epiphany", "episodic-series-social-show", "tier-list",
  "a-vs-b-comparison", "reaction", "personal-update", "heros-journey", "problem-solution",
  "about-me", "levels", "q-and-a", "scenarios", "common-trap-mistake",
] as const;

export const EDITING_STYLES = [
  "vlog-hybrid", "visual-greenscreen", "office-room-yap", "full-screen-hybrid",
  "faceless-visual-explainer", "vlog-interactive", "vlog-pov", "skit-solo", "reaction",
  "skit-transformation-reveal", "split-screen", "skit-group", "notes-article-greenscreen",
  "vlog-reflective", "podcast-clips", "car-yap", "man-on-street-single-interview",
  "comparison-clone", "whiteboard", "vlog-music", "man-on-street-multiple-interviews",
  "vlog-timelapse", "static-image-slideshow", "faceless-clipping", "faceless-animation",
  "faceless-physical-explainer", "faceless-text-conversation", "stop-motion", "skit-lip-sync", "other",
] as const;

export const NICHES = [
  "content-creation", "comedy-entertainment", "self-improvement", "business", "tech", "lifestyle",
  "health-fitness", "beauty-fashion", "education-science", "relationships-family", "food",
  "art-design", "travel", "career", "sports", "finance", "other",
] as const;

/** OpenAI/DashScope tool schema. Handed to `chat.completions.create({ tools: [SEARCH_CORPUS_TOOL] })`. */
export const SEARCH_CORPUS_TOOL = {
  type: "function" as const,
  function: {
    name: "search_corpus",
    description:
      "Search a library of 500+ REAL short-form videos (TikTok/Instagram/YouTube) that measurably " +
      "outperformed their baseline. Returns real examples with their spoken hook, the fill-in-the-blank " +
      "hook template, the narrative structure, the belief→reality tension behind them, the view " +
      "multiplier, and the creator. Call it whenever a proven real-world reference would make your " +
      "answer stronger or more grounded. You decide if and when; you may call it more than once with " +
      "different queries, axes, or filters. " +
      "Use the FILTERS when the creator names a constraint — a platform, a format, a visual setting " +
      "(e.g. greenscreen), an editing style, a niche. Filtering is how you answer 'show me greenscreen " +
      "examples' honestly instead of guessing from a topical search. " +
      "READ THE `grounded` FIELD IN THE RESULT: it is computed, not a row count. `grounded: false` " +
      "means the returned rows are NOT close enough to the subject to be evidence about it — say so, " +
      "and use them only as craft references if at all. Never present ungrounded rows as proof.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "What to search for — a topic, a hook style, or a narrative structure.",
        },
        axis: {
          type: "string",
          enum: ["topical", "structural"],
          description:
            "topical = match the SUBJECT of the video. structural = match the FORMAT/shape of the " +
            "hook regardless of subject (cross-niche transfer). Default topical.",
        },
        platform: { type: "string", enum: ["tiktok", "instagram", "youtube"], description: "Filter to one platform." },
        format: { type: "string", enum: [...FORMATS], description: "Filter to one content format." },
        hook_archetype: { type: "string", enum: [...HOOK_ARCHETYPES], description: "Filter to one hook archetype." },
        visual_setting: {
          type: "string",
          enum: [...VISUAL_SETTINGS],
          description:
            "Filter to one visual SETTING — where/how the video is staged (greenscreen, studio set, " +
            "in-world vlog, in-world skit, faceless). This is the setting, not the first-frame device.",
        },
        editing_style: { type: "string", enum: [...EDITING_STYLES], description: "Filter to one editing style." },
        niche: { type: "string", enum: [...NICHES], description: "Filter to one niche." },
        limit: { type: "integer", description: `How many examples to return (1–${MAX_ROWS_PER_CALL}). Default ${ROWS_PER_CALL}.` },
      },
      required: ["query"],
    },
  },
};

/** axis → the retrieval RANKING skill. structural ranks on hook SHAPE across niches; topical on subject. */
function axisToSkill(axis: unknown): "hooks" | "ideas" {
  return axis === "structural" ? "hooks" : "ideas";
}

/**
 * Reference-mode retrieval config — favors RECALL, because reference/inspire is MODEL-FILTERED: the
 * model reads the returned rows and decides. It does NOT reuse the generate-path's per-skill config:
 *
 *  • structural → the hooks config as-is (floor 0, cross-platform, archetype spread) — already right.
 *  • topical    → the ideas subject-cosine ordering, but with the generate-path guards RELAXED:
 *     - `filterPlatform: false` — a proven example transfers across platforms; and per retrieve.ts the
 *       platform filter is exactly what pushes present subjects UNDER the floor (peaks 0.629 across all
 *       532 rows vs 0.576 across the 177 TikTok-only). This is the measured lever, and structural
 *       already reads cross-platform safely.
 *     - a LOW floor (default 0.4, env `GROUNDING_REF_MIN_SIMILARITY`) — the 0.58 generate floor exists
 *       to keep off-topic rows out of GENERATION; here the model is the filter, so false-positives are
 *       cheap (the model ignores them) while a whiff costs a whole reference. Kept > 0 so a genuinely
 *       absent subject still whiffs and the model diversifies (axis/rephrase), as the spike showed.
 */
function referenceConfig(axis: "topical" | "structural"): RetrieveConfig {
  if (axis === "structural") return resolveRetrieveConfig("hooks");
  const envFloor = Number(process.env.GROUNDING_REF_MIN_SIMILARITY);
  const floor = Number.isFinite(envFloor) && envFloor >= 0 && envFloor < 1 ? envFloor : 0.4;
  return { ...resolveRetrieveConfig("ideas"), filterPlatform: false, minSimilarity: floor };
}

const SCOUT_SYSTEM_PROMPT =
  "You are gathering proven reference material to help a short-form content strategist answer a " +
  "creator's question. You have search_corpus: a library of 500+ REAL videos that measurably " +
  "outperformed (proven hooks, structures, and the belief→reality tension behind them). Call it — " +
  "possibly several times, with different queries or axes — to fetch the most relevant proven " +
  "examples. If a query returns nothing useful, try a different phrasing or the other axis. You are " +
  "NOT writing the final answer; a later step does that. When you have gathered enough (or found " +
  "nothing relevant), reply with one short line and stop.";

// ─── Types ─────────────────────────────────────────────────────────────────

/** The minimal chat-completion surface this module depends on (injectable for tests). */
export type ChatComplete = (params: Record<string, unknown>) => Promise<{
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{ id: string; function?: { name?: string; arguments?: string } }>;
    };
  }>;
}>;

export interface ToolCallRecord {
  round: number;
  query: string;
  axis: string;
  rows: number;
  /** Computed at the tool boundary — did this call actually warrant a claim about the subject? */
  grounded?: boolean;
  /** Facets the model constrained on (telemetry: are the filters being used, and for what?). */
  facets?: RetrieveFacets;
  error?: string;
}

/** What the returned rows entitle the model to say. */
export type Warrant = "topical" | "structural" | "none";

export interface GatherReferencesInput {
  /** The creator's question — what the model is gathering references to answer. */
  ask: string;
  /** Target platform (forwarded to retrieval; structural reads cross-platform regardless). */
  platform: string;
  /** Rounds of the loop before stopping. Defaults to DEFAULT_MAX_ROUNDS. */
  maxRounds?: number;
}

export interface GatherReferencesDeps {
  retrieve?: typeof retrieveCachedExamples;
  /** The model call. Defaults to the shared Qwen client (imported lazily to keep tests network-free). */
  complete?: ChatComplete;
  /** Model id override (defaults to QWEN_REASONING_MODEL). */
  model?: string;
  /** Deterministic seed override (defaults to QWEN_SEED). */
  seed?: number;
}

export interface GatherReferencesResult {
  /** The distinct rows the model chose to pull, deduped + capped — what the streamed answer grounds on. */
  references: RetrievedExample[];
  /** Per-call telemetry (queries, axes, row counts, errors) — for logs / evidence, not the prompt. */
  toolCalls: ToolCallRecord[];
}

// ─── Execute one search_corpus call ────────────────────────────────────────

/**
 * Run one tool call → `{ content, examples }`. `content` is the compact JSON the model reads; `examples`
 * are the decoded rows we harvest. Never throws — a retrieval failure becomes an error payload the model
 * can react to (mirrors the spike: a whiff is recoverable, not fatal).
 */
/** Read one enum-constrained facet off the model's args (anything unrecognised is dropped, not guessed). */
function pickFacet(raw: unknown, allowed: readonly string[]): string | undefined {
  return typeof raw === "string" && allowed.includes(raw) ? raw : undefined;
}

/** The facet filters the model asked for, validated against the stored vocabularies. */
export function parseFacets(args: Record<string, unknown>): RetrieveFacets {
  const facets: RetrieveFacets = {};
  const platform = pickFacet(args.platform, ["tiktok", "instagram", "youtube"]);
  if (platform) facets.platform = platform;
  const format = pickFacet(args.format, FORMATS);
  if (format) facets.format = format;
  const archetype = pickFacet(args.hook_archetype, HOOK_ARCHETYPES);
  if (archetype) facets.hookArchetype = archetype;
  const visual = pickFacet(args.visual_setting, VISUAL_SETTINGS);
  if (visual) facets.visualSetting = visual;
  const editing = pickFacet(args.editing_style, EDITING_STYLES);
  if (editing) facets.editingStyle = editing;
  const niche = pickFacet(args.niche, NICHES);
  if (niche) facets.niche = niche;
  return facets;
}

/**
 * Does this batch WARRANT a claim, and a claim about what?
 *
 * The two axes earn their warrant differently, and conflating them is how a craft reference becomes a
 * fabricated citation:
 *
 *  • topical — the claim is about the SUBJECT ("videos about X do Y"), so the rows must actually be
 *    about X. Cosine decides, at the warrant floor. Below it: "none" — the corpus returned rows
 *    (it always does) but none of them are evidence about this subject.
 *
 *  • structural — the claim is about SHAPE ("this hook pattern works"), which is subject-independent
 *    by design (retrieve.ts: a madlib is a hook with the topic lifted out; every curated row is a
 *    human-picked teaching example). A structural batch is warranted whenever it returned rows — but
 *    it warrants a claim about STRUCTURE ONLY, never about the topic, and the note says so.
 */
function assessWarrant(axis: "topical" | "structural", examples: RetrievedExample[]): {
  warrant: Warrant;
  grounded: boolean;
  onSubject: number;
} {
  if (examples.length === 0) return { warrant: "none", grounded: false, onSubject: 0 };
  const floor = warrantFloor();
  // A null similarity cannot clear a floor it was never measured against — absent is not "passing".
  const onSubject = examples.filter((e) => typeof e.similarity === "number" && e.similarity >= floor).length;
  if (axis === "structural") return { warrant: "structural", grounded: true, onSubject };
  const grounded = onSubject >= WARRANT_MIN_ROWS;
  return { warrant: grounded ? "topical" : "none", grounded, onSubject };
}

/** The instruction the model reads alongside the rows — the contract stated, not assumed. */
function warrantNote(warrant: Warrant, onSubject: number, count: number): string {
  if (warrant === "topical") {
    return `${onSubject} of ${count} returned rows are close enough to the subject to cite as evidence about it. The rest are craft references only.`;
  }
  if (warrant === "structural") {
    return "These rows were selected for their STRUCTURE, not their subject. They are proven examples of the shape — cite them as patterns to borrow, never as evidence about this specific topic.";
  }
  return "NOT GROUNDED: the corpus returned rows, but none are close enough to this subject to be evidence about it (cosine search always returns its nearest rows, even when nothing relevant exists). Do NOT present these as proof about the topic, and do not imply the corpus contains examples of it. Say plainly that you have no proven examples for this, then answer from craft knowledge if you can — labelled as such.";
}

export async function executeCorpusSearch(
  args: { query?: unknown; axis?: unknown; limit?: unknown } & Record<string, unknown>,
  platform: string,
  round: number,
  retrieve: typeof retrieveCachedExamples,
): Promise<{
  content: string;
  examples: RetrievedExample[];
  /**
   * The subset the caller may carry into a CITED reference block. Same rows minus the ones that only
   * cleared recall: a tangential row is legitimate for the model to read and discard, and illegitimate
   * to render under a "proven reference" header. The model sees `examples`; the block gets `citable`.
   */
  citable: RetrievedExample[];
  record: ToolCallRecord;
}> {
  const query = typeof args.query === "string" ? args.query.trim() : "";
  const axis = args.axis === "structural" ? "structural" : "topical";
  const facets = parseFacets(args);
  const rawLimit = Number(args.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), MAX_ROWS_PER_CALL) : ROWS_PER_CALL;
  const record: ToolCallRecord = { round, query, axis, rows: 0, facets };
  if (!query) {
    record.error = "empty query";
    return { content: JSON.stringify({ error: "query is required" }), examples: [], citable: [], record };
  }
  try {
    // Reference-mode config (recall-favoring, model-filtered) — NOT the generate-path per-skill config.
    // The RECALL floor stays low so the model can see and discard; the WARRANT floor below decides what
    // it may cite. Facets push down to the RPC so a narrow filter shrinks the candidate pool itself.
    const res = await retrieve(
      { query, platform, skill: axisToSkill(axis), facets },
      { config: referenceConfig(axis) },
    );
    const examples = (res.examples ?? []).slice(0, limit);
    const { warrant, grounded, onSubject } = assessWarrant(axis, examples);
    record.rows = examples.length;
    record.grounded = grounded;
    const results = examples.map((e) => ({
      creator: e.handle ?? null,
      views: e.views ?? null,
      multiplier: e.multiplier
        ? `${e.multiplier}×${e.baselineLabel ? ` (${e.baselineLabel})` : ""}`
        : null,
      hook_archetype: e.hookArchetype ?? null,
      format: e.format ?? null,
      visual_setting: e.visualSetting ?? null,
      editing_style: e.editingStyle ?? null,
      niche: e.niche ?? null,
      // Per-row, so the model can tell an on-subject citation from a tangential one INSIDE a batch —
      // `grounded: true` means "at least one row qualifies", not "every row does".
      on_subject: typeof e.similarity === "number" ? e.similarity >= warrantFloor() : null,
      spoken_hook: clip(e.spokenHook ?? "", 200),
      hook_template: clip(e.hookTemplate ?? "", 200),
      belief: clip(e.idea?.belief ?? "", 160),
      reality: clip(e.idea?.reality ?? "", 160),
      structure: e.template?.skeleton?.length ? e.template.skeleton.join(" → ") : null,
      when_to_use: clip(e.template?.guidance ?? "", 200),
    }));
    return {
      content: JSON.stringify({
        query,
        axis,
        ...(Object.keys(facets).length > 0 ? { filters: facets } : {}),
        count: results.length,
        grounded,
        warrant,
        note: warrantNote(warrant, onSubject, results.length),
        results,
      }),
      examples,
      // Structural rows are citable as SHAPES (their warrant is curation, not cosine); topical rows are
      // citable only if they cleared the floor. An ungrounded topical batch yields nothing citable.
      citable:
        warrant === "structural"
          ? examples
          : examples.filter((e) => typeof e.similarity === "number" && e.similarity >= warrantFloor()),
      record,
    };
  } catch (err) {
    record.error = err instanceof Error ? err.message : String(err);
    return { content: JSON.stringify({ error: record.error }), examples: [], citable: [], record };
  }
}

// ─── The pull loop ───────────────────────────────────────────────────────────

/** Default model call — lazily imports the shared client so importing this module stays network-free. */
const defaultComplete: ChatComplete = async (params) => {
  /* eslint-disable-next-line @typescript-eslint/no-require-imports */
  const { getQwenClient } = require("@/lib/engine/qwen/client");
  return getQwenClient().chat.completions.create(params);
};

function dedupeAndCap(examples: RetrievedExample[]): RetrievedExample[] {
  const seen = new Set<string>();
  const out: RetrievedExample[] = [];
  for (const e of examples) {
    const key = e.teardownId ?? `${e.handle}:${e.spokenHook}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
    if (out.length >= MAX_REFERENCES) break;
  }
  return out;
}

/**
 * Run the agentic pull loop: the model searches the corpus as it sees fit; we harvest every row it
 * retrieved. Returns the deduped+capped references (what the streamed answer grounds on) + telemetry.
 * The model's own scout text is discarded — a later streamed call writes the user-facing answer.
 *
 * Throws only on a model-call failure (the caller degrades to ungrounded). Retrieval failures are
 * absorbed into the loop (the model can retry), never propagated.
 */
export async function gatherReferencesViaTool(
  input: GatherReferencesInput,
  deps: GatherReferencesDeps = {},
): Promise<GatherReferencesResult> {
  const retrieve = deps.retrieve ?? retrieveCachedExamples;
  const complete = deps.complete ?? defaultComplete;
  let model = deps.model;
  let seed = deps.seed;
  if (model === undefined || seed === undefined) {
    // Lazy — only when not injected, so a hermetic unit test that supplies both never loads the client.
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    const client = require("@/lib/engine/qwen/client");
    model = model ?? client.QWEN_REASONING_MODEL;
    seed = seed ?? client.QWEN_SEED;
  }
  const maxRounds = input.maxRounds ?? DEFAULT_MAX_ROUNDS;

  const messages: Array<Record<string, unknown>> = [
    { role: "system", content: SCOUT_SYSTEM_PROMPT },
    { role: "user", content: input.ask },
  ];
  const references: RetrievedExample[] = [];
  const toolCalls: ToolCallRecord[] = [];

  for (let round = 1; round <= maxRounds; round++) {
    const completion = await complete({
      model,
      messages,
      tools: [SEARCH_CORPUS_TOOL],
      tool_choice: "auto",
      temperature: 0,
      seed,
      max_tokens: SCOUT_MAX_TOKENS,
      enable_thinking: false, // DashScope extension — thinking off (cleanest for tool-calling).
    });

    const msg = completion.choices?.[0]?.message;
    if (!msg) break;
    messages.push(msg as Record<string, unknown>);

    const calls = msg.tool_calls ?? [];
    if (calls.length === 0) break; // model is done gathering (its scout text is discarded)

    const executed = await Promise.all(
      calls.map(async (call) => {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function?.arguments ?? "{}");
        } catch {
          args = {};
        }
        const { content, citable, record } = await executeCorpusSearch(
          args,
          input.platform,
          round,
          retrieve,
        );
        // Only CITABLE rows are carried into the reference block — the model still sees every returned
        // row in `content` and may reason over them, but a row that did not clear its warrant never
        // reaches a block that presents itself as proven material.
        references.push(...citable);
        toolCalls.push(record);
        return { role: "tool", tool_call_id: call.id, content };
      }),
    );
    messages.push(...executed);
  }

  return { references: dedupeAndCap(references), toolCalls };
}

// ─── Reference block (what the streamed answer sees) ─────────────────────────

/** Char ceiling for the injected block — supplementary evidence, not the whole prompt. */
const REFERENCE_BLOCK_BUDGET = 1600;

/**
 * Render harvested references into a system-prompt block the streamed answer can cite. Proven, non-user
 * data (safe in the system prompt). The receipt reuses `receipt()` so a curated exemplar is never
 * dressed as a proven outlier. Empty in → empty out (the caller then injects nothing).
 */
export function buildReferenceBlock(examples: RetrievedExample[]): string {
  if (examples.length === 0) return "";
  const header =
    "PROVEN REFERENCE MATERIAL — real short-form videos that measurably outperformed. Draw on these " +
    "structures when they fit, and attribute honestly: a curated exemplar is a teaching pick, NOT a " +
    "proven outlier — only cite a multiplier where one is stated.";
  const lines: string[] = [];
  let used = header.length;
  examples.forEach((e, i) => {
    const parts = [
      `${i + 1}. @${e.handle ?? "unknown"} — ${receipt(e)}.`,
      e.hookArchetype ? `Archetype: ${e.hookArchetype}.` : "",
      e.spokenHook ? `Hook: "${clip(e.spokenHook, 160)}".` : "",
      e.template?.skeleton?.length ? `Structure: ${clip(e.template.skeleton.join(" → "), 160)}.` : "",
      e.idea?.belief && e.idea?.reality
        ? `Tension: ${clip(e.idea.belief, 120)} → ${clip(e.idea.reality, 120)}.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");
    if (used + parts.length > REFERENCE_BLOCK_BUDGET && lines.length > 0) return; // keep the block bounded
    lines.push(parts);
    used += parts.length;
  });
  return `${header}\n${lines.join("\n")}`;
}
