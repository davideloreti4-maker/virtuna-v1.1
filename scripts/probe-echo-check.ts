/**
 * LIVE PROBE — Task 7 checks 3 and 4: duration plausibility and the D-01 echo check.
 *
 * The full remix path without Apify, auth or a dev server: sign an EXISTING storage object, then
 * run the runner's own steps 2-4 directly — analyzeVideoWithOmni → omniOutputToStructuralInput →
 * runDecode → buildBlueprint → generateAdaptConcepts.
 *
 * THE GATE (owner ruling 2026-08-12): a remix copies the source ~1:1 and swaps it for the
 * creator's niche — "otherwise the reason the video went viral doesn't retain". So the only
 * defect is the source's SUBJECT surviving: its people, places and brands. Shared cadence and
 * shared sentence shape are the asset being copied and are reported as `fidelity`, never failed.
 *
 * This REPLACES the plan's original gate ("no beat shares more than one content token"), which
 * contradicts D2 and, measured live, failed the model for reproducing the joke's own skeleton.
 *
 * The niche is deliberately UNRELATED to the source so a surviving subject is visible.
 *
 * Usage:
 *   npx tsx scripts/probe-echo-check.ts --path <videos-bucket-key> [--niche fitness]
 */
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

/* eslint-disable @typescript-eslint/no-require-imports */
const { createServiceClient } = require("../src/lib/supabase/service");
const { analyzeVideoWithOmni } = require("../src/lib/engine/qwen/omni-analysis");
const { omniOutputToStructuralInput, runDecode } = require("../src/lib/engine/remix/decode");
const { buildBlueprint } = require("../src/lib/engine/remix/blueprint");
const { decodeResultToAdaptInput } = require("../src/lib/engine/remix/decode-types");
const { generateAdaptConcepts } = require("../src/lib/engine/remix/adapt");
const { sharedContentTokens, survivingSubjectTokens } = require("../src/lib/engine/remix/echo-guard");

const argv = process.argv.slice(2);
const arg = (flag: string) => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : null;
};
const STORAGE_PATH = arg("--path");
const NICHE = arg("--niche") ?? "fitness";

const RED = "\x1b[31m", GREEN = "\x1b[32m", DIM = "\x1b[2m", OFF = "\x1b[0m";

interface SourceBeat { index: number; role: string; t_start: number; t_end: number; duration_s: number; spoken: string | null }
interface AdaptedBeat { index: number; spoken: string; on_screen_text: string; shot: string }

const words = (s: string | null | undefined) => (s ? s.trim().split(/\s+/u).filter(Boolean).length : 0);

async function main() {
  if (!STORAGE_PATH) throw new Error("pass --path <videos-bucket-key>");

  const supabase = createServiceClient();
  const signed = await supabase.storage.from("videos").createSignedUrl(STORAGE_PATH, 3600);
  if (signed.error || !signed.data?.signedUrl) throw new Error(`sign failed: ${signed.error?.message}`);

  console.log(`${"═".repeat(78)}\n  PROBE — duration plausibility + D-01 echo check\n${"═".repeat(78)}`);
  console.log(`  object : ${STORAGE_PATH}\n  niche  : ${NICHE}  ${DIM}(deliberately unrelated to the source)${OFF}\n`);

  const omni = await analyzeVideoWithOmni(signed.data.signedUrl);
  const structural = omniOutputToStructuralInput(omni);
  if (!structural) throw new Error("omniOutputToStructuralInput returned null — decode_failed");

  const decode = await runDecode(structural);
  if (!decode) throw new Error("runDecode returned null — decode_failed");

  const bp = buildBlueprint(structural);
  console.log(`  source blueprint: ${bp.beats.length} beats · has_speech=${bp.has_speech} · ` +
    `from_fixed_buckets=${bp.from_fixed_buckets} · wps=${bp.words_per_second}\n`);

  const concepts = await generateAdaptConcepts({
    ...decodeResultToAdaptInput(decode, NICHE),
    blueprint: bp,
    target: null,
  });
  if (!concepts?.length) throw new Error("generateAdaptConcepts returned null/empty — adapt_failed");

  const sourceByIndex = new Map<number, SourceBeat>(bp.beats.map((b: SourceBeat) => [b.index, b]));
  let worstEcho = 0;
  let pairsChecked = 0;
  const offenders: string[] = [];

  concepts.forEach((c: { hook?: string; script?: AdaptedBeat[] }, ci: number) => {
    console.log(`${"─".repeat(78)}\n  CONCEPT ${ci + 1}${c.hook ? ` — ${JSON.stringify(c.hook).slice(0, 60)}` : ""}`);
    if (!c.script?.length) {
      console.log(`    ${RED}no script[] — nothing to check${OFF}`);
      return;
    }
    for (const ab of c.script) {
      const src = sourceByIndex.get(ab.index);
      if (!src) { console.log(`    beat ${ab.index}: ${RED}no matching source beat${OFF}`); continue; }

      // THE GATE (owner ruling 2026-08-12): only the source's SUBJECT must not survive.
      const leaked = survivingSubjectTokens(src.spoken ?? "", ab.spoken ?? "");
      // Informational only. Under a 1:1 doctrine shared scaffolding is the ASSET, not a defect —
      // printed so a human can see how faithful the copy is, never to fail the run.
      const shared = sharedContentTokens(src.spoken ?? "", ab.spoken ?? "");
      pairsChecked++;
      worstEcho = Math.max(worstEcho, leaked.length);
      if (leaked.length > 0) offenders.push(`concept ${ci + 1} beat ${ab.index}: ${leaked.join(", ")}`);

      // Duration plausibility — adapted words against the beat's own length, at the source's rate.
      const w = words(ab.spoken);
      const rate = src.duration_s > 0 ? w / src.duration_s : 0;
      const flag = rate > 6 ? `${RED}TOO DENSE${OFF}` : rate === 0 ? `${DIM}silent${OFF}` : `${GREEN}ok${OFF}`;
      const echoFlag = leaked.length > 0
        ? `${RED}SUBJECT LEAK[${leaked.join("|")}]${OFF}`
        : `${GREEN}no subject leak${OFF}`;
      const fidelity = `${DIM}fidelity ${shared.length} shared${OFF}`;

      console.log(`    [${String(src.role).padEnd(6)}] ${src.t_start}-${src.t_end} (${src.duration_s}s)`);
      console.log(`      src : ${src.spoken ? JSON.stringify(src.spoken).slice(0, 66) : `${DIM}null${OFF}`}`);
      console.log(`      new : ${JSON.stringify(ab.spoken).slice(0, 66)}`);
      console.log(`      ${w}w → ${rate.toFixed(1)} w/s ${flag} · ${echoFlag} · ${fidelity}`);
    }
  });

  console.log(`\n${"═".repeat(78)}`);
  console.log(`  pairs checked        : ${pairsChecked}`);
  console.log(`  worst subject leak   : ${worstEcho}`);
  if (offenders.length) {
    console.log(`\n  ${RED}❌ SUBJECT LEAK${OFF} — a source name reached the creator's version on:`);
    for (const o of offenders) console.log(`     ${o}`);
    console.log(`\n  A slot the model failed to swap. Structure copied 1:1 is correct; the`);
    console.log(`  source's own people and brands are not.`);
  } else {
    console.log(`\n  ${GREEN}✅ NO SUBJECT LEAK${OFF} — every source name was swapped for the niche.`);
  }
  console.log(`${"═".repeat(78)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
