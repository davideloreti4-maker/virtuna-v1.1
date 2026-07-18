/**
 * measure-targeting.ts — does per-persona generation ACTUALLY differentiate? Per skill.
 *
 * ─── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 *
 * The cards look great. That is not evidence. Hooks that "obviously" reflected the audience once
 * scored 45% with a blind judge — worse than a coin flip (handoff §4c) — and an earlier pass nearly
 * killed a real feature by trusting one blunt metric. So:
 *
 *   RULE 2: MEASURE YOUR INSTRUMENT BEFORE YOU TRUST IT.
 *
 * The claim under test is falsifiable and sharp: **a judge who is told nothing should be able to
 * tell which persona each card was written for.** If it cannot, the feature does not work, however
 * good the cards look — and this script must be allowed to say so.
 *
 * ─── ⚠️ A SCRIPT IS NOT A HOOK — WHY THIS IS PER-SKILL ────────────────────────
 *
 * Hooks scored 60% vs a 13.3% control (#299). That the same mechanism transfers to ideas and
 * scripts is a HYPOTHESIS, NOT A GIVEN, and it must be re-measured per skill before it ships:
 *
 *   - a HOOK is one atomic line where a person's whole psychology fits in eight words;
 *   - an IDEA is a concept — the differences may live in the take rather than the title;
 *   - a SCRIPT is five beats, where per-persona differences may simply WASH OUT across the arc
 *     (or where aiming at a 5% segment makes the script worse for everyone).
 *
 * "It doesn't transfer" is a FINDING, not a failure. Report it and do not ship that skill.
 *
 * ─── DESIGN ───────────────────────────────────────────────────────────────────
 *
 * Per topic, TWO arms through the REAL pipeline (real DashScope, real scrape-calibrated row):
 *
 *   TREATMENT  audience = Zach King (calibrated) → N cards, each with a KNOWN assigned persona.
 *   CONTROL    audience = General               → N cards written for NOBODY. We then pair them
 *                                                 with the same N personas by position — a mapping
 *                                                 that is meaningless BY CONSTRUCTION.
 *
 * A blind judge sees the N cards (SHUFFLED) + the N persona descriptions and must match them 1:1.
 * Chance = 1/N (expected fixed points of a random permutation = 1).
 *
 * ⚠️ THE CONTROL IS THE WHOLE POINT. Without it, a high treatment score proves nothing: the judge
 * might be matching on topical cues that happen to correlate with a persona, or simply favour the
 * order it was given. The control asks the judge to find structure in cards where NONE WAS PUT.
 * If the control also scores well above chance, the instrument is finding phantoms and the treatment
 * number is inflated. (A 3-concept control arm once put a noise floor 6× too high and nearly killed
 * a real feature — small control arms lie.)
 *
 * ⚠️ THE JUDGE IS BLIND AND THE CARDS ARE SHUFFLED. In the treatment arm, card i is written for
 * person i — so an unshuffled presentation could be solved by positional matching alone, which
 * would inflate the score to 100% while proving nothing about the WRITING.
 *
 * ⚠️ THE JUDGE'S INPUT IS DUMPED. A null (or a win) means nothing unless the data provably arrived.
 *
 * ─── WHY THE CONFOUND YOU ARE ABOUT TO WORRY ABOUT DOES NOT BITE ──────────────
 *
 * The treatment arm differs from the control by more than the assignment: a calibrated run also
 * carries the audience grounding line and the creator-voice steer, and General carries neither. So
 * why is the delta attributable to the ASSIGNMENT?
 *
 * Because the judge's task is WITHIN-TRIAL 1:1 matching. Every one of those extra inputs is
 * CONSTANT across the N cards of a trial (same audience, same voice, and for script the topic set is
 * identical in both arms) — and an input that is identical for all N cards cannot help you tell card
 * 1 from card 3. The ONLY thing that varies card-to-card inside a trial is which person it was
 * assigned. That is what the judge must be reading, because it is the only thing there is to read.
 *
 * (This is also independently corroborated: ambient audience text was measured at chance on its own
 * — embeddings p=0.43, blind judge 45%. It moves nothing. Handoff §4c.)
 *
 * Run:   npx tsx scripts/measure-targeting.ts <hooks|ideas> [topicLimit]
 * Smoke: npx tsx scripts/measure-targeting.ts ideas 1   ← one topic, ~2min, proves the binding lives
 * Cost:  2 × TOPICS pipeline runs (~55s each) + 2 × TOPICS judge calls.
 *
 * THE BIND RATE IS THE OTHER HALF OF THE INSTRUMENT. It is printed per treatment run and it is the
 * proof that the assignment ARRIVED: a card can only carry a target if the model was briefed on the
 * cast AND named someone back from it. A bind rate of 0 means the feature is dead on arrival and the
 * judge score below is meaningless — that is exactly how the "[lurker]" silent-drop bug (handoff §3)
 * shipped past 3,600 green tests. Never read the score without reading the bind rate.
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
const { runIdeasPipeline } = require("../src/lib/tools/runners/ideas-runner");
const { runScriptPipeline } = require("../src/lib/tools/runners/script-runner");
const { selectPersonaTargets } = require("../src/lib/audience/select-persona-targets");
const { GENERAL_AUDIENCE, rowToAudience } = require("../src/lib/audience/audience-repo");
const { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } = require("../src/lib/engine/qwen/client");
/* eslint-enable @typescript-eslint/no-require-imports */

/** The ONLY row with calibration.source='scrape'. `calibration` is a TOP-LEVEL column. */
const ZACH_KING_ID = "6b1114e6-bae9-462e-9f06-a2964b17ee67";

/**
 * On-niche for Zach King — the feature's best case. If it fails HERE it fails everywhere.
 *
 * The first SIX are the exact topics #299 measured hooks on; they are frozen so the hooks number
 * stays comparable across sessions. The rest exist only to give `script` enough trials (it burns
 * N topics per trial — see SKILLS.script).
 */
const TOPICS = [
  "a coffee cup that pours itself back into the pot",
  "a levitation illusion anyone can film at home",
  "swapping my outfit mid-spin in one take",
  "walking through a solid wall on camera",
  "turning a photo of a pizza into a real one",
  "making my cat disappear behind a blanket",
  "pulling an endless scarf out of a phone screen",
  "folding a paper plane that becomes a real one",
  "catching a falling glass that reassembles itself",
  "stepping into a painting and back out",
  "zipping open a wall like a tent flap",
  "pouring milk that turns into a cloud",
  "riding a skateboard that builds itself under me",
  "opening a fridge into a different season",
  "shrinking myself to hide inside a coffee mug",
];

/** A generated card, reduced to the text a reader actually judges it by. */
interface Unit {
  /** What the judge sees. MUST be the card's face — never the archetype, never the assignment. */
  text: string;
  /** The persona this card was ACTUALLY written for (treatment) or paired with (control). */
  truthArchetype: string;
}
interface Persona {
  archetype: string;
  repaint: string;
}

interface Block {
  props: Record<string, unknown> & { target?: { archetype: string } };
}

/**
 * ─── WHY A "TRIAL" AND NOT JUST A TOPIC ───────────────────────────────────────
 *
 * A trial = one judge call = N cards matched 1:1 against the N-person cast.
 *
 * For a SHELF skill (hooks, ideas) one pipeline run emits all N cards, so a trial is ONE topic and
 * the arms are: calibrated (each card assigned a person) vs General (cards written for nobody, then
 * paired with the personas positionally — meaningless by construction).
 *
 * SCRIPT CANNOT WORK THAT WAY, and the reason is worth stating because it nearly produced a bogus
 * control. Script emits ONE card per run (D-02) and generation is deterministic (temperature 0,
 * fixed seed) — so five General runs on one topic return five IDENTICAL scripts. A judge matching
 * five identical cards scores chance by construction, which looks like a healthy control and in fact
 * measures nothing at all.
 *
 * So a script trial spans N topics, and BOTH arms pair topic i with person i:
 *   TREATMENT  script(topic_i, calibrated, targeting person_i)
 *   CONTROL    script(topic_i, General)  — then LABELLED person_i, a pairing with no basis
 * The judge's task is then identical in both arms, and any topic↔person phantom (e.g. an AI-ish
 * topic smelling like `cross_niche_curiosity`) appears in BOTH and subtracts out. This control is
 * deliberately CONSERVATIVE — it hands the judge more spurious signal than a same-topic control
 * would, so it biases against claiming success, which is the safe direction to be wrong in.
 *
 * `count` MUST equal the cast size — it is the denominator of chance (hooks 5 → 20%, ideas 4 → 25%).
 *
 * `face` is what the judge is shown, and choosing it is a real decision: show too little and a real
 * effect hides (a false negative costs as much as a false positive); show the archetype and you have
 * measured nothing. The rule: show exactly what the CARD shows a user, and nothing else.
 */
interface Skill {
  count: number;
  unit: string;
  /** How many topics one judge call consumes. 1 for a shelf skill; `count` for a one-card skill. */
  topicsPerTrial: number;
  /** How many judge calls to run. */
  trials: number;
  /** Produce one trial's cards. `treatment` decides whether the persona is actually assigned. */
  cards: (args: {
    topics: string[];
    audience: unknown;
    personas: Persona[];
    treatment: boolean;
  }) => Promise<{ units: Unit[]; generated: number }>;
}

/** Shelf skills (hooks, ideas): ONE run per trial emits the whole shelf. */
function shelfSkill(
  count: number,
  unit: string,
  run: (topic: string, audience: unknown, targetArchetype?: string) => Promise<{ blocks: Block[] }>,
  face: (props: Record<string, unknown>) => string,
): Skill {
  return {
    count,
    unit,
    topicsPerTrial: 1,
    trials: 6, // frozen at 6 so the hooks number stays comparable to #299
    cards: async ({ topics, audience, personas, treatment }) => {
      const { blocks } = await run(topics[0]!, audience);
      if (treatment) {
        // Ground truth = who the model SAID it wrote for, validated by the runner's binding.
        const units = blocks
          .filter((b) => b.props.target)
          .map((b) => ({ text: face(b.props), truthArchetype: b.props.target!.archetype }));
        return { units, generated: blocks.length };
      }
      // CONTROL: written for NOBODY, paired positionally. Meaningless by construction.
      const units = blocks
        .slice(0, personas.length)
        .map((b, i) => ({ text: face(b.props), truthArchetype: personas[i]!.archetype }));
      return { units, generated: blocks.length };
    },
  };
}

const SKILLS: Record<string, Skill> = {
  hooks: shelfSkill(
    5,
    "TikTok hooks",
    (ask, audience) => runHooksPipeline({ ask, platform: "tiktok", profileRow: null, audience }),
    (p) => String(p.hookLine ?? ""),
  ),
  ideas: shelfSkill(
    4,
    "TikTok video ideas",
    // The idea's face is the CONCEPT, not its hook line. `seedHook` is DELIBERATELY excluded: it is
    // a hook, and judging ideas by their hook would measure hook-craft transfer, not idea-craft.
    (ask, audience) => runIdeasPipeline({ ask, platform: "tiktok", profileRow: null, audience }),
    (p) =>
      [`${String(p.title ?? "")} — ${String(p.angle ?? "")}`, String(p.take ?? "")]
        .filter((s) => s.trim().length > 1)
        .join(" | "),
  ),
  script: {
    count: 5,
    unit: "TikTok video scripts (5 beats each)",
    topicsPerTrial: 5, // one script per person, one topic each — see the note above
    trials: 3,         // 3 × (5 treatment + 5 control) = 30 script runs. n = 15 per arm.
    cards: async ({ topics, audience, personas, treatment }) => {
      const units: Unit[] = [];
      for (let i = 0; i < personas.length; i++) {
        const persona = personas[i]!;
        const { blocks } = await runScriptPipeline({
          ask: topics[i]!,
          platform: "tiktok",
          profileRow: null,
          audience,
          // The ONLY difference between the arms. Control writes for nobody, then gets labelled.
          ...(treatment ? { targetArchetype: persona.archetype } : {}),
        });
        const b = blocks[0];
        if (!b) continue;
        // Treatment truth = what the runner BOUND (so an ignored brief drops out rather than
        // scoring as a hit). Control truth = the meaningless positional label.
        if (treatment && !b.props.target) continue;
        units.push({
          // The script's face = its beats, as the card shows them. Beat LABELS are stripped:
          // "Hook/Setup/Turn/Payoff/CTA" are identical across every script and would only dilute.
          text: (b.props.beats as { content: string }[]).map((x) => x.content).join(" / "),
          truthArchetype: treatment ? b.props.target!.archetype : persona.archetype,
        });
      }
      return { units, generated: personas.length };
    },
  },
};

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
 * The blind judge. Sees the cards (shuffled) + persona descriptions. Does NOT see the assignment,
 * the archetype slugs on the cards, the topic arm, or which arm it is judging.
 */
async function judge(
  units: Unit[],
  personas: Persona[],
  unitLabel: string,
  dump: string[],
): Promise<Map<string, string>> {
  const shuffled = seededShuffle(units, 1234);
  const cardList = shuffled.map((h, i) => `C${i + 1}. ${h.text}`).join("\n");
  const personaList = personas.map((p) => `- ${p.archetype}: ${p.repaint}`).join("\n");

  const prompt = `Below are ${shuffled.length} ${unitLabel}, and ${personas.length} audience segments of one creator.

CARDS:
${cardList}

AUDIENCE SEGMENTS:
${personaList}

Each card was written for ONE specific segment. Match each card to the segment it was written for. Use each segment exactly once.

Respond ONLY with JSON: { "matches": [ { "card": "C1", "archetype": "<slug>" }, ... ] }`;

  dump.push(prompt);

  const ai = getQwenClient();
  const res = await ai.chat.completions.create({
    model: QWEN_REASONING_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a precise classifier. You are given cards and audience segments and must match them. Output JSON only.",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    seed: QWEN_SEED,
    enable_thinking: false,
  } as never);

  const raw = res.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as {
    matches?: { card?: string; hook?: string; archetype: string }[];
  };

  const guess = new Map<string, string>();
  for (const m of parsed.matches ?? []) {
    const idx = parseInt(String(m.card ?? m.hook ?? "").replace(/\D/g, ""), 10) - 1;
    const h = shuffled[idx];
    if (h) guess.set(h.text, String(m.archetype).trim().toLowerCase().replace(/[[\]]/g, ""));
  }
  return guess;
}

async function main() {
  const skillName = process.argv[2] ?? "hooks";
  const skill = SKILLS[skillName];
  if (!skill) {
    throw new Error(`Unknown skill "${skillName}". Use one of: ${Object.keys(SKILLS).join(", ")}`);
  }

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

  // The cast is deterministic and identical across topics — the same N people every run.
  const targets = selectPersonaTargets(zach, skill.count);
  const personas: Persona[] = targets.map((t: { archetype: string; repaint: string }) => ({
    archetype: t.archetype,
    repaint: t.repaint,
  }));

  const chance = 100 / personas.length;
  console.log(`SKILL: ${skillName}  (shelf = ${skill.count}, chance = ${chance.toFixed(1)}%)\n`);
  console.log("CAST (deterministic, slot-spread):");
  for (const p of personas) console.log(`  ${p.archetype.padEnd(24)} ${p.repaint}`);
  console.log();

  const dumps: string[] = [];
  const rows: { arm: string; correct: number; total: number }[] = [];

  // Optional trial cap — `... ideas 1` is the ~2min smoke that proves the binding lives.
  const capArg = parseInt(process.argv[3] ?? "", 10);
  const trials = Number.isNaN(capArg) ? skill.trials : Math.max(1, capArg);

  for (let t = 0; t < trials; t++) {
    const topics = TOPICS.slice(t * skill.topicsPerTrial, (t + 1) * skill.topicsPerTrial);
    if (topics.length < skill.topicsPerTrial) {
      console.log(`  ⚠ trial ${t + 1}: not enough topics — stopping`);
      break;
    }
    const label = topics[0]!.slice(0, 32).padEnd(34);

    for (const arm of ["treatment", "control"] as const) {
      const treatment = arm === "treatment";
      const { units, generated } = await skill.cards({
        topics,
        audience: treatment ? zach : GENERAL_AUDIENCE,
        personas,
        treatment,
      });

      // THE BIND RATE — the proof the assignment ARRIVED. 0 ⇒ the feature is dead on the only path
      // that matters, and every number below it is noise. Printed BEFORE the score so the score can
      // never be read without it. (This is how the "[lurker]" silent-drop bug hid behind 3,600
      // green tests: the cards were generated, and every single one lost its target in the lookup.)
      if (treatment) {
        console.log(
          `  bind       ${label} ${units.length}/${generated} named a target` +
            (units.length === 0 ? "   🔴 BINDING DEAD — the score below is meaningless" : ""),
        );
      }

      if (units.length < personas.length) {
        console.log(`  ⚠ ${arm.padEnd(9)} ${label} only ${units.length} usable cards — skipped`);
        continue;
      }

      const guess = await judge(units, personas, skill.unit, dumps);
      const correct = units.filter((h) => guess.get(h.text) === h.truthArchetype).length;
      rows.push({ arm, correct, total: units.length });
      console.log(`  ${arm.padEnd(10)} ${label} ${correct}/${units.length}`);
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

  console.log(`\n═══════════════════ RESULT — ${skillName} ═══════════════════`);
  console.log(`  chance (1/${personas.length})                     ${chance.toFixed(1)}%`);
  console.log(
    `  CONTROL   (written for nobody)  ${C.c}/${C.t} = ${C.pct.toFixed(1)}%   ← the instrument's phantom rate`,
  );
  console.log(`  TREATMENT (written per-persona) ${T.c}/${T.t} = ${T.pct.toFixed(1)}%`);
  console.log("══════════════════════════════════════════════");
  console.log(
    T.pct > C.pct + 20
      ? `\n✅ The judge can tell WHO each ${skillName} card was written for. The differentiation is real.`
      : `\n🔴 The judge CANNOT reliably tell them apart. Per-persona ${skillName} does NOT work — say so, and do not ship it.`,
  );

  const dumpPath = resolve(tmpdir(), `${skillName}-targeting-judge-prompts.txt`);
  writeFileSync(dumpPath, dumps.join("\n\n" + "=".repeat(80) + "\n\n"));
  console.log(
    `\nJudge prompts dumped → ${dumpPath}  (verify the input ARRIVED before believing the output)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
