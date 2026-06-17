/**
 * kc-gate.ts — D-12 Throwaway Blind-Gate Generator (Plan 02-04 Task 1).
 *
 * PURPOSE: Produce 3×N blind, shuffled, unlabeled Ideas generations for owner ranking.
 * This is the D-12 thin owner-blind gate — NOT an eval harness, NOT a test suite.
 * Run once at the Ideas-pilot midpoint, then discard.
 *
 * Three arms per prompt (D-13):
 *   A — new-KC   : Qwen call with KC_IDEAS_SYSTEM_PROMPT (system) + assembleBundle (user)
 *   B — current-KC: Qwen call with APOLLO_SYSTEM_PROMPT (system) + ideas task framing (user)
 *   C — raw-LLM  : Qwen call with NO KC system prompt, profile-only user message
 *
 * Outputs are SHUFFLED/UNLABELED per prompt — the Goodhart guard (D-13).
 * The arm-to-label key is written separately so the owner decodes AFTER ranking.
 *
 * OPTIONAL: Each generation is run through SIM-1 Flash for a band/fraction sanity number.
 * Clearly labeled "sanity only — not the gate." Owner judgment is the gate.
 *
 * Run: npx tsx scripts/kc-gate.ts
 *      npx tsx scripts/kc-gate.ts --prompts "your ask 1|your ask 2|your ask 3"
 *      npx tsx scripts/kc-gate.ts --no-flash    (skip Flash sanity delta)
 *      npx tsx scripts/kc-gate.ts --prompts "ask 1|ask 2" --no-flash
 *
 * Requires: DASHSCOPE_API_KEY in .env.local
 *
 * THROWAWAY: accept criteria from 02-04-PLAN.md require this file contains:
 *   - "KC_IDEAS_SYSTEM_PROMPT" reference (new-KC arm)
 *   - "APOLLO_SYSTEM_PROMPT"   reference (current-KC baseline arm)
 *   - assembleBundle / assembler reference (new-KC user message)
 *   - shuffle / randomize logic (Goodhart guard)
 *   - No harness machinery (no eval pipelines, persisted scored results, or test suites)
 *   - Qwen-only (no non-Qwen model clients)
 *
 * D-12 SCOPE BOUNDARY: do NOT persist scored results, do NOT compute aggregate
 * metrics, do NOT build a test suite (Pitfall 5). Stop at the 3×N blind outputs.
 */

import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync, writeFileSync } from "fs";
import { register } from "tsconfig-paths";

// ─── Bootstrap (mirrors build-corpus.ts:1-35) ────────────────────────────────
config({ path: resolve(__dirname, "../.env.local") });

const tsconfig = JSON.parse(
  readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"),
);
register({
  baseUrl: resolve(__dirname, ".."),
  paths: tsconfig.compilerOptions.paths,
});

// ─── Imports (post-bootstrap, after tsconfig-paths registered) ───────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { KC_IDEAS_SYSTEM_PROMPT } = require("../src/lib/kc/compiled");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { APOLLO_SYSTEM_PROMPT } = require("../src/lib/engine/apollo-core");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { assembleBundle } = require("../src/lib/kc/assembler");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getQwenClient, QWEN_SEED, QWEN_REASONING_MODEL } = require("../src/lib/engine/qwen/client");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { runFlashTextMode } = require("../src/lib/engine/flash/run-flash-text-mode");

// ─── Types ────────────────────────────────────────────────────────────────────

type ArmLabel = "new-KC" | "current-KC" | "raw-LLM";

interface ArmOutput {
  label: ArmLabel;  // hidden from the blind output until decode
  content: string;
  flashSanity?: string;  // "Band / fraction — sanity only, not the gate"
}

interface ShuffledPromptResult {
  promptIndex: number;
  prompt: string;
  /** Blind outputs — arm order randomized (Goodhart guard, D-13). */
  blindOutputs: Array<{
    blindIndex: number;   // 1, 2, 3 — what the owner sees
    content: string;
    flashSanity?: string;
  }>;
  /** Key mapping blind index → arm label. Revealed AFTER the owner ranks. */
  keyFile: Array<{ blindIndex: number; label: ArmLabel }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GATE_MODEL = process.env.GATE_MODEL ?? QWEN_REASONING_MODEL;

const PER_CALL_TIMEOUT_MS = 300_000; // 5 min — qwen3.7-plus reasoning + ~7.4k-token KC system prompt can be slow

/**
 * Default Ideas asks. Realistic representative prompts covering different
 * archetypes, niche types, and creator goals. Override via --prompts CLI arg.
 */
const DEFAULT_PROMPTS: string[] = [
  "Give me 5 ideas for a personal finance creator on TikTok who wants to go viral this week. I help 25-35 year-olds invest their first $1000.",
  "I make cooking content for busy moms on Instagram. I've been stuck at 50k followers for months. Generate 5 hook-worthy ideas that might actually break through.",
  "I'm a fitness coach on TikTok targeting men over 40. Generate ideas that feel specific to my audience, not generic gym content.",
  "Ideas for a mental health creator on YouTube Shorts. My audience is Gen-Z who are anxious about careers. I want ideas that feel real, not advice-column-y.",
  "I'm a travel creator on TikTok. I travel solo and cheaply ($30/day in SE Asia). Give me 5 ideas that lean into what makes my POV unique.",
  "Generate ideas for a B2B SaaS founder who wants to build a personal brand on LinkedIn, crossposted to TikTok. My company does AI tools for recruiting.",
  "I do productivity content. My niche is ADHD adults in professional roles. Give me ideas that will resonate specifically vs the generic 'be more productive' take.",
];

// ─── CLI arg parsing ──────────────────────────────────────────────────────────

function parseArgs(): { prompts: string[]; skipFlash: boolean } {
  const argv = process.argv.slice(2);
  const noFlash = argv.includes("--no-flash");

  const promptsIdx = argv.indexOf("--prompts");
  let prompts = DEFAULT_PROMPTS;
  if (promptsIdx !== -1 && argv[promptsIdx + 1]) {
    prompts = argv[promptsIdx + 1].split("|").map((p) => p.trim()).filter(Boolean);
  }

  return { prompts, skipFlash: noFlash };
}

// ─── Qwen call helper ─────────────────────────────────────────────────────────

async function callQwen(
  systemPrompt: string | null,
  userMessage: string,
): Promise<string> {
  const ai = getQwenClient();

  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: userMessage });

  const callParams = {
    model: GATE_MODEL,
    messages,
  };

  // Determinism: temp 0 + seed (mirrors run-flash-text-mode.ts pattern)
  // @ts-expect-error — temperature:0 + seed = reproducible results
  callParams.temperature = 0;
  // @ts-expect-error — seed pins residual nondeterminism
  callParams.seed = QWEN_SEED;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);

  let response;
  try {
    response = await (ai as Parameters<typeof getQwenClient>[0] extends never ? never : ReturnType<typeof getQwenClient>).chat.completions.create(
      callParams as never,
      { signal: controller.signal },
    );
  } catch (err) {
    clearTimeout(timer);
    const error = err instanceof Error ? err : new Error(String(err));
    const isTimeout = error.name === "AbortError";
    throw new Error(
      isTimeout
        ? `kc-gate: Qwen call aborted (timeout ${PER_CALL_TIMEOUT_MS}ms)`
        : `kc-gate: Qwen call failed — ${error.message}`,
    );
  }
  clearTimeout(timer);

  return response.choices[0]?.message?.content ?? "(empty response)";
}

// ─── Flash sanity delta (optional, D-12) ─────────────────────────────────────

async function getFlashSanity(content: string): Promise<string> {
  try {
    const { result } = await runFlashTextMode(content, "idea");
    // FlashResult.personas = 10 × { archetype, verdict: "stop"|"scroll", quote }.
    // "stop" = persona stopped scrolling = the positive pull signal (D-03 band math).
    const personas = result.personas;
    const stopCount = personas.filter((p) => p.verdict === "stop").length;
    const total = personas.length;
    const fraction = total > 0 ? `${stopCount}/${total}` : "N/A";
    return `Flash SIM (sanity only — not the gate): ${fraction} personas → STOP (stopped scrolling)`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Flash sanity: skipped — ${msg}`;
  }
}

// ─── Shuffle helper (Goodhart guard, D-13) ────────────────────────────────────

/**
 * Fisher-Yates shuffle — randomizes arm order so the owner cannot infer arm identity
 * from output position. The shuffle key is recorded separately for post-rank decode.
 */
function shuffleArms(arms: ArmOutput[]): ArmOutput[] {
  const arr = [...arms];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Raw-LLM user message (no KC, profile only) ──────────────────────────────

function buildRawLLMUserMessage(ask: string): string {
  return `You are a helpful assistant for content creators.\n\n<<<USER_CONTENT>>>\n${ask}\n<<<END_USER_CONTENT>>>\n\nGenerate ideas for this content creator.`;
}

// ─── Current-KC user message (Apollo pointing at the Ideas task) ──────────────

function buildCurrentKCUserMessage(ask: string): string {
  return `Task: Generate content ideas for the following creator request.\n\n<<<USER_CONTENT>>>\n${ask}\n<<<END_USER_CONTENT>>>\n\nApply your content analysis expertise to generate specific, mechanism-backed content ideas for this creator.`;
}

// ─── Three-arm generation for one prompt ─────────────────────────────────────

async function generateThreeArms(
  prompt: string,
  skipFlash: boolean,
): Promise<ArmOutput[]> {
  const log = (msg: string) => console.log(`  [kc-gate] ${msg}`);

  // ── ARM A: new-KC ──────────────────────────────────────────────────────────
  log("generating arm A (new-KC)...");
  const newKCUserMessage = assembleBundle(
    { ask: prompt, platform: "tiktok", mode: "idea" },
    null, // null = cold-start / platform baseline (no profile in gate context)
  );
  const newKCContent = await callQwen(KC_IDEAS_SYSTEM_PROMPT, newKCUserMessage);

  // ── ARM B: current-KC ──────────────────────────────────────────────────────
  log("generating arm B (current-KC)...");
  const currentKCContent = await callQwen(
    APOLLO_SYSTEM_PROMPT,
    buildCurrentKCUserMessage(prompt),
  );

  // ── ARM C: raw-LLM ────────────────────────────────────────────────────────
  log("generating arm C (raw-LLM, no KC)...");
  const rawLLMContent = await callQwen(null, buildRawLLMUserMessage(prompt));

  // ── Optional Flash sanity delta ───────────────────────────────────────────
  const arms: ArmOutput[] = [
    { label: "new-KC",     content: newKCContent },
    { label: "current-KC", content: currentKCContent },
    { label: "raw-LLM",   content: rawLLMContent },
  ];

  if (!skipFlash) {
    log("running Flash sanity delta on all 3 arms (sanity only — not the gate)...");
    for (const arm of arms) {
      arm.flashSanity = await getFlashSanity(arm.content);
    }
  }

  return arms;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { prompts, skipFlash } = parseArgs();

  console.log("\n══════════════════════════════════════════════════════════════");
  console.log(" KC BLIND GATE — D-12 / D-13 (02-04-PLAN.md)");
  console.log("══════════════════════════════════════════════════════════════");
  console.log(` Prompts: ${prompts.length}`);
  console.log(` Model:   ${GATE_MODEL}`);
  console.log(` Flash sanity: ${skipFlash ? "SKIPPED (--no-flash)" : "enabled"}`);
  console.log("──────────────────────────────────────────────────────────────\n");

  const allResults: ShuffledPromptResult[] = [];
  const allKeyEntries: string[] = [];

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    console.log(`\n[Prompt ${i + 1}/${prompts.length}]: "${prompt.substring(0, 80)}${prompt.length > 80 ? "..." : ""}"`);

    let arms: ArmOutput[];
    try {
      arms = await generateThreeArms(prompt, skipFlash);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ERROR generating arms for prompt ${i + 1}: ${msg}`);
      console.error("  Skipping this prompt.\n");
      continue;
    }

    // Shuffle — Goodhart guard (D-13): owner cannot infer arm from position
    const shuffled = shuffleArms(arms);

    const result: ShuffledPromptResult = {
      promptIndex: i + 1,
      prompt,
      blindOutputs: shuffled.map((arm, idx) => ({
        blindIndex: idx + 1,
        content: arm.content,
        flashSanity: arm.flashSanity,
      })),
      keyFile: shuffled.map((arm, idx) => ({
        blindIndex: idx + 1,
        label: arm.label,
      })),
    };

    allResults.push(result);

    // Record key entry for the decode file
    const keyEntry = [
      `Prompt ${i + 1}: "${prompt.substring(0, 60)}${prompt.length > 60 ? "..." : ""}"`,
      ...result.keyFile.map((k) => `  Output ${k.blindIndex} → ${k.label}`),
    ].join("\n");
    allKeyEntries.push(keyEntry);
  }

  // ─── Build blind output text (what the owner reads) ──────────────────────
  const blindOutputLines: string[] = [
    "KC BLIND GATE — BLIND OUTPUT",
    `Generated: ${new Date().toISOString()}`,
    "==============================",
    "",
    "INSTRUCTIONS:",
    "  Read each prompt's 3 outputs. For each prompt, rank them best → worst.",
    "  Judge on: specificity, mechanism-backed, shoot-ready, grounded (not generic slop).",
    "  Do NOT decode the arm labels until you have ranked ALL prompts.",
    "  Decode file: kc-gate-KEY.txt (read AFTER ranking)",
    "",
    "GATE PASS CONDITION (D-13):",
    '  New-KC must be CLEARLY better than BOTH: (a) raw-LLM-no-KC AND (b) current-KC.',
    "  Optional Flash sanity numbers are labeled clearly — they are NOT the gate.",
    "",
    "══════════════════════════════════════════════════════════════",
    "",
  ];

  for (const result of allResults) {
    blindOutputLines.push(`PROMPT ${result.promptIndex}:`);
    blindOutputLines.push(`"${result.prompt}"`);
    blindOutputLines.push("");

    for (const out of result.blindOutputs) {
      blindOutputLines.push(`─── OUTPUT ${out.blindIndex} ───────────────────────────────────────────────`);
      blindOutputLines.push(out.content);
      if (out.flashSanity) {
        blindOutputLines.push("");
        blindOutputLines.push(`  [${out.flashSanity}]`);
      }
      blindOutputLines.push("");
    }

    blindOutputLines.push("══════════════════════════════════════════════════════════════");
    blindOutputLines.push("");
  }

  blindOutputLines.push("END OF BLIND OUTPUT");
  blindOutputLines.push("Now rank each prompt's outputs (best → worst) BEFORE opening kc-gate-KEY.txt");

  // ─── Build key file (revealed after ranking) ─────────────────────────────
  const keyFileLines: string[] = [
    "KC BLIND GATE — ARM-TO-LABEL DECODE KEY",
    "DO NOT READ UNTIL YOU HAVE RANKED ALL OUTPUTS",
    `Generated: ${new Date().toISOString()}`,
    "══════════════════════════════════════════════════════════════",
    "",
    ...allKeyEntries,
    "",
    "══════════════════════════════════════════════════════════════",
    "GATE PASS CONDITION (D-13):",
    '  new-KC CLEARLY beats BOTH current-KC AND raw-LLM in your ranking.',
    "  'Clearly' = unmistakable, not marginal.",
    "",
    "If new-KC is NOT clearly better:",
    "  Note which craft dimensions failed (specificity? mechanisms? actionability?).",
    "  Loop back to Plan 03 authoring before replication to other modes.",
  ];

  // ─── Write to disk ─────────────────────────────────────────────────────────
  const outputDir = resolve(__dirname, "..");
  const blindFile = resolve(outputDir, "kc-gate-BLIND.txt");
  const keyFile   = resolve(outputDir, "kc-gate-KEY.txt");

  writeFileSync(blindFile, blindOutputLines.join("\n"), "utf-8");
  writeFileSync(keyFile,   keyFileLines.join("\n"),   "utf-8");

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log(" GATE OUTPUT COMPLETE");
  console.log("══════════════════════════════════════════════════════════════");
  console.log(` Prompts processed: ${allResults.length}/${prompts.length}`);
  console.log(` Blind output:      ${blindFile}`);
  console.log(` Decode key:        ${keyFile} (read AFTER ranking)`);
  console.log("");
  console.log(" NEXT STEPS:");
  console.log("  1. Open kc-gate-BLIND.txt");
  console.log("  2. Rank each prompt's 3 outputs (best → worst) on taste");
  console.log("  3. Open kc-gate-KEY.txt to decode");
  console.log("  4. Check gate pass: new-KC clearly better than BOTH baselines?");
  console.log("  5. Report verdict in Plan 02-04 (Task 2 checkpoint)");
  console.log("══════════════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("\n[kc-gate] FATAL:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
