/**
 * eval-lane-synthesis.ts — read REAL synthesizeLanes output on varied answers.
 *
 * WHY: the Phase-5 plan shipped the producer with unit tests but NO eval (plan §"Known
 * risk"): "Read real output against 5–10 varied answers in a sandbox before this leaves
 * the flag." This is that read. It calls the REAL producer (real Qwen, same prompt, same
 * temp-0 + seed) on answers spanning the input space the /welcome describe-door allows
 * (route caps at 500 chars), prints every lane verbatim, and runs the mechanical checks
 * the prompt promises (2–3 lanes, name shape, who ≤6 words lowercase, niche ≤12 words,
 * distinctness, no invented biography — that last one is judged by the reader).
 *
 * Run: npx tsx scripts/eval-lane-synthesis.ts
 * Needs .env.local: DASHSCOPE_API_KEY.
 * Cost: 13 qwen3.7-flash calls (~33k-char system prompt each) — fractions of a cent.
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
const { synthesizeLanes } = require("@/lib/engine/lanes/synthesize-lanes");

type Lane = { name: string; who: string; niche: string };

/** Each answer ≤500 chars (the route's BodySchema cap). Labels say what axis it probes. */
const DEFAULT_ANSWERS: { label: string; answer: string }[] = [
  {
    label: "clear-hobby",
    answer:
      "sourdough. i bake every weekend, i've killed four starters and kept one alive for three years. i have opinions about hydration percentages nobody asked for",
  },
  {
    label: "profession",
    answer:
      "I'm an ER nurse. Night shifts, the weird stuff people come in with, how triage actually works, what burnout does to you",
  },
  { label: "vague", answer: "idk movies i guess" },
  { label: "one-word", answer: "makeup" },
  { label: "multi-topic", answer: "cars, crypto and my dog tbh" },
  {
    label: "personal-arc",
    answer:
      "my divorce at 40 and rebuilding my life from zero. dating again, handling money alone, learning to actually be by myself",
  },
  {
    label: "brand",
    answer:
      "our family pizza restaurant in Naples — third generation, wood-fired oven, the difference between what tourists order and what locals order",
  },
  {
    label: "technical",
    answer:
      "React performance optimization. rerenders, memoization, why your app is slow and why it's usually not the framework's fault",
  },
  {
    label: "sensitive-claims",
    answer:
      "losing weight. i lost 60 pounds in a year and kept it off, no medication, and i think most fitness advice online is a scam",
  },
  {
    label: "non-english",
    answer:
      "la pesca in mare. ci vado ogni domenica da vent'anni, conosco ogni scoglio della costa e le esche giuste per ogni stagione",
  },
  {
    label: "rambling-near-cap",
    answer:
      "ok so honestly? probably skincare but not in the influencer way, more like the chemistry of it. i'm not a dermatologist or anything, i just got obsessed after my skin fell apart in my 20s and i started reading actual papers about it. i can tell you why most 10-step routines are nonsense, what an occlusive actually does, why your moisturizer pills under sunscreen, and which ingredients are just marketing. my friends send me their shelfies and i tell them what to throw away. it's a whole thing",
  },
  { label: "garbage", answer: "asdf lol nothing really" },
];

// Optional argv[1]: path to a JSON file of {label, answer}[] to probe instead of the defaults.
const ANSWERS: { label: string; answer: string }[] = process.argv[2]
  ? JSON.parse(readFileSync(resolve(process.argv[2]), "utf-8"))
  : DEFAULT_ANSWERS;

const ARTICLE_RE = /^(the|a|an)\s/i;
const wordCount = (s: string) => s.trim().split(/\s+/).length;

function mechanicalChecks(lanes: Lane[]): string[] {
  const problems: string[] = [];
  if (lanes.length < 2 || lanes.length > 3) problems.push(`count=${lanes.length} outside 2-3`);
  const names = new Set(lanes.map((l) => l.name.toLowerCase()));
  if (names.size !== lanes.length) problems.push("duplicate lane names");
  for (const l of lanes) {
    if (!ARTICLE_RE.test(l.name)) problems.push(`name "${l.name}" has no leading article`);
    const nameWords = wordCount(l.name);
    if (nameWords < 2 || nameWords > 5) problems.push(`name "${l.name}" is ${nameWords} words (want 2-4 + article)`);
    if (wordCount(l.who) > 6) problems.push(`who "${l.who}" > 6 words`);
    if (l.who !== l.who.toLowerCase()) problems.push(`who "${l.who}" not lowercase`);
    if (wordCount(l.niche) > 12) problems.push(`niche "${l.niche}" > 12 words`);
  }
  return problems;
}

async function main() {
  const results: { label: string; lanes: Lane[] | null; ms: number }[] = [];

  for (const { label, answer } of ANSWERS) {
    const t0 = Date.now();
    const lanes = (await synthesizeLanes(answer)) as Lane[] | null;
    const ms = Date.now() - t0;
    results.push({ label, lanes, ms });

    console.log(`\n${"=".repeat(72)}`);
    console.log(`## ${label}  (${ms}ms)`);
    console.log(`ANSWER: ${answer}`);
    if (!lanes) {
      console.log("→ null (graceful failure)");
      continue;
    }
    for (const l of lanes) {
      console.log(`  • ${l.name}  —  ${l.who}`);
      console.log(`      niche: ${l.niche}`);
    }
    const problems = mechanicalChecks(lanes);
    console.log(problems.length ? `⚠ CHECKS: ${problems.join(" · ")}` : "✓ mechanical checks pass");
  }

  // Determinism probe: temp 0 + fixed seed promise the same output run-to-run.
  console.log(`\n${"=".repeat(72)}`);
  console.log("## determinism (clear-hobby, second run)");
  const again = (await synthesizeLanes(ANSWERS[0].answer)) as Lane[] | null;
  const first = results[0].lanes;
  const same = JSON.stringify(again) === JSON.stringify(first);
  console.log(same ? "✓ byte-identical to first run" : `✗ DRIFTED:\n${JSON.stringify(again, null, 2)}`);

  const nulls = results.filter((r) => !r.lanes).map((r) => r.label);
  console.log(`\n${"=".repeat(72)}`);
  console.log(`SUMMARY: ${results.length} answers · ${nulls.length} null (${nulls.join(", ") || "none"})`);
  console.log(`latency: ${results.map((r) => r.ms).join(", ")}ms`);
}

main().catch((err) => {
  console.error("eval failed:", err);
  process.exit(1);
});
