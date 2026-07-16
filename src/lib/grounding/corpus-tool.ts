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

import { retrieveCachedExamples } from "./retrieve";
import { receipt, clip } from "./prompt";
import type { RetrievedExample } from "./types";

// ─── The tool contract ───────────────────────────────────────────────────────

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
      "different queries or axes.",
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
      },
      required: ["query"],
    },
  },
};

/** axis → the retrieval RANKING skill. structural ranks on hook SHAPE across niches; topical on subject. */
function axisToSkill(axis: unknown): "hooks" | "ideas" {
  return axis === "structural" ? "hooks" : "ideas";
}

// ─── Config ──────────────────────────────────────────────────────────────────

/** Rounds of the agentic loop before we stop (self-correction needs >1; runaway guard). */
const DEFAULT_MAX_ROUNDS = 4;
/** Rows fed back to the model per tool call (bounds the model's context per turn). */
const ROWS_PER_CALL = 5;
/** Total distinct references carried forward into the streamed answer (bounds the injected block). */
const MAX_REFERENCES = 6;
/** Output cap for the scout turns — it gathers, it does not write the answer, so keep it cheap. */
const SCOUT_MAX_TOKENS = 300;

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
  error?: string;
}

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
export async function executeCorpusSearch(
  args: { query?: unknown; axis?: unknown },
  platform: string,
  round: number,
  retrieve: typeof retrieveCachedExamples,
): Promise<{ content: string; examples: RetrievedExample[]; record: ToolCallRecord }> {
  const query = typeof args.query === "string" ? args.query.trim() : "";
  const axis = args.axis === "structural" ? "structural" : "topical";
  const record: ToolCallRecord = { round, query, axis, rows: 0 };
  if (!query) {
    record.error = "empty query";
    return { content: JSON.stringify({ error: "query is required" }), examples: [], record };
  }
  try {
    const res = await retrieve({ query, platform, skill: axisToSkill(axis) });
    const examples = (res.examples ?? []).slice(0, ROWS_PER_CALL);
    record.rows = examples.length;
    const results = examples.map((e) => ({
      creator: e.handle ?? null,
      views: e.views ?? null,
      multiplier: e.multiplier
        ? `${e.multiplier}×${e.baselineLabel ? ` (${e.baselineLabel})` : ""}`
        : null,
      hook_archetype: e.hookArchetype ?? null,
      format: e.format ?? null,
      spoken_hook: clip(e.spokenHook ?? "", 200),
      hook_template: clip(e.hookTemplate ?? "", 200),
      belief: clip(e.idea?.belief ?? "", 160),
      reality: clip(e.idea?.reality ?? "", 160),
      structure: e.template?.skeleton?.length ? e.template.skeleton.join(" → ") : null,
      when_to_use: clip(e.template?.guidance ?? "", 200),
    }));
    return {
      content: JSON.stringify({ query, axis, count: results.length, results }),
      examples,
      record,
    };
  } catch (err) {
    record.error = err instanceof Error ? err.message : String(err);
    return { content: JSON.stringify({ error: record.error }), examples: [], record };
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
        let args: { query?: unknown; axis?: unknown } = {};
        try {
          args = JSON.parse(call.function?.arguments ?? "{}");
        } catch {
          args = {};
        }
        const { content, examples, record } = await executeCorpusSearch(
          args,
          input.platform,
          round,
          retrieve,
        );
        references.push(...examples);
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
