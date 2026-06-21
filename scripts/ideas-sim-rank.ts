/**
 * ideas-sim-rank.ts — Prototype of the Ideas moat loop: generate → simulate → rank.
 *
 * NOT the throwaway D-12 gate (that's kc-gate.ts, 3-arm blind). This is a focused
 * prototype of what the Phase-3 Ideas tool runner will productionize:
 *   1. Generate N ideas with the NEW KC (KC_IDEAS_SYSTEM_PROMPT + assembleBundle).
 *   2. Run SIM-1 Flash on EACH idea individually (per-idea, not one aggregate).
 *   3. Rank ideas by their STOP fraction — surface winners first.
 *
 * This makes the moat visible: the synthetic audience scores each idea, and the
 * ranking is the product value (generate→simulate→rank, the "Read").
 *
 * Run: npx tsx scripts/ideas-sim-rank.ts
 *      npx tsx scripts/ideas-sim-rank.ts --prompt "your creator ask"
 *
 * Requires: DASHSCOPE_API_KEY in .env.local
 * Calls: 1 generate (qwen3.7-plus) + N parallel SIM (qwen3.6-flash). Wall time ≈ 2 stages.
 */

import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync, writeFileSync } from "fs";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { KC_IDEAS_SYSTEM_PROMPT } = require("../src/lib/kc/compiled");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { assembleBundle } = require("../src/lib/kc/assembler");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getQwenClient, QWEN_SEED, QWEN_REASONING_MODEL } = require("../src/lib/engine/qwen/client");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { runFlashTextMode } = require("../src/lib/engine/flash/run-flash-text-mode");

const GEN_MODEL = process.env.GATE_MODEL ?? QWEN_REASONING_MODEL;
const PER_CALL_TIMEOUT_MS = 300_000;
const DELIM = "===IDEA===";

const DEFAULT_PROMPT =
  "Give me 5 ideas for a personal finance creator on TikTok who wants to go viral this week. I help 25-35 year-olds invest their first $1000.";

function parseArgs(): { prompt: string } {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--prompt");
  return { prompt: i !== -1 && argv[i + 1] ? argv[i + 1] : DEFAULT_PROMPT };
}

async function callQwen(systemPrompt: string, userMessage: string): Promise<string> {
  const ai = getQwenClient();
  const params = {
    model: GEN_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature: 0,
    seed: QWEN_SEED,
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);
  try {
    const res = await ai.chat.completions.create(params as never, { signal: controller.signal });
    return res.choices[0]?.message?.content ?? "(empty)";
  } finally {
    clearTimeout(timer);
  }
}

/** SIM one idea → { stop, total, scrollQuotes } via SIM-1 Flash (10 personas). */
async function simIdea(idea: string): Promise<{ stop: number; total: number; scrollQuotes: string[] }> {
  const { result } = await runFlashTextMode(idea, "idea");
  const personas: Array<{ verdict: string; quote: string; archetype: string }> = result.personas;
  const stop = personas.filter((p) => p.verdict === "stop").length;
  const scrollQuotes = personas
    .filter((p) => p.verdict === "scroll")
    .slice(0, 2)
    .map((p) => `${p.archetype}: "${p.quote}"`);
  return { stop, total: personas.length, scrollQuotes };
}

async function main(): Promise<void> {
  const { prompt } = parseArgs();
  console.log("\n══ IDEAS · generate → simulate → rank (new-KC prototype) ══");
  console.log(` Generate: ${GEN_MODEL}   SIM: SIM-1 Flash (per-idea)`);
  console.log(` Prompt: "${prompt.slice(0, 80)}${prompt.length > 80 ? "…" : ""}"\n`);

  // ── Stage 1: generate ideas with the new KC ───────────────────────────────
  const baseUserMsg = assembleBundle({ ask: prompt, platform: "tiktok", mode: "idea" }, null);
  const harnessUserMsg =
    `${baseUserMsg}\n\n[HARNESS — not part of the creator-facing task]: compose the ideas exactly ` +
    `per your normal output discipline, then separate each shipped idea from the next with a line ` +
    `containing only "${DELIM}". Do not mention or number this separator.`;
  console.log(" [stage 1] generating ideas (new-KC)…");
  const raw = await callQwen(KC_IDEAS_SYSTEM_PROMPT, harnessUserMsg);

  const ideas = raw
    .split(DELIM)
    .map((s) => s.trim())
    .filter((s) => s.length > 40); // drop preamble/trailing fragments

  console.log(` [stage 1] ${ideas.length} ideas parsed.`);
  if (ideas.length === 0) {
    console.error(" No ideas parsed — model may not have honored the separator. Raw output:\n");
    console.error(raw);
    process.exit(1);
  }

  // ── Stage 2: SIM each idea in parallel (generate→SIM dependency preserved) ──
  console.log(` [stage 2] running SIM-1 Flash on ${ideas.length} ideas in parallel…\n`);
  const sims = await Promise.all(
    ideas.map((idea) =>
      simIdea(idea).catch((e) => ({ stop: -1, total: 10, scrollQuotes: [`SIM failed: ${e instanceof Error ? e.message : String(e)}`] })),
    ),
  );

  // ── Stage 3: rank by STOP fraction ────────────────────────────────────────
  const ranked = ideas
    .map((idea, i) => ({ idea, ...sims[i] }))
    .sort((a, b) => b.stop - a.stop);

  const lines: string[] = [
    `IDEAS · generate → simulate → rank   (${new Date().toISOString()})`,
    `Generate: ${GEN_MODEL}   SIM: SIM-1 Flash per-idea`,
    `Prompt: "${prompt}"`,
    "═".repeat(70),
    "",
  ];
  ranked.forEach((r, rank) => {
    const band = r.stop < 0 ? "SIM-ERR" : r.stop >= 7 ? "Strong" : r.stop >= 4 ? "Mixed" : "Weak";
    lines.push(`#${rank + 1}  —  SIM ${r.stop}/${r.total} STOP  (${band})`);
    lines.push(r.idea);
    if (r.scrollQuotes.length) {
      lines.push("");
      lines.push(`  ↳ why some scrolled: ${r.scrollQuotes.join(" · ")}`);
    }
    lines.push("");
    lines.push("─".repeat(70));
    lines.push("");
  });

  const outFile = resolve(__dirname, "..", "ideas-sim-rank.txt");
  writeFileSync(outFile, lines.join("\n"), "utf-8");

  console.log("══ RANKING (best → worst by synthetic-audience STOP) ══");
  ranked.forEach((r, rank) =>
    console.log(`  #${rank + 1}  SIM ${r.stop}/${r.total} STOP   ${r.idea.split("\n")[0].slice(0, 70)}…`),
  );
  console.log(`\n Full output → ${outFile}\n`);
}

main().catch((err) => {
  console.error("\n[ideas-sim-rank] FATAL:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
