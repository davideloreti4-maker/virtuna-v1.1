/**
 * spike-tool-loop.ts — can qwen3.7-plus drive the grounding corpus through
 * OpenAI-style tool-calling on DashScope?
 *
 * THE QUESTION (docs/subsystems/grounding-tools.md §6). The whole
 * corpus-as-a-service design assumes an agentic tool loop: model receives
 * `tools`, emits `tool_calls`, we execute REAL retrieval, feed the rows back,
 * model composes a grounded answer. The engine has never used tool-calling
 * (single-shot json_object everywhere), so this is unverified on our stack.
 * If this spike fails, the fallback is detect-and-prefetch (§6).
 *
 * Three arms, all against the LIVE corpus (real embed → real RPC → real rows):
 *   A. Non-stream round-trip — tool_calls emitted? args valid? final answer grounded?
 *   B. Honest degrade — absurd topic → thin/empty retrieval → does the model
 *      claim proof it doesn't have? (the contract-critical path)
 *   C. Streaming round-trip — chat streams; delta.tool_calls must assemble.
 *
 * Run: npx tsx scripts/spike-tool-loop.ts
 * Needs .env.local: DASHSCOPE_API_KEY + SUPABASE_SERVICE_ROLE_KEY + URL.
 * Read-only against the corpus; costs a few small model calls.
 */

import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });

const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({
  baseUrl: resolve(__dirname, ".."),
  paths: tsconfig.compilerOptions.paths,
});

/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require("@supabase/supabase-js");
const { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } = require("@/lib/engine/qwen/client");
const { embedQueryText } = require("@/lib/grounding/embedder");
const { matchSharedTeardowns } = require("@/lib/grounding/corpus");

const NICHES =
  "content-creation|business|finance|self-improvement|education-science|comedy-entertainment|food|travel|lifestyle|health-fitness|beauty-fashion|tech|art-design|sports|relationships-family|career|other";

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_examples",
      description:
        "Search a curated corpus of 524 proven viral short-form videos (TikTok/Instagram/YouTube). " +
        "Returns real examples with receipts (views, outlier multiplier vs the creator's usual views). " +
        "Use it before making any claim about what works.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Topic/subject to search for" },
          niche: {
            type: "string",
            description: `Optional hard niche filter. One of: ${NICHES}`,
          },
          platform: {
            type: "string",
            description: "Optional platform filter: tiktok | instagram | youtube",
          },
        },
        required: ["query"],
      },
    },
  },
];

const SYSTEM = `You are a short-form content strategist. You may call search_examples to ground answers in a real corpus.

HONESTY CONTRACT (non-negotiable):
- Only cite videos the tool returned. Never invent creators, views, or multipliers.
- An example is "proven" only if its multiplier is >= 3. Below that, call it "one example", not proof.
- If the tool returns grounded:false or nothing relevant, SAY SO plainly and give general craft advice clearly labeled as ungrounded.`;

interface ToolCallLike {
  id: string;
  function: { name: string; arguments: string };
}

async function execSearch(argsJson: string): Promise<string> {
  const args = JSON.parse(argsJson) as { query: string; niche?: string; platform?: string };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("missing supabase env");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const embedding = await embedQueryText(args.query);
  const rows = await matchSharedTeardowns(supabase, {
    embedding,
    count: 5,
    filterNiche: args.niche ?? null,
    filterPlatform: args.platform ?? null,
  });

  const examples = rows.map(
    (r: {
      creator_handle: string | null;
      platform: string;
      niche: string | null;
      hook_archetype: string | null;
      format: string | null;
      spoken_hook: string | null;
      why_it_works: string | null;
      views: number | null;
      outlier_multiplier: number | null;
      baseline_label: string | null;
      similarity: number;
    }) => ({
      handle: r.creator_handle,
      platform: r.platform,
      niche: r.niche,
      archetype: r.hook_archetype,
      format: r.format,
      spokenHook: r.spoken_hook,
      whyItWorks: r.why_it_works?.slice(0, 200),
      views: r.views,
      multiplier: r.outlier_multiplier,
      baseline: r.baseline_label,
      similarity: Number(r.similarity.toFixed(3)),
      proven: (r.outlier_multiplier ?? 0) >= 3,
    }),
  );
  return JSON.stringify({ grounded: examples.length > 0, examples });
}

/** Generic loop: call until finish_reason=stop or 4 rounds. Returns transcript events. */
async function runLoop(userAsk: string, stream: boolean): Promise<{ toolCalls: number; final: string; events: string[] }> {
  const qwen = getQwenClient();
  const events: string[] = [];
  const messages: Array<Record<string, unknown>> = [
    { role: "system", content: SYSTEM },
    { role: "user", content: userAsk },
  ];
  let toolCalls = 0;

  for (let round = 0; round < 4; round++) {
    let content = "";
    let calls: ToolCallLike[] = [];
    let finish = "";

    if (!stream) {
      const res = await qwen.chat.completions.create({
        model: QWEN_REASONING_MODEL,
        temperature: 0,
        seed: QWEN_SEED,
        messages,
        tools: TOOLS,
      });
      const msg = res.choices[0]?.message;
      finish = res.choices[0]?.finish_reason ?? "";
      content = msg?.content ?? "";
      calls = (msg?.tool_calls ?? []) as ToolCallLike[];
    } else {
      const res = await qwen.chat.completions.create({
        model: QWEN_REASONING_MODEL,
        temperature: 0,
        seed: QWEN_SEED,
        messages,
        tools: TOOLS,
        stream: true,
      });
      // Assemble delta.tool_calls by index — the part that must work for chat.
      const acc = new Map<number, { id: string; name: string; args: string }>();
      let chunks = 0;
      for await (const chunk of res) {
        chunks++;
        const d = chunk.choices[0]?.delta;
        if (chunk.choices[0]?.finish_reason) finish = chunk.choices[0].finish_reason;
        if (d?.content) content += d.content;
        for (const tc of d?.tool_calls ?? []) {
          const slot = acc.get(tc.index) ?? { id: "", name: "", args: "" };
          if (tc.id) slot.id += tc.id;
          if (tc.function?.name) slot.name += tc.function.name;
          if (tc.function?.arguments) slot.args += tc.function.arguments;
          acc.set(tc.index, slot);
        }
      }
      events.push(`  [stream] ${chunks} chunks, finish=${finish}`);
      calls = [...acc.values()].map((s) => ({ id: s.id, function: { name: s.name, arguments: s.args } }));
    }

    if (calls.length === 0) {
      events.push(`  round ${round}: final answer (${finish})`);
      return { toolCalls, final: content, events };
    }

    messages.push({ role: "assistant", content: content || null, tool_calls: calls.map((c) => ({ id: c.id, type: "function", function: c.function })) });
    for (const call of calls) {
      toolCalls++;
      events.push(`  round ${round}: tool_call ${call.function.name}(${call.function.arguments})`);
      const result = await execSearch(call.function.arguments);
      const parsed = JSON.parse(result);
      events.push(`    → grounded=${parsed.grounded}, ${parsed.examples.length} examples`);
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }
  return { toolCalls, final: "(loop cap hit)", events };
}

async function arm(label: string, ask: string, stream: boolean): Promise<boolean> {
  console.log(`\n${"█".repeat(90)}\n  ${label}\n  ASK: "${ask}"\n${"█".repeat(90)}`);
  const t0 = Date.now();
  try {
    const { toolCalls, final, events } = await runLoop(ask, stream);
    events.forEach((e) => console.log(e));
    console.log(`\n  FINAL (${Date.now() - t0}ms, ${toolCalls} tool calls):\n  ${final.replace(/\n/g, "\n  ")}`);
    const pass = toolCalls > 0 && final.length > 0 && final !== "(loop cap hit)";
    console.log(`\n  ${pass ? "✅ PASS" : "❌ FAIL"} — tool_calls=${toolCalls}, final=${final.length} chars`);
    return pass;
  } catch (e) {
    console.log(`  ❌ FAIL — ${String(e).slice(0, 300)}`);
    return false;
  }
}

async function main(): Promise<void> {
  console.log(`model: ${QWEN_REASONING_MODEL} · temp 0 · seed ${QWEN_SEED} · corpus: live prod`);

  const a = await arm(
    "A — non-stream round-trip",
    "What hooks are working for fitness creators on TikTok right now? Search the corpus and show me real examples.",
    false,
  );
  const b = await arm(
    "B — honest degrade (absurd topic)",
    "What hooks are proven to work for competitive snail-racing livestreamers? I need proof, with numbers.",
    false,
  );
  const c = await arm(
    "C — STREAMING round-trip (chat-integration path)",
    "Show me proven examples of greenscreen explainer videos about money or investing.",
    true,
  );

  console.log(`\n${"═".repeat(90)}`);
  console.log(`  VERDICT: A(round-trip)=${a ? "PASS" : "FAIL"}  B(degrade)=${b ? "PASS" : "FAIL"}(read the answer!)  C(streaming)=${c ? "PASS" : "FAIL"}`);
  console.log(`  Tool loop viable → skip the prefetch fallback: ${a && c ? "YES" : "NO"}`);
  console.log(`${"═".repeat(90)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
