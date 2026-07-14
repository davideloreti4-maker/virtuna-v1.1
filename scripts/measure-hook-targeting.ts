/**
 * measure-hook-targeting.ts — does per-persona hook generation ACTUALLY differentiate?
 *
 * ─── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 *
 * The cards look great. That is not evidence. Last session, hooks that "obviously" reflected the
 * audience scored 45% with a blind judge — worse than a coin flip (handoff §4c) — and an earlier
 * pass nearly killed a real feature by trusting one blunt metric. So:
 *
 *   RULE 2: MEASURE YOUR INSTRUMENT BEFORE YOU TRUST IT.
 *
 * The claim under test is falsifiable and sharp: **a judge who is told nothing should be able to
 * tell which persona each hook was written for.** If it cannot, the feature does not work, however
 * good the cards look — and this script must be allowed to say so.
 *
 * ─── DESIGN ───────────────────────────────────────────────────────────────────
 *
 * Per topic, TWO arms through the REAL pipeline (real DashScope, real scrape-calibrated row):
 *
 *   TREATMENT  audience = Zach King (calibrated) → 5 hooks, each with a KNOWN assigned persona.
 *   CONTROL    audience = General               → 5 hooks written for NOBODY. We then pair them
 *                                                 with the same 5 personas by position — a mapping
 *                                                 that is meaningless BY CONSTRUCTION.
 *
 * A blind judge sees the 5 hooks (SHUFFLED) + the 5 persona descriptions and must match them 1:1.
 * Chance = 1/5 = 20% (expected fixed points of a random permutation = 1).
 *
 * ⚠️ THE CONTROL IS THE WHOLE POINT. Without it, a high treatment score proves nothing: the judge
 * might be matching on topical cues that happen to correlate with a persona, or simply favour the
 * order it was given. The control asks the judge to find structure in hooks where NONE WAS PUT.
 * If the control also scores well above 20%, the instrument is finding phantoms and the treatment
 * number is inflated. (A 3-concept control arm once put a noise floor 6× too high and nearly
 * killed a real feature — small control arms lie.)
 *
 * ⚠️ THE JUDGE IS BLIND AND THE HOOKS ARE SHUFFLED. In the treatment arm, hook i is written for
 * person i — so an unshuffled presentation could be solved by positional matching alone, which
 * would inflate the score to 100% while proving nothing about the WRITING.
 *
 * ⚠️ THE JUDGE'S INPUT IS DUMPED. A null (or a win) means nothing unless the data provably arrived.
 *
 * Run:  npx tsx scripts/measure-hook-targeting.ts
 * Cost: 2 × TOPICS pipeline runs (~55s each) + 2 × TOPICS judge calls.
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
const { runHooksPipeline } = require("../src/lib/tools/runners/hooks-runner");
const { selectHookTargets } = require("../src/lib/audience/select-hook-targets");
const { GENERAL_AUDIENCE, rowToAudience } = require("../src/lib/audience/audience-repo");
const { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } = require("../src/lib/engine/qwen/client");
/* eslint-enable @typescript-eslint/no-require-imports */

/** The ONLY row with calibration.source='scrape'. `calibration` is a TOP-LEVEL column. */
const ZACH_KING_ID = "6b1114e6-bae9-462e-9f06-a2964b17ee67";

/** On-niche for Zach King — the feature's best case. If it fails HERE it fails everywhere. */
const TOPICS = [
  "a coffee cup that pours itself back into the pot",
  "a levitation illusion anyone can film at home",
  "swapping my outfit mid-spin in one take",
  "walking through a solid wall on camera",
  "turning a photo of a pizza into a real one",
  "making my cat disappear behind a blanket",
];

const HOOK_COUNT = 5;

interface Hook {
  hookLine: string;
  truthArchetype: string; // the persona this hook was ACTUALLY written for (treatment) or paired with (control)
}
interface Persona {
  archetype: string;
  repaint: string;
}

/** Deterministic shuffle (mulberry32) — reproducible, and never the identity permutation. */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  let t = seed + 0x6d2b79f5;
  const rand = () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * The blind judge. Sees hooks (shuffled) + persona descriptions. Does NOT see the assignment, the
 * archetype slugs on the hooks, the topic arm, or which arm it is judging.
 */
async function judge(
  hooks: Hook[],
  personas: Persona[],
  dump: string[],
): Promise<Map<string, string>> {
  const shuffled = seededShuffle(hooks, 1234);
  const hookList = shuffled.map((h, i) => `H${i + 1}. ${h.hookLine}`).join("\n");
  const personaList = personas.map((p) => `- ${p.archetype}: ${p.repaint}`).join("\n");

  const prompt = `Below are ${shuffled.length} TikTok hooks, and ${personas.length} audience segments of one creator.

HOOKS:
${hookList}

AUDIENCE SEGMENTS:
${personaList}

Each hook was written to stop ONE specific segment. Match each hook to the segment it was written for. Use each segment exactly once.

Respond ONLY with JSON: { "matches": [ { "hook": "H1", "archetype": "<slug>" }, ... ] }`;

  dump.push(prompt);

  const ai = getQwenClient();
  const res = await ai.chat.completions.create({
    model: QWEN_REASONING_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a precise classifier. You are given hooks and audience segments and must match them. Output JSON only.",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    seed: QWEN_SEED,
    enable_thinking: false,
  } as never);

  const raw = res.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as { matches?: { hook: string; archetype: string }[] };

  // H-index → the hook's TRUE archetype, so we can score the judge's guess.
  const guess = new Map<string, string>();
  for (const m of parsed.matches ?? []) {
    const idx = parseInt(String(m.hook).replace(/\D/g, ""), 10) - 1;
    const h = shuffled[idx];
    if (h) guess.set(h.hookLine, String(m.archetype).trim().toLowerCase().replace(/[[\]]/g, ""));
  }
  return guess;
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: row, error } = await supabase
    .from("audiences")
    .select("*")
    .eq("id", ZACH_KING_ID)
    .single();
  if (error || !row) throw new Error(`Zach King row not found: ${error?.message}`);
  const zach = rowToAudience(row);

  // The cast is deterministic and identical across topics — the same 5 people every run.
  const targets = selectHookTargets(zach, HOOK_COUNT);
  const personas: Persona[] = targets.map((t: { archetype: string; repaint: string }) => ({
    archetype: t.archetype,
    repaint: t.repaint,
  }));

  console.log("CAST (deterministic, slot-spread):");
  for (const p of personas) console.log(`  ${p.archetype.padEnd(24)} ${p.repaint}`);
  console.log();

  const dumps: string[] = [];
  const rows: { topic: string; arm: string; correct: number; total: number }[] = [];

  for (const topic of TOPICS) {
    for (const arm of ["treatment", "control"] as const) {
      const audience = arm === "treatment" ? zach : GENERAL_AUDIENCE;

      const { blocks } = await runHooksPipeline({
        ask: topic,
        platform: "tiktok",
        profileRow: null,
        audience,
      });

      let hooks: Hook[];
      if (arm === "treatment") {
        // Ground truth = what the model said it wrote for, validated by the runner.
        hooks = blocks
          .filter((b: { props: { target?: { archetype: string } } }) => b.props.target)
          .map((b: { props: { hookLine: string; target: { archetype: string } } }) => ({
            hookLine: b.props.hookLine,
            truthArchetype: b.props.target.archetype,
          }));
      } else {
        // CONTROL: hooks written for NOBODY, paired with personas by position. The pairing is
        // meaningless by construction — a judge scoring above chance here is finding phantoms.
        hooks = blocks
          .slice(0, personas.length)
          .map((b: { props: { hookLine: string } }, i: number) => ({
            hookLine: b.props.hookLine,
            truthArchetype: personas[i]!.archetype,
          }));
      }

      if (hooks.length < personas.length) {
        console.log(`  ⚠ ${arm}/${topic.slice(0, 30)}: only ${hooks.length} usable hooks — skipped`);
        continue;
      }

      const guess = await judge(hooks, personas, dumps);
      const correct = hooks.filter((h) => guess.get(h.hookLine) === h.truthArchetype).length;
      rows.push({ topic, arm, correct, total: hooks.length });
      console.log(
        `  ${arm.padEnd(10)} ${topic.slice(0, 34).padEnd(36)} ${correct}/${hooks.length}`,
      );
    }
  }

  const agg = (arm: string) => {
    const r = rows.filter((x) => x.arm === arm);
    const c = r.reduce((s, x) => s + x.correct, 0);
    const t = r.reduce((s, x) => s + x.total, 0);
    return { c, t, pct: t ? (100 * c) / t : 0 };
  };
  const T = agg("treatment");
  const C = agg("control");

  console.log("\n═══════════════════ RESULT ═══════════════════");
  console.log(`  chance (1/${personas.length})          20.0%`);
  console.log(`  CONTROL   (written for nobody) ${C.c}/${C.t} = ${C.pct.toFixed(1)}%   ← the instrument's phantom rate`);
  console.log(`  TREATMENT (written per-persona) ${T.c}/${T.t} = ${T.pct.toFixed(1)}%`);
  console.log("══════════════════════════════════════════════");
  console.log(
    T.pct > C.pct + 20
      ? "\n✅ The judge can tell WHO each hook was written for. The differentiation is real."
      : "\n🔴 The judge CANNOT reliably tell them apart. The feature does not work — say so.",
  );

  const dumpPath = resolve(tmpdir(), "hook-targeting-judge-prompts.txt");
  writeFileSync(dumpPath, dumps.join("\n\n" + "=".repeat(80) + "\n\n"));
  console.log(`\nJudge prompts dumped → ${dumpPath}  (verify the input ARRIVED before believing the output)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
