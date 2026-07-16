/**
 * spike-skill-dispatch.ts — can chat ROUTE to the right skill on its own? (chat-as-agent, all skills)
 *
 * Part 1 (FREE routing proof): real qwen3.7-plus makes the dispatch decision, but the skill runners are
 * MOCKED — so we test "make ideas → generate_ideas, hooks → generate_hooks, script → write_script, just
 * chatting → no tool" across all skills for the cost of a few small model calls, no paid engine.
 * Part 2 (REAL, opt-in SPIKE_REAL=1): one real runIdeasPipeline through the adapter → real idea-card
 * blocks, proving the whole path the chat route will reuse.
 *
 * Run (FOREGROUND, sandbox OFF):
 *   npx tsx scripts/spike-skill-dispatch.ts             # routing only (free)
 *   SPIKE_REAL=1 npx tsx scripts/spike-skill-dispatch.ts # + one real ideas run (paid)
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
const { runSkillDispatch, SKILL_TOOLS } = require("@/lib/tools/skill-dispatch");

const CONTEXT = { platform: "tiktok", profileRow: null, audience: null };

// Mock registry: real schemas (so the model routes on the real descriptions), fake runners (free).
// Echoes both shapes' primary args so the log shows what the model extracted (topic vs draft).
const MOCK_SKILLS = SKILL_TOOLS.map((s: any) => ({
  ...s,
  run: async (args: any) => ({
    blocks: [{ type: "mock-card", props: { skill: s.name, topic: args.topic, draft: args.draft } }],
    warnings: [],
  }),
}));

const ROUTING_CASES = [
  // Generators (topic shape)
  { ask: "Give me 3 ideas for a video about morning routines", expect: "generate_ideas" },
  { ask: "Write me some hooks for a video on meal prep for beginners", expect: "generate_hooks" },
  { ask: "Write a full script for a video about budgeting tips", expect: "write_script" },
  // Analysis (draft shape) — the second adapter: they read a SPECIFIC message, not a subject
  { ask: "How would my audience react to this hook: 'Nobody tells you this about saving money'", expect: "simulate_reaction" },
  { ask: "If I post a daily budgeting series for 30 days, what's the likely outcome for my channel?", expect: "predict_outcome" },
  // Pure chat (no tool)
  { ask: "What do you think actually makes a good hook these days?", expect: "(none — chat)" },
  { ask: "I'm stuck at 400 followers, what should I focus on?", expect: "(none — chat)" },
];

async function main(): Promise<void> {
  console.log("SPIKE: chat-as-agent skill dispatch");
  console.log(`skills: ${SKILL_TOOLS.map((s: any) => s.name).join(", ")}\n`);

  console.log("─── Part 1: routing (real model decides, mock runners — FREE) ───");
  let correct = 0;
  for (const c of ROUTING_CASES) {
    const res = await runSkillDispatch({ ask: c.ask, context: CONTEXT }, { skills: MOCK_SKILLS });
    const ran = res.toolCalls.filter((t: any) => t.ran).map((t: any) => t.name);
    const got = ran.length ? ran.join("+") : "(none — chat)";
    const ok = got === c.expect;
    if (ok) correct++;
    console.log(`\n  ask: "${c.ask}"`);
    console.log(`  expected: ${c.expect}   got: ${got}   ${ok ? "✅" : "❌"}`);
    if (res.toolCalls.length) console.log(`  toolCalls: ${JSON.stringify(res.toolCalls.map((t: any) => ({ name: t.name, ran: t.ran, topic: t.args?.topic, draft: t.args?.draft, note: t.note })))}`);
    console.log(`  closing text: ${res.text ? `"${res.text.slice(0, 160)}"` : "(none)"}`);
  }
  console.log(`\n  routing correct: ${correct}/${ROUTING_CASES.length}`);

  if (process.env.SPIKE_REAL === "1") {
    console.log("\n─── Part 2: ONE REAL ideas run through the adapter (paid) ───");
    const res = await runSkillDispatch(
      { ask: "Give me 3 ideas for a video about high-protein breakfast for busy people", context: CONTEXT },
    );
    const run = res.skillRuns[0];
    if (run) {
      const types = run.blocks.map((b: any) => b.type);
      console.log(`  ran: ${run.name}   blocks: ${run.blocks.length}   types: ${JSON.stringify(types)}`);
      console.log(`  closing text: "${res.text}"`);
      console.log(`  ${run.blocks.length > 0 ? "✅ real skill produced real block-cards through the dispatcher" : "⚠️ no blocks"}`);
    } else {
      console.log(`  ⚠️ model did not run a skill. toolCalls=${JSON.stringify(res.toolCalls)} text="${res.text}"`);
    }
  } else {
    console.log("\n(Part 2 skipped — set SPIKE_REAL=1 to run one real paid ideas generation.)");
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
