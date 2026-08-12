/**
 * LIVE PROBE — is generateAdaptConcepts actually deterministic?
 *
 * adapt.ts sets `temperature: 0` and `seed: QWEN_SEED` with the comment
 * "reproducible (D-04 determinism requirement)". Four live echo checks against the same video
 * produced four materially different scripts, two of which leaked the source's topic and one of
 * which did not. Either
 *
 *   (a) the ADAPT call is non-deterministic despite temp 0 + a fixed seed, or
 *   (b) the adapt call is fine and the variance came from its INPUT — the omni read upstream.
 *
 * The answer decides the remedy. Under (a) no prompt wording can be trusted to hold and the fix
 * has to be a mechanical post-generation gate. Under (b) the instability is upstream and the
 * prompt is being blamed for someone else's variance.
 *
 * NO omni call. One hand-fixed AdaptInput, byte-identical across N runs, so the ONLY thing that
 * can differ is the model.
 *
 * Usage:
 *   npx tsx scripts/probe-adapt-determinism.ts [--runs 3]
 */
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import { createHash } from "crypto";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

/* eslint-disable @typescript-eslint/no-require-imports */
const { generateAdaptConcepts } = require("../src/lib/engine/remix/adapt");
const { sharedContentTokens } = require("../src/lib/engine/remix/echo-guard");

const argv = process.argv.slice(2);
const i = argv.indexOf("--runs");
const RUNS = i >= 0 ? Number(argv[i + 1]) : 3;

/** The blueprint MEASURED from omni-split/59455-447571480576291.mp4, frozen here verbatim. */
const BLUEPRINT = {
  duration_s: 28,
  words_per_second: 4.25,
  has_speech: true,
  from_fixed_buckets: false,
  beats: [
    // spoken_span_s: 8 on the hook — measured. The 0-8s cell was split at the 3s line and CR-01
    // kept the whole quote here, so this 3s beat holds eight seconds of talking.
    { index: 0, t_start: 0,  t_end: 3,  duration_s: 3, role: "hook", spoken_span_s: 8,
      spoken: "My best friend is Emily Rose Johnson. Her birthday is May 2nd, 2001.",
      on_screen_text: null, visual_event: "talking head", audio_event: "greeting", cuts: 1, weakness: null },
    { index: 1, t_start: 3,  t_end: 8,  duration_s: 5, role: "setup", spoken_span_s: null,
      spoken: null,
      on_screen_text: null, visual_event: "talking head", audio_event: "explanation", cuts: 1, weakness: null },
    { index: 2, t_start: 8,  t_end: 17, duration_s: 9, role: "turn", spoken_span_s: null,
      spoken: "My best friend is John. What's his last name? I have no idea. What's his birthday? No fucking clue.",
      on_screen_text: null, visual_event: "hard cut back", audio_event: "reply", cuts: 1, weakness: null },
    { index: 3, t_start: 17, t_end: 21, duration_s: 4, role: "payoff", spoken_span_s: null,
      spoken: "In our 16 years of friendship and thousands of hours we've spent together, how many pictures have we taken? One. Especially the ones I love.",
      on_screen_text: null, visual_event: "hard cut to new character", audio_event: "reply", cuts: 1, weakness: null },
    { index: 4, t_start: 21, t_end: 28, duration_s: 7, role: "close", spoken_span_s: null,
      spoken: null,
      on_screen_text: null, visual_event: "end of clip", audio_event: "silence", cuts: 1, weakness: null },
  ],
};

const INPUT = {
  hook_pattern:   "Opens on a confident factual claim about a person, stated as if obvious.",
  structure:      "Claim, then an immediate contrast that undercuts it, then a tally that lands the point.",
  the_turn:       "The second speaker cannot answer the same questions the first answered easily.",
  emotional_beat: "Warm recognition sliding into self-aware embarrassment.",
  repeatable:     [{ label: "paired-interview contrast", detail: "same questions, two subjects, cut between them" }],
  niche:          "fitness",
  blueprint:      BLUEPRINT,
  target:         null,
};

const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 12);

async function main() {
  console.log(`${"═".repeat(78)}\n  PROBE — adapt determinism (temperature 0, seed fixed)\n${"═".repeat(78)}`);
  console.log(`  input : FROZEN — byte-identical across all ${RUNS} runs (sha ${sha(JSON.stringify(INPUT))})`);
  console.log(`  ${"\x1b[2m"}Any difference below is the MODEL, not the input.${"\x1b[0m"}\n`);

  const fingerprints: string[] = [];

  for (let r = 0; r < RUNS; r++) {
    const concepts = await generateAdaptConcepts(INPUT);
    if (!concepts?.length) { console.log(`  run ${r + 1}: ${"\x1b[31m"}adapt_failed${"\x1b[0m"}`); continue; }

    const fp = sha(JSON.stringify(concepts));
    fingerprints.push(fp);

    // Worst echo across every beat of every concept, using the same gate the plan specifies.
    let worst = 0;
    for (const c of concepts) {
      for (const ab of c.script ?? []) {
        const src = BLUEPRINT.beats.find((b) => b.index === ab.index);
        worst = Math.max(worst, sharedContentTokens(src?.spoken ?? "", ab.spoken ?? "").length);
      }
    }
    // Hook-beat density — the measure that decides whether a line can be said aloud.
    const hookRates = concepts.map((c: { script?: Array<{ index: number; spoken: string }> }) => {
      const hb = c.script?.find((s) => s.index === 0);
      const w = hb?.spoken ? hb.spoken.trim().split(/\s+/u).filter(Boolean).length : 0;
      return w / 3; // the hook beat is 3s
    });
    const dense = hookRates.filter((x: number) => x > 6).length;
    // Does the sheet EXIST? A concept with no script[] is the pre-lane artefact — three text
    // concepts, no beats — returned with no error and exit 0.
    const withScript = concepts.filter((c: { script?: unknown[] }) => (c.script?.length ?? 0) > 0).length;
    console.log(
      `  run ${r + 1}: fp ${fp} · script on ${withScript}/${concepts.length} concepts` +
      `${withScript === 0 ? "  ← NO SHEET" : ""} · worst echo ${worst} · hook w/s ` +
      `[${hookRates.map((x: number) => x.toFixed(1)).join(", ")}]${dense ? `  ← ${dense} TOO DENSE` : ""}`,
    );
  }

  const unique = new Set(fingerprints);
  console.log(`\n${"═".repeat(78)}`);
  if (unique.size === 1) {
    console.log(`  ✅ DETERMINISTIC — ${fingerprints.length} runs, 1 distinct output.`);
    console.log(`     The echo variance came from the INPUT (the omni read), not the adapt call.`);
  } else {
    console.log(`  ❌ NON-DETERMINISTIC — ${fingerprints.length} runs, ${unique.size} distinct outputs`);
    console.log(`     on byte-identical input at temperature 0 with a fixed seed.`);
    console.log(`     D-04's determinism assumption does not hold. Prompt wording alone cannot`);
    console.log(`     make the echo gate pass reliably — it needs a mechanical post-generation check.`);
  }
  console.log(`${"═".repeat(78)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
