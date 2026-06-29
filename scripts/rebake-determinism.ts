/**
 * Phase 3 (General Population + Honesty Layer) Plan 01 — D-01 determinism harness (PAID, LIVE).
 *
 * ⚠ V1 STATUS (2026-06-27): the D-01 live gate found `qwen-3.7-plus` synth is non-deterministic
 * even synth-isolated (structural drift in persona weights/shares — MoE batch-routing, NOT a config
 * bug). v1 therefore adopted SPIKE-VERDICT §Fallback Option 2 (bake-once-freeze): determinism is
 * contracted on the FROZEN persisted signature + the green zero-network replay gate, NOT on
 * cross-bake reproducibility. So `signatureEqual:false` from this harness is EXPECTED in v1 and is
 * NOT a blocker. This script is retained as the **v2 / CAL-01 re-bake-drift tool** (where re-bake is
 * a feature). See 03-01-SUMMARY.md (Task 3 evidence) + SPIKE-VERDICT.md §Fallback.
 *
 * Run:  node --import tsx scripts/rebake-determinism.ts
 *       (or the repo's tsx runner, e.g. `pnpm tsx scripts/rebake-determinism.ts`)
 *
 * Restored + trimmed from the torn-down spike probe (`scripts/spike/trustworthy-sim-probe.ts`,
 * removed in 362ef8df). This is the Wave-0 GATE proof that `signature-determinism.test.ts`
 * structurally CANNOT provide: that replay test is zero-network and deterministic regardless of
 * the LLM. Only a REAL paid double-bake confirms the D-01 fix (thinking-mode dropped on the synth
 * call) actually removed the Pitfall-3 residual jitter.
 *
 * What it does (≤ ~8 Qwen calls, < $0.50 — spike actuals):
 *   1. Loads the FROZEN, secret-scrubbed socials bundle (khaby.lame) — Apify-free, no re-scrape.
 *   2. Bakes the AudienceSignature TWICE on the IDENTICAL frozen input via the REAL
 *      `defaultSynthesize` (temp:0 + seed:QWEN_SEED + enable_thinking:false, per D-01).
 *   3. Asserts `signatureEqual(a, b) === true`. On mismatch it prints BOTH normalized signatures
 *      (stable-key-ordered) so the diff is eyeballable.
 *   4. A/B QUALITY (A2 guard): prints bake-A's `summary` + each reactor's `reaction_frame` so the
 *      operator can judge synth quality against the socials control (no quality collapse).
 *
 * Security (T-03-01): reads `DASHSCOPE_API_KEY` from `process.env` ONLY — never hardcoded, never
 * logged. The frozen fixture is pre-scrubbed of all token= query params (committed clean).
 * Cost (T-03-02): bounded to EXACTLY 2 bakes per run; human-approved gate.
 *
 * Standalone — deliberately NOT in the vitest suite (it is paid + live).
 */

import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";

// ── Bootstrap (mirror the spike probe / fold-validate-r1.ts; scripts/ is one level deep → ..) ──
config({ path: resolve(__dirname, "../.env.local") });
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

// ── ENV GUARD (FIRST cost-bearing decision — fail loud + zero network without the key, T-03-01) ──
if (!process.env.DASHSCOPE_API_KEY) {
  console.error(
    "\n  FATAL: DASHSCOPE_API_KEY is missing — the re-bake harness makes LIVE Qwen calls.\n" +
      "  Set it in .env.local (the substrate already reads it). Refusing to run: zero network, zero cost.\n",
  );
  process.exit(1);
}

import type { EnrichInput } from "@/lib/audience/enrich-signature";
import type { AudienceSignature } from "@/lib/audience/audience-types";

// ── Substrate (require AFTER register so transitive `@/` imports resolve — fold-validate-r1 pattern) ──
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { enrichSignature } = require("../src/lib/audience/enrich-signature");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { signatureEqual, normalizeSignature, stableStringify } = require("../src/lib/audience/signature-equality");

const FIXTURE_PATH = resolve(__dirname, "fixtures/socials-bundle.fixture.json");

async function main(): Promise<void> {
  console.log("── D-01 determinism GATE — live double-bake (PAID) ─────────────────");

  // (1) Load the FROZEN secret-scrubbed control SIM — no Apify, no network scrape ──────────────
  const input = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8")) as EnrichInput;
  console.log(`[fixture] @${input.handle} — ${input.videos.length} frozen videos (Apify-free)\n`);

  // (2) Bake TWICE from the SAME frozen input via the REAL defaultSynthesize (temp:0, thinking OFF) ──
  console.log("[bake A] running real Qwen synthesis …");
  const a = (await enrichSignature(input)) as AudienceSignature;
  console.log(`[bake A] done — videos_watched=${a.provenance.videos_watched}`);
  console.log("[bake B] running real Qwen synthesis …");
  const b = (await enrichSignature(input)) as AudienceSignature;
  console.log(`[bake B] done — videos_watched=${b.provenance.videos_watched}\n`);

  // (3) THE GATE — signatureEqual after normalization (one-field scraped_at strip) ─────────────
  const equal = signatureEqual(a, b) as boolean;
  console.log("══════════════ D-01 GATE EVIDENCE ══════════════");
  console.log(`signatureEqual: ${equal}`);
  if (!equal) {
    console.log("\n  MISMATCH — normalized signatures below (D-01 NOT closed; STOP + escalate to");
    console.log("  SPIKE-VERDICT §Fallback option 3 = bounded prose tolerance):\n");
    console.log("── normalized bake A ──");
    console.log(stableStringify(normalizeSignature(a)));
    console.log("\n── normalized bake B ──");
    console.log(stableStringify(normalizeSignature(b)));
  }

  // (4) A/B QUALITY (A2 guard) — eyeball summary + reaction_frames vs the socials control ──────
  console.log("\n# A/B QUALITY (bake A — judge vs the socials control, no quality collapse)");
  console.log(`  summary: ${a.summary}`);
  console.log("  reactor reaction_frames:");
  for (const p of a.audience.personas) {
    console.log(`    - [${p.archetype}] (${(p.share * 100).toFixed(0)}%) ${p.reaction_frame}`);
  }
  console.log("════════════════════════════════════════════════\n");

  if (!equal) {
    console.error("D-01 GATE FAILED: signatureEqual:false — do NOT proceed to Wave-1.");
    process.exit(2);
  }
  console.log("D-01 GATE PASSED: signatureEqual:true — paste this evidence into 03-01-SUMMARY.md.");
}

main().catch((err) => {
  console.error("\n  HARNESS FAILED:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
