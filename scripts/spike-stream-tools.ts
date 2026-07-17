/**
 * spike-stream-tools.ts — THROWAWAY de-risk (Plan step 0).
 *
 * Question the single streaming agent loop hinges on: does DashScope's OpenAI-compatible endpoint
 * emit `delta.tool_calls` while streaming (`stream: true` + `tools` + `tool_choice: "auto"`)? Every
 * streaming caller in this repo streams TEXT only; both tool loops are NON-streaming. The spike proved
 * non-streaming tool calls work (3/3) — this proves (or disproves) the STREAMED variant.
 *
 * Prints, per case: whether tool_calls arrive as fragments (index / id / name / argument chunks), how
 * many content deltas stream, and whether text + a tool call co-occur in one turn. Run (sandbox OFF,
 * FOREGROUND — the rtk sandbox silently drops network):
 *   npx tsx scripts/spike-stream-tools.ts
 * Needs .env.local: DASHSCOPE_API_KEY.
 */

import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
const { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } = require("@/lib/engine/qwen/client");
const { SKILL_TOOLS } = require("@/lib/tools/skill-dispatch");
const { runChatAgentStream } = require("@/lib/tools/chat-agent-loop");
const { KC_CHAT_SYSTEM_PROMPT } = require("@/lib/kc/compiled");

const TOOLS = SKILL_TOOLS.map((s: any) => s.schema);

const CASES = [
  { label: "SHOULD call generate_ideas", ask: "Give me 3 ideas for a video about morning routines" },
  { label: "SHOULD stay pure chat", ask: "What actually makes a good hook these days? Just talk me through it." },
];

async function runCase(label: string, ask: string): Promise<void> {
  console.log(`\n─── ${label} ───`);
  console.log(`ask: "${ask}"`);
  const ai = getQwenClient();
  const params: Record<string, unknown> = {
    model: QWEN_REASONING_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a content co-pilot. If the creator asks you to MAKE ideas/hooks/a script, call the " +
          "matching tool. If they are just talking, answer conversationally. Never do both.",
      },
      { role: "user", content: ask },
    ],
    tools: TOOLS,
    tool_choice: "auto",
    stream: true,
    temperature: 0.3,
    seed: QWEN_SEED,
    max_tokens: 400,
  };
  params.enable_thinking = false;

  let contentDeltas = 0;
  let contentSample = "";
  let toolCallFragments = 0;
  const toolAcc: Record<number, { id?: string; name?: string; args: string }> = {};
  let sawTextAndToolTogether = false;

  const stream = await ai.chat.completions.create(params as any);
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) continue;
    const hasText = typeof delta.content === "string" && delta.content.length > 0;
    const hasTool = Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0;
    if (hasText) {
      contentDeltas++;
      if (contentSample.length < 120) contentSample += delta.content;
    }
    if (hasTool) {
      for (const tc of delta.tool_calls) {
        toolCallFragments++;
        const idx = tc.index ?? 0;
        toolAcc[idx] ??= { args: "" };
        if (tc.id) toolAcc[idx].id = tc.id;
        if (tc.function?.name) toolAcc[idx].name = tc.function.name;
        if (tc.function?.arguments) toolAcc[idx].args += tc.function.arguments;
      }
    }
    if (hasText && hasTool) sawTextAndToolTogether = true;
  }

  console.log(`  content deltas: ${contentDeltas}${contentSample ? `  sample: "${contentSample.slice(0, 90)}"` : ""}`);
  console.log(`  tool-call fragments streamed: ${toolCallFragments}`);
  const calls = Object.values(toolAcc);
  if (calls.length) {
    for (const c of calls) console.log(`  → reassembled tool call: name=${c.name} id=${c.id ?? "(none)"} args=${c.args}`);
  } else {
    console.log(`  → no tool call (pure chat)`);
  }
  console.log(`  text+tool co-occurred in one delta: ${sawTextAndToolTogether}`);
  const verdict = calls.length > 0
    ? (toolCallFragments > 1 ? "✅ tool_calls STREAM in fragments (accumulate by index)" : "⚠️ tool_call arrived whole, not fragmented")
    : (contentDeltas > 1 ? "✅ text streams token-by-token" : "⚠️ no streaming observed");
  console.log(`  VERDICT: ${verdict}`);
}

// ─── Part 2: the WHOLE loop, end-to-end, live (mock skill runners → free) ────

// Real schemas so the model routes on the real descriptions; fake runners so no paid engine.
const MOCK_SKILLS = SKILL_TOOLS.map((s: any) => ({
  ...s,
  run: async (args: any) => ({
    blocks: [{ type: "mock-card", props: { skill: s.name, topic: args.topic, draft: args.draft } }],
    warnings: [],
  }),
}));

const LOOP_CASES = [
  { label: "ideas ask → skill call, then streamed close", ask: "Give me 3 ideas for a video about meal prep" },
  { label: "pure chat → streamed answer, no tool", ask: "I'm stuck at 400 followers — talk me through what to focus on." },
];

async function runLoopCase(label: string, ask: string): Promise<void> {
  console.log(`\n─── ${label} ───`);
  console.log(`ask: "${ask}"`);
  let streamed = "";
  const blocks: any[] = [];
  const res = await runChatAgentStream(
    {
      ask,
      systemPrompt: KC_CHAT_SYSTEM_PROMPT,
      grounding: false,
      context: { platform: "tiktok", profileRow: null, audience: null },
      onToken: (d: string) => { streamed += d; },
      onBlock: (b: any) => blocks.push(b),
    },
    { skills: MOCK_SKILLS },
  );
  const ran = res.toolCalls.filter((t: any) => t.ran).map((t: any) => t.name);
  console.log(`  skills run: ${ran.length ? ran.join("+") : "(none — pure chat)"}`);
  console.log(`  cards streamed via onBlock: ${blocks.length}`);
  console.log(`  streamed text (${streamed.length} chars): "${streamed.slice(0, 140).replace(/\n/g, " ")}${streamed.length > 140 ? "…" : ""}"`);
  const ok = ask.includes("ideas") ? ran.includes("generate_ideas") && streamed.length > 0 : ran.length === 0 && streamed.length > 20;
  console.log(`  ${ok ? "✅ loop behaved correctly (one streamed turn, right tool decision)" : "❌ unexpected"}`);
}

async function main(): Promise<void> {
  console.log("SPIKE: does DashScope stream delta.tool_calls?");
  console.log(`model: ${QWEN_REASONING_MODEL}   tools: ${SKILL_TOOLS.map((s: any) => s.name).join(", ")}`);
  for (const c of CASES) {
    try {
      await runCase(c.label, c.ask);
    } catch (e) {
      console.error(`  FATAL in "${c.label}":`, e);
    }
  }
  console.log("\nIf tool_calls stream in fragments AND text streams token-by-token, the single streaming");
  console.log("agent loop is viable. If tool_calls only arrive whole (or not at all while streaming), use");
  console.log("the hybrid fallback (non-streaming decode round, then stream the final text round).");

  console.log("\n\n═══ Part 2: runChatAgentStream end-to-end (real model, mock runners — FREE) ═══");
  for (const c of LOOP_CASES) {
    try {
      await runLoopCase(c.label, c.ask);
    } catch (e) {
      console.error(`  FATAL in "${c.label}":`, e);
    }
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
