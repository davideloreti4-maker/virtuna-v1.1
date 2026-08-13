/**
 * SHOW the shoot sheet — the lane's actual deliverable, printed as a creator reads it.
 *
 * The probes in this directory all MEASURE something and truncate the sheet to fit their
 * question. This one just renders it: every beat, every field, nothing clipped.
 *
 * Same path as probe-echo-check.ts (no Apify, no auth, no dev server): sign an existing storage
 * object → analyzeVideoWithOmni → omniOutputToStructuralInput → runDecode → buildBlueprint →
 * generateAdaptConcepts. ~2¢ per run.
 *
 * Usage:
 *   node node_modules/tsx/dist/cli.mjs scripts/show-shoot-sheet.ts --path <key> [--niche fitness] [--concept 1]
 *   (never npx — it wraps and swallows output)
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

const argv = process.argv.slice(2);
const arg = (f: string) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const STORAGE_PATH = arg("--path");
const NICHE   = arg("--niche") ?? "fitness";
const ONLY    = arg("--concept") ? Number(arg("--concept")) : null;

const DIM = "\x1b[2m", B = "\x1b[1m", CY = "\x1b[36m", YE = "\x1b[33m", OFF = "\x1b[0m";
const W = 92;

interface SourceBeat {
  index: number; role: string; t_start: number; t_end: number; duration_s: number;
  spoken: string | null; on_screen_text: string | null; visual_event: string;
  weakness: { factor: string; score: number; tip: string } | null;
}
interface AdaptedBeat {
  index: number; spoken: string; on_screen_text: string; shot: string; repair?: string;
}
interface Concept {
  hook: string; angle: string; who_its_for: string; format_borrowed: string;
  personaStops?: number; stopQuote?: string;
  production?: { shots: string; onScreenText: string; setup: string; edit?: string };
  script?: AdaptedBeat[];
}

/** Wrap to the panel width, indenting continuation lines so a long line stays readable. */
function wrap(text: string, indent: number): string {
  const width = W - indent - 2;
  const pad = " ".repeat(indent);
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/u)) {
    if (line && (line + " " + word).length > width) { out.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  return out.map((l, i) => (i === 0 ? l : pad + l)).join("\n");
}

const say = (label: string, text: string, indent: number, colour = "") =>
  console.log(`${" ".repeat(indent)}${colour}${label}${OFF} ${wrap(text, indent + label.length + 1)}`);

async function main() {
  if (!STORAGE_PATH) throw new Error("pass --path <videos-bucket-key>");

  const supabase = createServiceClient();
  const signed = await supabase.storage.from("videos").createSignedUrl(STORAGE_PATH, 3600);
  if (signed.error || !signed.data?.signedUrl) throw new Error(`sign failed: ${signed.error?.message}`);

  console.log(`\n${"═".repeat(W)}\n  ${B}THE SHOOT SHEET${OFF}   ${DIM}${STORAGE_PATH} · niche: ${NICHE}${OFF}\n${"═".repeat(W)}`);

  const omni = await analyzeVideoWithOmni(signed.data.signedUrl);
  const structural = omniOutputToStructuralInput(omni);
  if (!structural) throw new Error("omniOutputToStructuralInput returned null — decode_failed");
  const decode = await runDecode(structural);
  if (!decode) throw new Error("runDecode returned null — decode_failed");
  const bp = buildBlueprint(structural);

  // ---- what the source actually is -----------------------------------------
  console.log(`\n  ${B}THE ORIGINAL${OFF} ${DIM}— ${bp.duration_s}s · ${bp.beats.length} beats · ${bp.words_per_second} words/sec${OFF}\n`);
  for (const b of bp.beats as SourceBeat[]) {
    console.log(`  ${CY}[${String(b.role).toUpperCase().padEnd(6)}]${OFF} ${DIM}${b.t_start}–${b.t_end}s (${b.duration_s}s)${OFF}  ${b.visual_event}`);
    if (b.spoken)         say("   says:", `"${b.spoken}"`, 4, DIM);
    if (b.on_screen_text) say("   text:", `"${b.on_screen_text}"`, 4, DIM);
    if (b.weakness)       say("   weak:", `${b.weakness.factor} ${b.weakness.score}/10 — ${b.weakness.tip}`, 4, YE);
  }

  const concepts: Concept[] | null = await generateAdaptConcepts({
    ...decodeResultToAdaptInput(decode, NICHE),
    blueprint: bp,
    target: null,
  });
  if (!concepts?.length) throw new Error("generateAdaptConcepts returned null/empty — adapt_failed");

  const sourceByIndex = new Map<number, SourceBeat>((bp.beats as SourceBeat[]).map((b) => [b.index, b]));

  concepts.forEach((c, ci) => {
    if (ONLY !== null && ci + 1 !== ONLY) return;
    console.log(`\n${"═".repeat(W)}\n  ${B}YOUR VERSION ${ci + 1}${OFF}` +
      (c.personaStops !== undefined ? `   ${DIM}stops ${c.personaStops}/10${OFF}` : ""));
    console.log(`${"═".repeat(W)}\n`);
    say("  Hook:  ", c.hook, 2, B);
    say("  Angle: ", c.angle, 2);
    say("  For:   ", c.who_its_for, 2);
    say("  Format:", c.format_borrowed, 2);
    if (c.stopQuote) say("  They think:", `"${c.stopQuote}"`, 2, DIM);

    if (!c.script?.length) {
      console.log(`\n  ${YE}(no beat-by-beat sheet in this concept)${OFF}`);
    } else {
      console.log(`\n  ${B}SHOOT IT, BEAT BY BEAT${OFF}\n`);
      for (const ab of c.script) {
        const src = sourceByIndex.get(ab.index);
        const head = src
          ? `${CY}[${String(src.role).toUpperCase().padEnd(6)}]${OFF} ${DIM}${src.t_start}–${src.t_end}s · ${src.duration_s}s${OFF}`
          : `${CY}[beat ${ab.index}]${OFF}`;
        console.log(`  ${head}`);
        if (ab.spoken)         say("   SAY: ", `"${ab.spoken}"`, 4);
        else                   console.log(`    ${DIM}SAY:  (nothing — carry it on screen)${OFF}`);
        if (ab.on_screen_text) say("   TEXT:", `"${ab.on_screen_text}"`, 4);
        if (ab.shot)           say("   SHOT:", ab.shot, 4, DIM);
        if (ab.repair)         say("   FIX: ", ab.repair, 4, YE);
        console.log("");
      }
    }

    if (c.production) {
      console.log(`  ${B}BEFORE YOU FILM${OFF}\n`);
      say("   Shots: ", c.production.shots, 4, DIM);
      say("   Setup: ", c.production.setup, 4, DIM);
      say("   Overlay:", c.production.onScreenText, 4, DIM);
      if (c.production.edit) say("   Edit:  ", c.production.edit, 4, DIM);
    }
  });

  console.log(`\n${"═".repeat(W)}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
