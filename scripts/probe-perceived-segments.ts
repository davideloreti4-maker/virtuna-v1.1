/**
 * LIVE PROBE — does omni populate PER-SEGMENT spoken_text?
 *
 * This is the one question Task 7 exists to answer and the only one fixtures cannot. Every
 * blueprint test in the tree supplies its own `spoken_text`, so the suite mirrors an assumption
 * about the producer instead of measuring it. If omni does not emit it, `has_speech` is false on
 * every real shoot sheet and the sheet goes on-screen-text-driven — for a reason no test can see.
 *
 * ONE DashScope call against an EXISTING storage object. No Apify spend, no dev server, no auth.
 *
 * Usage:
 *   npx tsx scripts/probe-perceived-segments.ts --path <videos-bucket-key>
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
const { omniOutputToStructuralInput } = require("../src/lib/engine/remix/decode");
const { buildBlueprint } = require("../src/lib/engine/remix/blueprint");
const { MIN_BOUNDARY_COUNT } = require("../src/lib/engine/qwen/normalize-segments");

const argv = process.argv.slice(2);
const pathIdx = argv.indexOf("--path");
const STORAGE_PATH = pathIdx >= 0 ? argv[pathIdx + 1] : null;

type Cell = {
  t_start: number; t_end: number;
  visual_event?: string; audio_event?: string;
  scene_boundary_reason?: string;
  spoken_text?: string | null; on_screen_text?: string | null;
};

function cellTable(label: string, cells: Cell[] | undefined) {
  console.log(`\n  ${label} — ${cells?.length ?? 0} cells`);
  if (!cells?.length) return;
  for (const c of cells.slice(0, 12)) {
    const spoken = c.spoken_text ? JSON.stringify(c.spoken_text).slice(0, 62) : "\x1b[31mnull\x1b[0m";
    console.log(
      `    ${String(c.t_start).padStart(5)}-${String(c.t_end).padEnd(5)} ` +
      `${(c.scene_boundary_reason ?? "—").slice(0, 24).padEnd(24)} spoken: ${spoken}`,
    );
  }
  if (cells.length > 12) console.log(`    … ${cells.length - 12} more`);
}

async function main() {
  if (!STORAGE_PATH) throw new Error("pass --path <videos-bucket-key>");

  const supabase = createServiceClient();
  const signed = await supabase.storage.from("videos").createSignedUrl(STORAGE_PATH, 3600);
  if (signed.error || !signed.data?.signedUrl) {
    throw new Error(`sign failed: ${signed.error?.message}`);
  }

  console.log(`${"═".repeat(78)}\n  PROBE — per-segment spoken_text\n${"═".repeat(78)}`);
  console.log(`  object  : ${STORAGE_PATH}`);
  console.log(`  gate    : MIN_BOUNDARY_COUNT = ${MIN_BOUNDARY_COUNT}`);

  const t0 = Date.now();
  const out = await analyzeVideoWithOmni(signed.data.signedUrl);
  console.log(`  latency : ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`  cost    : ${out.geminiResult?.cost_cents?.toFixed?.(5) ?? "?"}¢`);

  const perceived: Cell[] | undefined = out.perceived_segments;
  const normalized: Cell[] | undefined = out.segments;

  cellTable("segments (what every consumer sees)", normalized);
  cellTable("perceived_segments (the real read)", perceived);

  // ── THE ANSWER ────────────────────────────────────────────────────────────
  const withSpeech = perceived?.filter((c) => !!c.spoken_text).length ?? 0;
  const gateFired = normalized?.every((c) => c.scene_boundary_reason?.startsWith("fixed_bucket"));

  console.log(`\n${"─".repeat(78)}`);
  console.log(`  perceived cells        : ${perceived?.length ?? 0}`);
  console.log(`  …carrying spoken_text  : ${withSpeech}`);
  console.log(`  Rule 3 gate fired      : ${gateFired ? "YES — segments are FABRICATED" : "no"}`);

  const structural = omniOutputToStructuralInput(out);
  if (!structural) {
    console.log(`\n  ❌ omniOutputToStructuralInput returned NULL — decode_failed, no blueprint.`);
    return;
  }
  const bp = buildBlueprint(structural);
  console.log(`\n  blueprint: ${bp.beats.length} beats · has_speech=${bp.has_speech} · ` +
    `from_fixed_buckets=${bp.from_fixed_buckets} · wps=${bp.words_per_second}`);
  for (const b of bp.beats) {
    console.log(`    [${b.role.padEnd(6)}] ${b.t_start}-${b.t_end}  ` +
      `${b.spoken ? JSON.stringify(b.spoken).slice(0, 58) : "\x1b[31mnull\x1b[0m"}`);
  }

  console.log(`\n${"═".repeat(78)}`);
  if (withSpeech === 0) {
    console.log(`  ❌ VERDICT: omni returned NO per-segment spoken_text.`);
    console.log(`     The shoot sheet cannot be speech-driven. Task 1's input assumption is wrong,`);
    console.log(`     and the perceived-segments fix does not change that — it only proves it.`);
  } else {
    console.log(`  ✅ VERDICT: omni DOES populate per-segment spoken_text (${withSpeech}/${perceived?.length}).`);
  }
  console.log(`${"═".repeat(78)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
