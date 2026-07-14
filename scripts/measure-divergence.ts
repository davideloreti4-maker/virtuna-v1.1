/**
 * measure-divergence.ts — is the P2 divergence panel worth building?
 *
 * The handoff (docs/HANDOFF-2026-07-13-audience-next.md §4, step 2) asks a prior question before
 * any UI is written: run N Reads against a calibrated audience and count how often `personaFlips`
 * is non-empty. If flips are rare, the panel is honest but boring — and THAT finding
 * ("calibration barely moves the verdict") matters more than the panel.
 *
 * This harness answers it — and one MORE question that decides whether the first answer means
 * anything at all:
 *
 *   ⚠️ IS A FLIP SIGNAL, OR IS IT NOISE?
 *
 * `runFlashTextMode` sets temperature:0 + a pinned seed (run-flash-text-mode.ts:139-142), so the
 * two sides of a Read are SUPPOSED to differ only because the audience differs. But temp:0 + seed
 * is a REQUEST, not a guarantee — hosted LLM APIs stay only approximately deterministic under
 * batching. If the engine disagrees with ITSELF as often as the two AUDIENCES disagree, then
 * `personaFlips` is a random number generator and the divergence panel would show users noise
 * with a confident face on it.
 *
 * DESIGN — every concept is run TWICE as a full pair (A and B), giving three numbers:
 *
 *   TREATMENT  flips(zachA, generalA)   — what the panel would show today, from ONE Read
 *   NOISE      flips(zachA, zachB)      — the SAME audience vs ITSELF. Pure jitter. The floor.
 *   REPRODUCIBLE  T1 ∩ T2               — flips that appear in BOTH independent pairs, same
 *                                         archetype AND same direction. This is the only
 *                                         divergence that is a fact about the audience rather
 *                                         than about the sampler.
 *
 * The panel is worth building iff REPRODUCIBLE is a large fraction of TREATMENT. If most flips
 * evaporate on re-run, the honest product is not a prettier panel — it is a different claim.
 *
 * Run:  npx tsx scripts/measure-divergence.ts
 * Real DashScope calls, real scrape-calibrated audience row. 4 Flash calls per concept.
 */

import { config } from "dotenv";
import { resolve } from "path";
import { writeFileSync } from "fs";
import { tmpdir } from "os";
import { register } from "tsconfig-paths";
import tsconfig from "../tsconfig.json";

config({ path: resolve(__dirname, "../.env.local") });
register({
  baseUrl: resolve(__dirname, ".."),
  paths: tsconfig.compilerOptions.paths as Record<string, string[]>,
});

/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require("@supabase/supabase-js");
const { runTwoAudienceRead } = require("../src/lib/engine/flash/two-audience-read");
const { GENERAL_AUDIENCE, rowToAudience } = require("../src/lib/audience/audience-repo");
/* eslint-enable @typescript-eslint/no-require-imports */

/**
 * The scrape-calibrated audience — the ONLY row in the DB with calibration.source='scrape'.
 * ⚠️ `calibration` is a TOP-LEVEL COLUMN, not a key inside `signature` (verified in SQL). Reading
 * `signature.calibration` returns undefined and makes a correctly-calibrated audience look raw.
 */
const ZACH_KING_ID = "6b1114e6-bae9-462e-9f06-a2964b17ee67";

/**
 * Ten concepts spanning ON-niche (visual illusion — what Zach King's crowd actually shows up for)
 * through OFF-niche talking-head, sales, and generic advice. A divergence panel is only interesting
 * if the two audiences part company SOMEWHERE in this spread; running ten near-identical concepts
 * would rig the answer in either direction.
 */
const CONCEPTS = [
  "A one-take clip where I pour coffee out of a photo of a mug into a real cup, then drink it.",
  "I reveal the camera trick behind my most viral illusion, step by step.",
  "5 morning habits that changed my life.",
  "Why I'm launching a $49 course on video editing - and who it's not for.",
  "The time I got banned from a hotel for filming in the lobby.",
  "How to fake a perfect jump cut with any phone in 30 seconds.",
  "Most viral creators are lying to you about how long editing actually takes.",
  "What my desk really looks like after a 14-hour edit.",
  "I almost quit making videos last year. Here's what changed.",
  "Trying the outfit-swap spin trend - but it goes wrong on purpose.",
];

type Verdict = "stop" | "scroll";
interface Persona {
  archetype: string;
  verdict: Verdict;
  quote: string;
}
interface Entry {
  name: string;
  band: string;
  fraction?: string;
  personas: Persona[];
}

/**
 * Flips between two persona sets, keyed by ARCHETYPE (the binding key, #282) — never by array
 * index: the two Flash runs are independent and carry no ordering guarantee, so zipping by
 * position would compare a saver against a lurker and invent flips that never happened.
 * Mirrors read-rollup.ts exactly.
 */
function flipSet(mine: Persona[], other: Persona[]): Set<string> {
  const theirs = new Map(other.map((p) => [p.archetype, p.verdict]));
  const out = new Set<string>();
  for (const p of mine) {
    const t = theirs.get(p.archetype);
    // Encode DIRECTION too: a persona that stops-for-mine/scrolls-for-other in run A and does the
    // exact reverse in run B has not "reproduced" — it has contradicted itself.
    if (t !== undefined && t !== p.verdict) out.add(`${p.archetype}:${p.verdict}>${t}`);
  }
  return out;
}

const inter = (a: Set<string>, b: Set<string>) => new Set([...a].filter((x) => b.has(x)));

async function main(): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data: row, error } = await supabase
    .from("audiences")
    .select("*")
    .eq("id", ZACH_KING_ID)
    .single();
  if (error || !row) throw new Error(`audience load failed: ${error?.message}`);

  const zach = rowToAudience(row);
  const calib = (row as { calibration?: { source?: string } }).calibration;
  console.log(
    `audience "${zach.name}" · mode=${zach.mode} · personas=${zach.personas?.length ?? 0}` +
      ` · calibration.source=${calib?.source ?? "NONE"}`,
  );
  if (calib?.source !== "scrape") {
    throw new Error("REFUSING TO MEASURE: this audience is not scrape-calibrated. Wrong row.");
  }
  console.log(`vs "${GENERAL_AUDIENCE.name}" (virtual, mode=${GENERAL_AUDIENCE.mode})\n`);

  const rows: Array<{
    concept: string;
    treatment: number;
    noise: number;
    reproducible: number;
    bandMoved: boolean;
    t1: string[];
    t2: string[];
    repro: string[];
  }> = [];

  console.log(
    "  T=treatment flips (zach vs general, one Read) · N=noise (zach vs ITSELF) · R=reproducible (T1∩T2)\n",
  );

  for (const concept of CONCEPTS) {
    // Two INDEPENDENT pairs for the same concept. Same inputs, same seed, same temperature.
    const [a, b] = await Promise.all([
      runTwoAudienceRead(concept, [zach, GENERAL_AUDIENCE]),
      runTwoAudienceRead(concept, [zach, GENERAL_AUDIENCE]),
    ]);

    const pick = (blk: { props: { audiences: Entry[] } }) => {
      const es = blk.props.audiences;
      const mine = es.find((e) => e.name === zach.name)!;
      return { mine, other: es.find((e) => e !== mine)! };
    };
    const A = pick(a);
    const B = pick(b);

    const t1 = flipSet(A.mine.personas, A.other.personas);
    const t2 = flipSet(B.mine.personas, B.other.personas);
    const noiseZ = flipSet(A.mine.personas, B.mine.personas); // same audience, twice
    const repro = inter(t1, t2);
    const bandMoved = A.mine.band !== A.other.band;

    rows.push({
      concept,
      treatment: t1.size,
      noise: noiseZ.size,
      reproducible: repro.size,
      bandMoved,
      t1: [...t1],
      t2: [...t2],
      repro: [...repro],
    });

    console.log(
      `  T=${t1.size} N=${noiseZ.size} R=${repro.size}  ` +
        `${A.mine.band.padEnd(6)}(${A.mine.fraction ?? "?"}) vs ${A.other.band.padEnd(6)}(${A.other.fraction ?? "?"})` +
        `${bandMoved ? "  BAND MOVED" : ""}  — "${concept.slice(0, 38)}…"`,
    );
    if (repro.size > 0) console.log(`         reproducible: ${[...repro].join("  ")}`);
  }

  const n = rows.length;
  const sum = (k: "treatment" | "noise" | "reproducible") =>
    rows.reduce((acc, r) => acc + r[k], 0);
  const T = sum("treatment");
  const N = sum("noise");
  const R = sum("reproducible");

  console.log(`\n── VERDICT (${n} concepts, 2 independent pairs each) ──────────────────`);
  console.log(`  TREATMENT   ${(T / n).toFixed(1)} flips/Read   — what the panel would show from one Read`);
  console.log(`  NOISE       ${(N / n).toFixed(1)} flips/Read   — the SAME audience vs itself. The floor.`);
  console.log(`  REPRODUCIBLE ${(R / n).toFixed(1)} flips/Read  — survived an independent re-run (${T > 0 ? Math.round((R / T) * 100) : 0}% of treatment)`);
  console.log(
    `\n  personaDiverged (as the rollup counts it): ${rows.filter((r) => r.treatment > 0).length}/${n}`,
  );
  console.log(
    `  ...of which REPRODUCIBLY diverged:         ${rows.filter((r) => r.reproducible > 0).length}/${n}`,
  );
  console.log(`  band diverged:                             ${rows.filter((r) => r.bandMoved).length}/${n}`);
  console.log(
    `\n  → If REPRODUCIBLE is a small fraction of TREATMENT, the panel is mostly showing` +
      `\n    the sampler's jitter attributed to named people. Do not ship it as-is.\n`,
  );

  // Raw dump goes to the OS temp dir, never the repo: this is evidence for a decision, not an
  // artifact of it. The committed asset is the harness; the numbers belong in the handoff.
  const out = resolve(tmpdir(), "divergence-measurement.json");
  writeFileSync(out, JSON.stringify(rows, null, 2));
  console.log(`  raw → ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
