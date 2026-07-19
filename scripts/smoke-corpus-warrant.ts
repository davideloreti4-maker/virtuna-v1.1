/**
 * smoke-corpus-warrant.ts — LIVE proof of the two things unit tests CANNOT prove about the
 * `search_corpus` tool boundary, because both live below an injected `retrieve`:
 *
 *   (A) FACET FILTERS actually reach the RPC and constrain the rows. The tool-loop spike asked for
 *       greenscreen examples, the corpus holds 81 greenscreen settings + 77 greenscreen edits, and the
 *       model reported "no greenscreen tag" — because the interface could not express the question.
 *       This asserts every returned row really carries the facet that was asked for.
 *
 *   (B) `grounded` is COMPUTED, not inferred. Cosine always returns its nearest rows, so an absurd
 *       subject still comes back with results. This asserts the absurd ask reports grounded:false
 *       while a subject the corpus genuinely covers reports grounded:true.
 *
 * No model call — this exercises embed → RPC → warrant only, so it is cheap and deterministic.
 *
 * Run (FOREGROUND, sandbox OFF): npx tsx scripts/smoke-corpus-warrant.ts
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
const { executeCorpusSearch } = require("@/lib/grounding/corpus-tool");
const { retrieveCachedExamples } = require("@/lib/grounding/retrieve");

interface Row {
  creator: string | null;
  visual_setting: string | null;
  editing_style: string | null;
  format: string | null;
  on_subject: boolean | null;
  spoken_hook: string;
}
interface Payload {
  count: number;
  grounded: boolean;
  warrant: string;
  note: string;
  filters?: Record<string, string>;
  results: Row[];
}

let failures = 0;
function check(label: string, pass: boolean, detail: string): void {
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label} — ${detail}`);
  if (!pass) failures++;
}

async function run(args: Record<string, unknown>): Promise<Payload> {
  const res = await executeCorpusSearch(args, "tiktok", 1, retrieveCachedExamples);
  return JSON.parse(res.content) as Payload;
}

async function main(): Promise<void> {
  console.log("SMOKE: corpus warrant + facet filters (live embed + live RPC)\n");

  // ── (A) facet filters reach the RPC ────────────────────────────────────────
  console.log("(A) FACET FILTERS");

  const green = await run({ query: "explaining a concept to camera", visual_setting: "greenscreen", limit: 8 });
  console.log(`    visual_setting=greenscreen → ${green.count} rows, filters=${JSON.stringify(green.filters)}`);
  green.results.forEach((r) => console.log(`      @${r.creator} · setting=${r.visual_setting} · edit=${r.editing_style}`));
  check(
    "every row honours visual_setting=greenscreen",
    green.count > 0 && green.results.every((r) => r.visual_setting === "greenscreen"),
    `${green.results.filter((r) => r.visual_setting === "greenscreen").length}/${green.count} rows are greenscreen`,
  );

  const edit = await run({ query: "explaining a concept to camera", editing_style: "visual-greenscreen", limit: 5 });
  check(
    "every row honours editing_style=visual-greenscreen",
    edit.count > 0 && edit.results.every((r) => r.editing_style === "visual-greenscreen"),
    `${edit.results.filter((r) => r.editing_style === "visual-greenscreen").length}/${edit.count} rows match`,
  );

  const fmt = await run({ query: "how to grow on tiktok", format: "tutorial", limit: 5 });
  check(
    "every row honours format=tutorial",
    fmt.count > 0 && fmt.results.every((r) => r.format === "tutorial"),
    `${fmt.results.filter((r) => r.format === "tutorial").length}/${fmt.count} rows match`,
  );

  // ── (B) grounded is computed ───────────────────────────────────────────────
  console.log("\n(B) COMPUTED GROUNDING");

  const absurd = await run({ query: "quantum tax havens for hamsters in medieval Latvia", limit: 5 });
  console.log(`    absurd ask → count=${absurd.count} grounded=${absurd.grounded} warrant=${absurd.warrant}`);
  check(
    "absurd subject returns rows but is NOT grounded",
    absurd.count > 0 && absurd.grounded === false && absurd.warrant === "none",
    `cosine returned ${absurd.count} rows; warrant=${absurd.warrant}`,
  );

  const real = await run({ query: "growing an audience as a small creator", limit: 5 });
  console.log(`    covered ask → count=${real.count} grounded=${real.grounded} warrant=${real.warrant}`);
  console.log(`      on_subject flags: ${JSON.stringify(real.results.map((r) => r.on_subject))}`);
  check(
    "a subject the corpus covers IS grounded",
    real.grounded === true && real.warrant === "topical",
    `warrant=${real.warrant}, ${real.results.filter((r) => r.on_subject).length}/${real.count} rows on-subject`,
  );

  const structural = await run({ query: "quantum tax havens for hamsters", axis: "structural", limit: 3 });
  check(
    "structural warrants SHAPE even off-subject, and says so",
    structural.grounded === true &&
      structural.warrant === "structural" &&
      structural.note.includes("never as evidence about this specific topic"),
    `warrant=${structural.warrant}`,
  );

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("smoke failed:", err);
  process.exit(1);
});
