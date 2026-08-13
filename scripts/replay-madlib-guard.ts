/**
 * replay-madlib-guard.ts — the natural experiment behind the 2026-08-13 proof-rate finding.
 *
 * Runs the CURRENT `templateInstantiated` guard over cards from BEFORE 2026-08-10 that DID carry
 * proof — i.e. citations the pre-Stage-A pipeline judged honest. Same data, old verdict vs new guard.
 *
 * Result 2026-08-13: 58 pairs -> 11 pass (19%), 47 stripped (81%). Each strip renders
 * "Original - not drawn from a retrieved video."
 *
 * 🔑 The 81% is NOT a bug in the guard. prompt.ts tells the model to INSTANTIATE the madlib and to
 * cite 0 if it did not, so a stripped citation was a FALSE claim. Re-run this before proposing any
 * change to the guard — reverting it restores false provenance to the product.
 * Full reasoning: docs/HANDOFF-2026-08-13-audit-rewalk.md §0.
 *
 *   node scripts/fetch-madlib-pairs.mjs && node node_modules/.bin/tsx scripts/replay-madlib-guard.ts
 *
 * Imports the REAL exported guard. A re-implementation would only ever test itself.
 */
import { templateInstantiated } from "../src/lib/tools/runners/output-guards";
import { readFileSync } from "node:fs";

const pairs: Array<{ hook_line: string; template: string }> = JSON.parse(
  readFileSync(".scratch/pre-regression-pairs.json", "utf8"),
);

let pass = 0;
const stripped: Array<{ hook: string; tpl: string }> = [];
for (const p of pairs) {
  if (templateInstantiated(p.template, p.hook_line)) pass++;
  else stripped.push({ hook: p.hook_line.slice(0, 60), tpl: p.template.slice(0, 55) });
}

console.log(`pairs            ${pairs.length}`);
console.log(`guard PASSES     ${pass}  (${((100 * pass) / pairs.length).toFixed(1)}%)`);
console.log(`guard STRIPS     ${stripped.length}  (${((100 * stripped.length) / pairs.length).toFixed(1)}%)`);
console.log(`\nEach strip renders "Original — not drawn from a retrieved video." Examples:`);
for (const s of stripped.slice(0, 6)) console.log(`  ✗ "${s.hook}…"\n      vs [${s.tpl}…]`);
