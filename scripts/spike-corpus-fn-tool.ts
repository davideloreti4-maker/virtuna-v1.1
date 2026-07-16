/**
 * spike-corpus-fn-tool.ts — can qwen3.7-plus PULL from the corpus on demand via function calling?
 *
 * Everything today is PUSH: the pipeline pre-retrieves a slice and injects it. This spike tests the
 * PULL model the owner wants — expose the 532-row corpus to the model as a `search_corpus` TOOL and
 * let the model call it "if it wants or if it needs to". The gate-free reference/inspire mode (chat-
 * style hook brainstorming), so a good result is directly shippable.
 *
 * THE HONEST TEST: tool_choice is "auto" and the system prompt only INVITES the tool — never forces
 * it. If the model calls it unprompted, that proves the pull loop works with our real model+corpus.
 * Nothing is mocked: real qwen3.7-plus (DashScope), real pgvector retrieval over the real corpus.
 *
 * INSTRUMENTS: per case — did it call search_corpus? how many times? with what queries/axes? how many
 * real rows came back? does the final answer ground in a returned handle? (+ a machine substring check)
 *
 * Run (FOREGROUND, sandbox OFF — rtk silently drops DashScope/Supabase network):
 *   npx tsx scripts/spike-corpus-fn-tool.ts
 * Needs .env.local: DASHSCOPE_API_KEY + SUPABASE_SERVICE_ROLE_KEY (+ URL).
 */

import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

/* eslint-disable @typescript-eslint/no-require-imports */
const { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } = require("@/lib/engine/qwen/client");
const { retrieveCachedExamples } = require("@/lib/grounding/retrieve");

const PLATFORM = "tiktok";
const MAX_ROUNDS = 6;
const ROWS_RETURNED = 5;

const clip = (s: string | null | undefined, n: number): string =>
  !s ? "" : s.length <= n ? s : s.slice(0, n).trimEnd() + "…";

// ─── The tool: a thin wrapper over the EXISTING retrieval primitive ──────────
const SEARCH_TOOL = {
  type: "function",
  function: {
    name: "search_corpus",
    description:
      "Search a library of 532 REAL short-form videos (TikTok/Instagram/YouTube) that measurably " +
      "outperformed their baseline. Returns real examples with their spoken hook, the fill-in-the-blank " +
      "hook template, the narrative structure, the belief→reality tension behind them, the view " +
      "multiplier, and the creator. Call it whenever a proven real-world reference would make your " +
      "answer stronger or more grounded. You decide if and when; you may call it more than once with " +
      "different queries.",
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

interface ToolCallLog {
  round: number;
  query: string;
  axis: string;
  rowsReturned: number;
  handles: string[];
  error?: string;
}

/** Execute one search_corpus call → compact JSON the model reads. Returns {content, log}. */
async function runSearch(
  args: { query?: string; axis?: string },
  round: number,
): Promise<{ content: string; log: ToolCallLog }> {
  const query = (args.query ?? "").trim();
  const axis = args.axis === "structural" ? "structural" : "topical";
  const log: ToolCallLog = { round, query, axis, rowsReturned: 0, handles: [] };
  if (!query) {
    log.error = "empty query";
    return { content: JSON.stringify({ error: "query is required" }), log };
  }
  try {
    // axis → the ranking skill. structural ranks on hook SHAPE across niches (hooks); topical ranks
    // on subject cosine (ideas). Reuses the exact production retrieval, self-wired to Supabase+embed.
    const res = await retrieveCachedExamples({
      query,
      platform: PLATFORM,
      skill: axis === "structural" ? "hooks" : "ideas",
    });
    const rows = (res.examples ?? []).slice(0, ROWS_RETURNED).map((e: any) => ({
      creator: e.handle ?? null,
      views: e.views ?? null,
      multiplier: e.multiplier ? `${e.multiplier}×${e.baselineLabel ? ` (${e.baselineLabel})` : ""}` : null,
      hook_archetype: e.hookArchetype ?? null,
      format: e.format ?? null,
      spoken_hook: clip(e.spokenHook, 200),
      hook_template: clip(e.hookTemplate, 200),
      belief: clip(e.idea?.belief, 160),
      reality: clip(e.idea?.reality, 160),
      structure: e.template?.skeleton?.length ? e.template.skeleton.join(" → ") : null,
      when_to_use: clip(e.template?.guidance, 200),
    }));
    log.rowsReturned = rows.length;
    log.handles = rows.map((r: any) => r.creator).filter(Boolean);
    return {
      content: JSON.stringify({
        query,
        axis,
        matched: res.stats?.matched ?? null,
        archetypes: res.stats?.archetypes ?? null,
        results: rows,
      }),
      log,
    };
  } catch (err) {
    log.error = err instanceof Error ? err.message : String(err);
    return { content: JSON.stringify({ error: log.error }), log };
  }
}

const SYSTEM_PROMPT =
  "You are a short-form content strategist helping a creator write scroll-stopping hooks. You have a " +
  "tool, search_corpus, that searches a library of 532 REAL short-form videos that measurably " +
  "outperformed (proven hooks, structures, and the belief→reality tension behind them). Use it " +
  "whenever a proven, real-world reference would make your suggestions stronger or more grounded — " +
  "YOU decide if and when to call it, and you may call it more than once with different queries or " +
  "axes. When you use a result, ground your suggestion in the real pattern (name which proven " +
  "structure it borrows and from whom). Then give the creator 3 hook options for their topic. Be concise.";

interface AgentResult {
  task: string;
  rounds: number;
  toolCalls: ToolCallLog[];
  finalAnswer: string;
  error?: string;
}

async function runAgent(task: string): Promise<AgentResult> {
  const ai = getQwenClient();
  const messages: any[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: task },
  ];
  const toolCalls: ToolCallLog[] = [];
  let finalAnswer = "";

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    let completion: any;
    try {
      completion = await ai.chat.completions.create({
        model: QWEN_REASONING_MODEL,
        messages,
        tools: [SEARCH_TOOL],
        tool_choice: "auto",
        temperature: 0,
        seed: QWEN_SEED,
        max_tokens: 1600,
        // DashScope extension — thinking OFF (matches MODEL-POLICY; cleanest for tool-calling).
        enable_thinking: false,
      } as any);
    } catch (err) {
      return {
        task,
        rounds: round - 1,
        toolCalls,
        finalAnswer,
        error: `API call failed (round ${round}): ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    const msg = completion.choices?.[0]?.message;
    if (!msg) return { task, rounds: round, toolCalls, finalAnswer, error: "no message in completion" };
    messages.push(msg);

    const calls = msg.tool_calls ?? [];
    if (calls.length === 0) {
      finalAnswer = msg.content ?? "";
      return { task, rounds: round, toolCalls, finalAnswer };
    }

    // Execute every tool call this turn (parallel calls supported → run concurrently).
    const executed = await Promise.all(
      calls.map(async (call: any) => {
        let args: any = {};
        try {
          args = JSON.parse(call.function?.arguments ?? "{}");
        } catch {
          args = {};
        }
        const { content, log } = await runSearch(args, round);
        toolCalls.push(log);
        return { tool_call_id: call.id, role: "tool", content };
      }),
    );
    messages.push(...executed);
  }

  return {
    task,
    rounds: MAX_ROUNDS,
    toolCalls,
    finalAnswer,
    error: "hit MAX_ROUNDS without a final answer",
  };
}

// ─── Cases: creator-realistic asks in niches the corpus covers ───────────────
const CASES = [
  "Help me with hooks for a video about high-protein breakfast ideas for busy people.",
  "I need hooks for a video on how to get your first 1000 followers as a creator.",
  "Give me hooks for a video about why your morning routine isn't actually making you productive.",
];

function report(r: AgentResult): void {
  console.log("\n" + "═".repeat(90));
  console.log("TASK:", r.task);
  if (r.error) console.log("⚠️  ERROR:", r.error);
  console.log(`ROUNDS: ${r.rounds}   TOOL CALLS: ${r.toolCalls.length}`);
  r.toolCalls.forEach((t, i) => {
    console.log(
      `  [${i + 1}] round ${t.round} · axis=${t.axis} · rows=${t.rowsReturned}` +
        (t.error ? ` · ERROR: ${t.error}` : "") +
        `\n      query: "${t.query}"` +
        (t.handles.length ? `\n      returned: ${t.handles.join(", ")}` : ""),
    );
  });
  // Machine check: does the final answer name a returned handle?
  const allHandles = [...new Set(r.toolCalls.flatMap((t) => t.handles))];
  const grounded = allHandles.filter((h) => h && r.finalAnswer.toLowerCase().includes(String(h).toLowerCase()));
  console.log(
    `FINAL ANSWER grounds in a returned handle: ${grounded.length ? "YES → " + grounded.join(", ") : "no (heuristic — read the answer)"}`,
  );
  console.log("\n--- FINAL ANSWER ---\n" + r.finalAnswer);
}

async function main(): Promise<void> {
  console.log("SPIKE: corpus function-calling (pull model)");
  console.log(`model=${QWEN_REASONING_MODEL}  tool_choice=auto  cases=${CASES.length}`);
  const results: AgentResult[] = [];
  for (const task of CASES) {
    results.push(await runAgent(task));
  }
  results.forEach(report);

  // ─── Summary ───
  const used = results.filter((r) => r.toolCalls.length > 0).length;
  const totalCalls = results.reduce((n, r) => n + r.toolCalls.length, 0);
  const errored = results.filter((r) => r.error).length;
  const anyRows = results.some((r) => r.toolCalls.some((t) => t.rowsReturned > 0));
  console.log("\n" + "═".repeat(90));
  console.log("SUMMARY");
  console.log(`  cases that CALLED the tool unprompted: ${used}/${results.length}`);
  console.log(`  total tool calls: ${totalCalls}`);
  console.log(`  any real rows returned: ${anyRows ? "YES" : "NO"}`);
  console.log(`  cases with an API/loop error: ${errored}/${results.length}`);
  console.log(
    `  VERDICT: ${
      errored === results.length
        ? "❌ function-calling did not work (see errors)"
        : used === 0
          ? "⚠️ model never chose to call the tool (loop works, but no pull happened)"
          : "✅ pull model works — the model called search_corpus on its own and got real corpus rows"
    }`,
  );
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
