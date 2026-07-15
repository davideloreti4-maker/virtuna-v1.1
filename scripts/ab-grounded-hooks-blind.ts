/**
 * ab-grounded-hooks-blind.ts — THE DECISION GATE (handoff §3.1): does grounding make a BETTER hook?
 *
 * `ab-grounded-hooks.ts` answers this for ONE ask and prints both arms LABELLED to stdout. That is
 * enough to eyeball the mechanism, and not enough to decide anything: n=1, and the reader knows
 * which arm is which before reading a word. This script is the version whose answer we can trust.
 *
 * WHAT IT DOES DIFFERENTLY
 *
 * 1. N asks across DIFFERENT NICHES, each with its own matching creator profile. The structural
 *    thesis is precisely that a madlib transfers ACROSS subjects, so a single-niche test cannot
 *    observe the thing it claims. Profile matches ask — a fitness question asked by a
 *    founder-branding creator would be measuring incoherence, not grounding.
 *
 * 2. The arms are written UNLABELLED, in a per-ask randomized order, with the key at the bottom.
 *    The owner reads blind. We do not grade our own homework — the band score is our own Flash SIM,
 *    and using it to judge our own grounding is circular (handoff §3.1).
 *
 * 3. THE BLIND BODY PRINTS HOOK LINES ONLY. This is not squeamishness, it is the whole validity of
 *    the exercise — three fields would each hand the reader the answer for free:
 *      - `proof`     → only the grounded arm can cite a source. A dead giveaway.
 *      - `mechanism` → grounded leads with craft slugs ("Open Loop:", "Pattern Interrupt:") while
 *                      ungrounded emits prose (handoff §3.4). A dead giveaway.
 *      - `band`      → our own SIM's score. Not independent evidence, and it would anchor the read.
 *    All three are still captured, and printed in an appendix BELOW the key. Nothing is hidden;
 *    it is only sequenced so it cannot contaminate the judgement.
 *
 * 4. It ASSERTS THE WIRE (handoff lesson #2). `runHooksPipeline` returns NO grounding metadata, and
 *    the runner degrades to ungrounded on ANY failure — silently, by design. So a broken grounded
 *    arm is indistinguishable from a working one at the return value, and the experiment would
 *    "succeed" while comparing ungrounded to ungrounded. Before generating, each ask probes
 *    `retrieveCachedExamples` directly and records what came back. An ask that grounds on nothing is
 *    reported as VOID, not quietly judged.
 *
 * Run: npx tsx scripts/ab-grounded-hooks-blind.ts
 * Needs .env.local: DASHSCOPE_API_KEY + SUPABASE_SERVICE_ROLE_KEY (+ URL).
 * Cost: 2 real Qwen generations + 2 Flash SIM batch-rates per ask. No Apify (structural retrieval
 * has no floor → the cache read-back always satisfies `enough` → the live scrape never fires).
 */

import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync, writeFileSync } from "fs";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });

const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({
  baseUrl: resolve(__dirname, ".."),
  paths: tsconfig.compilerOptions.paths,
});

/* eslint-disable @typescript-eslint/no-require-imports */
const { runHooksPipeline } = require("@/lib/tools/runners/hooks-runner");
const { retrieveCachedExamples } = require("@/lib/grounding/retrieve");

// The escape hatch must be OFF or we would be A/B-ing the OLD topical path and calling it structural.
if (process.env.GROUNDING_HOOKS_RANK === "topical") {
  throw new Error("GROUNDING_HOOKS_RANK=topical is set — that reverts hooks to the pre-#297 path.");
}

const OUT_MD = resolve(__dirname, "../docs/AB-GROUNDING-3ARM-2026-07-14.md");
/** Raw dump lands OUTSIDE the repo — it is run residue, not an artifact worth committing. */
const OUT_JSON =
  process.env.AB_RAW_OUT ?? resolve(__dirname, "../../ab-grounding-3arm-raw.json");

/**
 * THE THREE ARMS.
 *
 * Run 1 (2-arm, docs/AB-GROUNDING-BLIND-2026-07-14.md) put GROUNDED next to UNGROUNDED and the
 * grounded arm looked worse: it drifted into the corpus's generic viral cadence, lost the creator's
 * voice, and sometimes produced shape-copied nonsense. But that arm was never a fair test of the
 * thesis. The thesis is "the reference is the STRUCTURE; the words come from the creator and their
 * audience" — and the prompt block was handing the model the source's VERBATIM line (`ran as: "…"`)
 * directly beneath the madlib, one line under a header that says "never the source's words".
 *
 * So run 1 conflated two things: grounding, and the surface leak riding along with it. This run
 * separates them.
 *
 *   ungrounded → no corpus at all. The baseline.
 *   verbatim   → grounded as it ships today: madlib + the real line. (Run 1's grounded arm.)
 *   structure  → grounded the way the thesis actually describes: madlib + archetype + why + receipt,
 *                and NO source line anywhere.
 *
 * The comparison that decides everything is structure-vs-ungrounded. verbatim is kept in as the
 * control that ties this run back to run 1 — drop it and we could not tell a real improvement from
 * a lucky re-roll.
 */
type Arm = "ungrounded" | "verbatim" | "structure";
const ARMS: Arm[] = ["ungrounded", "verbatim", "structure"];

// ─── The asks ────────────────────────────────────────────────────────────────
// Eight creators, eight niches. Each profile is a plausible real account, not a strawman: real
// wins/flops, a real voice, a real commercial goal. The niches are deliberately spread — two of
// them (fitness, cooking) are ones the corpus is KNOWN to contain, and several (skincare, careers,
// parenting) are ones it may not, because "does a madlib transfer to a niche the corpus never saw"
// is the actual claim under test.

interface Case {
  id: string;
  niche: string;
  ask: string;
  profile: Record<string, unknown>;
}

const CASES: Case[] = [
  {
    id: "founder-branding",
    niche: "founder personal branding",
    ask: "why founders should post daily even when it feels cringe",
    profile: {
      niche_primary: "founder personal branding",
      target_audience: "early-stage B2B SaaS founders, technical, allergic to marketing",
      primary_goal: "inbound leads for a fractional CMO offer",
      past_wins: ["a raw selfie video about firing a client did 400k", "pricing threads convert"],
      past_flops: ["polished b-roll flops", "long explainers underperform"],
      writing_voice_sample:
        "Direct, opinionated, plain-spoken. Short sentences. No hype, no emoji, no growth-hack cliches.",
    },
  },
  {
    id: "strength-coach",
    niche: "strength training",
    ask: "why lifting heavy 3x a week beats spending an hour on the treadmill",
    profile: {
      niche_primary: "strength training for beginners",
      target_audience: "men and women 30-45 who joined a gym and feel lost in the free-weight area",
      primary_goal: "sign-ups for an 8-week beginner barbell program",
      past_wins: ["a form-check video roasting my own old deadlift did 1.2M", "myth-busting lands"],
      past_flops: ["supplement talk tanks", "aesthetic physique clips feel like every other page"],
      writing_voice_sample:
        "Warm but blunt. Coach in a chalky gym, not an influencer. Explains the why. Zero shame, zero hype.",
    },
  },
  {
    id: "personal-finance",
    niche: "personal finance",
    ask: "why your emergency fund is the reason you are still broke",
    profile: {
      niche_primary: "personal finance for salaried millennials",
      target_audience: "28-40, decent salary, no assets, quietly ashamed of their bank balance",
      primary_goal: "email list for a paid budgeting course",
      past_wins: ["showing my real net worth spreadsheet went off", "counter-intuitive takes travel"],
      past_flops: ["generic 'save 10%' advice dies", "crypto content brings the wrong crowd"],
      writing_voice_sample:
        "Calm, specific, numbers on screen. Never condescending. Talks about money like a spreadsheet, not a sermon.",
    },
  },
  {
    id: "design-pricing",
    niche: "freelance design",
    ask: "how to raise your design retainer without losing the client",
    profile: {
      niche_primary: "freelance brand design",
      target_audience: "self-taught designers 2-5 years in, undercharging, scared of the pricing talk",
      primary_goal: "seats in a cohort on pricing and client management",
      past_wins: ["a teardown of a $500 logo vs a $15k identity", "screen-recorded client emails"],
      past_flops: ["portfolio reels get likes and no leads", "design-trend content is a treadmill"],
      writing_voice_sample:
        "Precise, a little dry, quietly confident. Shows the artifact. Hates 'hustle' framing.",
    },
  },
  {
    id: "home-cooking",
    niche: "cooking",
    ask: "why restaurant pasta tastes better than yours and it is not the recipe",
    profile: {
      niche_primary: "weeknight home cooking",
      target_audience: "people who can cook a bit but plateaued, cook for a partner or kids on weeknights",
      primary_goal: "sell a $19 technique ebook",
      past_wins: ["the video where I salted water wrong on purpose", "technique > recipe always wins"],
      past_flops: ["full recipe walkthroughs get saved and never watched", "aesthetic food p0rn flops"],
      writing_voice_sample:
        "Chatty, fast, hands-in-the-pan. Talks like a friend at your counter. Loves a 'you have been lied to'.",
    },
  },
  {
    id: "skincare",
    niche: "skincare",
    ask: "why your 10-step routine is making your skin worse",
    profile: {
      niche_primary: "evidence-based skincare",
      target_audience: "women 22-35 who bought into a big routine and broke out anyway",
      primary_goal: "affiliate revenue + a paid routine-audit product",
      past_wins: ["debunking a viral product did 800k", "ingredient-label reads perform"],
      past_flops: ["get-ready-with-me flops", "'my routine' videos feel interchangeable"],
      writing_voice_sample:
        "Clinical but kind. Cites the actual ingredient. Anti-hype, anti-fear-mongering. No 'girlies'.",
    },
  },
  {
    id: "career-switch",
    niche: "careers",
    ask: "why you keep getting rejected after the final interview",
    profile: {
      niche_primary: "career coaching for tech switchers",
      target_audience: "people 1-3 years into a career pivot, getting interviews, not getting offers",
      primary_goal: "1:1 coaching bookings",
      past_wins: ["reading a real rejection email line by line", "insider hiring-panel reveals"],
      past_flops: ["resume-template content attracts freebie hunters", "motivational content flops"],
      writing_voice_sample:
        "Straight-talking ex-hiring-manager. Tells you the thing nobody says to your face. Never cruel.",
    },
  },
  {
    id: "parenting",
    niche: "parenting",
    ask: "why your toddler melts down the second you get home from work",
    profile: {
      niche_primary: "toddler behaviour for working parents",
      target_audience: "working parents of 2-4 year olds, guilty, exhausted, googling at 11pm",
      primary_goal: "sell a short course on evening routines",
      past_wins: ["naming a behaviour parents thought was just theirs", "'this is normal' reframes"],
      past_flops: ["gentle-parenting scripts feel preachy", "day-in-the-life content underperforms"],
      writing_voice_sample:
        "Reassuring, evidence-led, never preachy. Names the feeling before the fix. Talks to tired people.",
    },
  },
];

/**
 * Which arm is shown as Set A / B / C, per case. Fixed (not random-at-runtime) so the key is stable
 * and this file is the single source of truth for it. Every row is a different permutation — a
 * predictable layout is a key the reader can guess after two cases, and then the blind is theatre.
 */
const LAYOUT: Arm[][] = [
  ["structure", "ungrounded", "verbatim"],
  ["ungrounded", "verbatim", "structure"],
  ["verbatim", "structure", "ungrounded"],
  ["structure", "verbatim", "ungrounded"],
  ["ungrounded", "structure", "verbatim"],
  ["verbatim", "ungrounded", "structure"],
  ["structure", "ungrounded", "verbatim"],
  ["ungrounded", "verbatim", "structure"],
];

const PLATFORM = "tiktok";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Block {
  props?: {
    hookLine?: string;
    mechanism?: string;
    band?: string;
    fraction?: string;
    proof?: { handle?: string | null; multiplier?: number | null; views?: number | null } | null;
  };
}

interface ArmResult {
  hooks: Array<{
    hookLine: string;
    mechanism: string;
    band: string;
    proof: string | null;
  }>;
  warnings: string[];
  ms: number;
}

interface Probe {
  examples: number;
  archetypes: number;
  rank: string;
  matched: number;
  good: number;
  enough: boolean;
  handles: string[];
  /** The SHAPES the grounded arm was shown. The structural thesis lives or dies on this spread. */
  archetypeNames: string[];
  error?: string;
}

// ─── Steps ───────────────────────────────────────────────────────────────────

/**
 * ASSERT THE WIRE. Ask the retrieval layer directly what the grounded arm is about to be fed.
 * `runHooksPipeline` cannot tell us: it returns no grounding metadata and swallows every grounding
 * failure into a silent ungrounded run. Without this probe a totally dead grounded arm produces a
 * clean-looking A/B of ungrounded-vs-ungrounded, and we would hand the owner noise to adjudicate.
 */
async function probe(c: Case): Promise<Probe> {
  try {
    const r = await retrieveCachedExamples({
      query: c.ask,
      platform: PLATFORM,
      skill: "hooks",
      niche: c.niche,
    });
    return {
      examples: r.examples.length,
      archetypes: r.stats.archetypes,
      rank: r.stats.rank,
      matched: r.stats.matched,
      good: r.stats.good,
      enough: r.enough,
      handles: r.examples.map((e: { handle?: string | null }) => e.handle ?? "?"),
      archetypeNames: r.examples.map(
        (e: { hookArchetype?: string | null }) => e.hookArchetype ?? "(unclassified)",
      ),
    };
  } catch (err) {
    return {
      examples: 0,
      archetypes: 0,
      rank: "(threw)",
      matched: 0,
      good: 0,
      enough: false,
      handles: [],
      archetypeNames: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function arm(c: Case, mode: Arm): Promise<ArmResult> {
  process.env.GROUNDING_HOOKS_ENABLED = mode === "ungrounded" ? "false" : "true";
  // Only `structure` suppresses the source's verbatim line. `verbatim` must reproduce today's
  // shipping behaviour exactly, so the flag is explicitly cleared rather than left as whatever the
  // previous arm set — a leaked env var between arms would silently make two arms the same arm.
  if (mode === "structure") process.env.GROUNDING_HOOKS_SURFACE = "structure";
  else delete process.env.GROUNDING_HOOKS_SURFACE;

  const t0 = process.hrtime.bigint();
  const res = await runHooksPipeline({
    ask: c.ask,
    platform: PLATFORM,
    profileRow: { id: `ab-${c.id}`, user_id: "ab-user", target_platforms: [PLATFORM], ...c.profile },
    audience: null, // no calibrated audience → no per-persona targeting → grounding is the ONLY variable
  });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;

  const hooks = (res.blocks as Block[]).map((b) => {
    const p = b.props ?? {};
    const proof = p.proof?.handle
      ? `@${p.proof.handle}${p.proof.multiplier ? ` · ${p.proof.multiplier}×` : ""}${p.proof.views ? ` · ${p.proof.views} views` : ""}`
      : null;
    return {
      hookLine: p.hookLine ?? "(no hookLine)",
      mechanism: String(p.mechanism ?? "").replace(/\s+/g, " "),
      band: p.band ? `${p.band} ${p.fraction ?? ""}`.trim() : "—",
      proof,
    };
  });
  return { hooks, warnings: res.warnings ?? [], ms };
}

// ─── Report ──────────────────────────────────────────────────────────────────

function bullets(hooks: ArmResult["hooks"]): string {
  if (hooks.length === 0) return "_(the run returned no hooks)_\n";
  return hooks.map((h, i) => `${i + 1}. ${h.hookLine}`).join("\n") + "\n";
}

function detail(label: string, r: ArmResult): string {
  const rows = r.hooks
    .map(
      (h, i) =>
        `${i + 1}. **${h.hookLine}**\n` +
        `   - band: ${h.band}\n` +
        `   - mechanism: ${h.mechanism || "—"}\n` +
        `   - source: ${h.proof ?? "_no source cited_"}`,
    )
    .join("\n");
  const warn = r.warnings.length ? `\n\n> ⚠️ warnings: ${r.warnings.join(" | ")}` : "";
  return `#### ${label}  ·  ${Math.round(r.ms / 1000)}s\n\n${rows}${warn}\n`;
}

/** Human-facing arm names, used ONLY below the key. */
const ARM_LABEL: Record<Arm, string> = {
  ungrounded: "ungrounded (no corpus)",
  verbatim: "GROUNDED — verbatim (ships today)",
  structure: "GROUNDED — structure-only (no source line)",
};

async function main(): Promise<void> {
  const results: Array<{
    c: Case;
    p: Probe;
    arms: Record<Arm, ArmResult>;
    layout: Arm[];
  }> = [];

  for (let i = 0; i < CASES.length; i++) {
    const c = CASES[i];
    console.log(`\n[${i + 1}/${CASES.length}] ${c.id} — "${c.ask}"`);

    const p = await probe(c);
    console.log(
      p.error
        ? `   probe: THREW — ${p.error}`
        : `   probe: ${p.examples} examples · ${p.archetypes} archetypes · rank=${p.rank} · ${p.good}/${p.matched} good · enough=${p.enough}`,
    );

    // AB_PROBE_ONLY=1 → validate the retrieval wire without paying for the generations. If the probe
    // is dead, the real run would produce a beautifully-formatted comparison of ungrounded vs
    // ungrounded, so this is the cheap check that must pass FIRST.
    if (process.env.AB_PROBE_ONLY === "1") continue;

    // Execution order is FIXED (ungrounded → verbatim → structure) and independent of the shuffled
    // presentation order. Ungrounded runs first so no grounded arm can be flattered by a warm prompt
    // cache laid down in its own favour.
    const arms = {} as Record<Arm, ArmResult>;
    for (const mode of ARMS) {
      console.log(`   running ${mode}…`);
      arms[mode] = await arm(c, mode);
    }
    console.log(
      `   → ` +
        ARMS.map(
          (m) =>
            `${m} ${arms[m].hooks.length}h${m !== "ungrounded" ? `/${arms[m].hooks.filter((h) => h.proof).length} cited` : ""}`,
        ).join(" · "),
    );

    results.push({ c, p, arms, layout: LAYOUT[i] });
  }

  // ── raw dump (outside the repo; the markdown below is the artifact) ──
  writeFileSync(OUT_JSON, JSON.stringify(results, null, 2));

  const void_ = results.filter((r) => r.p.examples === 0);
  const md: string[] = [];
  const SETS = ["A", "B", "C"];

  md.push(`# Hooks: ungrounded vs grounded vs structure-only — BLIND READ (3-arm)`);
  md.push(``);
  md.push(
    `**Run 1 (\`AB-GROUNDING-BLIND-2026-07-14.md\`) was not a fair test of the thesis, and this run ` +
      `explains why.** The thesis is *"the reference is the STRUCTURE; the words come from the creator ` +
      `and their audience."* But the prompt block hands the model the source's **verbatim line** ` +
      `(\`ran as: "…"\`) directly under the madlib — one line beneath a header that literally says ` +
      `*"Borrow the STRUCTURE, never the source's words."* So run 1 measured grounding **and** the ` +
      `surface leak riding along with it, together, and could not tell them apart.`,
  );
  md.push(``);
  md.push(`This run separates them. Three arms, same ask, same profile, same model:`);
  md.push(``);
  md.push(`- **no corpus at all** — the baseline;`);
  md.push(`- **grounded as it ships today** — madlib + the source's real line;`);
  md.push(`- **grounded as the thesis describes** — madlib + archetype + why + receipt, and **no source line anywhere**.`);
  md.push(``);
  md.push(`## How to read this`);
  md.push(``);
  md.push(
    `Each case shows **Set A**, **Set B** and **Set C**. **The mapping changes every case** — no set ` +
      `is consistently any arm. Key is at the bottom, below a spoiler gap. Read all eight, mark a ` +
      `winner per case on the scoring sheet, *then* scroll.`,
  );
  md.push(``);
  md.push(
    `**Only the hook lines are shown**, for the same reason as run 1: the source receipt (only a ` +
      `grounded arm can cite one), \`mechanism\` (grounded leads with craft slugs), and the band score ` +
      `(our own Flash SIM — circular, and it would anchor you) each announce the arm before you read a ` +
      `word. All three are in the appendix **below the key**. **The hook line is the deliverable; judge that.**`,
  );
  md.push(``);
  md.push(
    `> **The comparison that decides everything is structure-only vs ungrounded.** If structure-only ` +
      `wins, the thesis was right and we were sabotaging it with one line of prompt. If it still loses, ` +
      `the corpus does not belong in the writer's prompt at all — and that is the more important finding.`,
  );
  md.push(``);
  md.push(`---`);
  md.push(``);

  results.forEach((r, i) => {
    md.push(`## Case ${i + 1} — ${r.c.niche}`);
    md.push(``);
    md.push(`> **Ask:** _${r.c.ask}_`);
    md.push(`> **Creator:** ${r.c.profile.target_audience} · goal: ${r.c.profile.primary_goal}`);
    md.push(``);
    r.layout.forEach((mode, s) => {
      md.push(`**Set ${SETS[s]}**`);
      md.push(``);
      md.push(bullets(r.arms[mode].hooks));
    });
    md.push(`---`);
    md.push(``);
  });

  md.push(`## Scoring sheet`);
  md.push(``);
  md.push(`| case | niche | best set | worst set | notes |`);
  md.push(`|---|---|---|---|---|`);
  results.forEach((r, i) =>
    md.push(`| ${i + 1} | ${r.c.niche} | A / B / C | A / B / C |  |`),
  );
  md.push(``);
  md.push(`---`);
  md.push(``);
  md.push(`<br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br>`);
  md.push(``);
  md.push(`---`);
  md.push(``);
  md.push(`# 🔑 THE KEY — do not read until you have scored above`);
  md.push(``);
  md.push(`| case | niche | Set A | Set B | Set C |`);
  md.push(`|---|---|---|---|---|`);
  results.forEach((r, i) =>
    md.push(
      `| ${i + 1} | ${r.c.niche} | ${ARM_LABEL[r.layout[0]]} | ${ARM_LABEL[r.layout[1]]} | ${ARM_LABEL[r.layout[2]]} |`,
    ),
  );
  md.push(``);

  md.push(`## Did grounding actually engage?`);
  md.push(``);
  md.push(
    `The runner degrades to ungrounded on **any** grounding failure, silently and by design — so a ` +
      `dead grounded arm is indistinguishable from a working one at the return value. This is the ` +
      `independent probe of the retrieval layer, taken per case *before* generation. **A case with 0 ` +
      `examples is VOID** — all three of its arms are the same pipeline and must not be counted.`,
  );
  md.push(``);
  md.push(`| case | niche | examples fed | archetypes | rank | cited (verbatim) | cited (structure) |`);
  md.push(`|---|---|---|---|---|---|---|`);
  results.forEach((r, i) => {
    const cv = r.arms.verbatim.hooks.filter((h) => h.proof).length;
    const cs = r.arms.structure.hooks.filter((h) => h.proof).length;
    const flag = r.p.examples === 0 ? " 🔴 **VOID**" : "";
    md.push(
      `| ${i + 1} | ${r.c.niche} | ${r.p.examples}${flag} | ${r.p.archetypes} | ${r.p.rank} | ${cv}/${r.arms.verbatim.hooks.length} | ${cs}/${r.arms.structure.hooks.length} |`,
    );
  });
  md.push(``);
  md.push(
    void_.length > 0
      ? `> 🔴 **${void_.length} case(s) grounded on NOTHING** (${void_.map((r) => r.c.niche).join(", ")}). Exclude them.`
      : `> ✅ Every case retrieved real examples on the structural axis. Both grounded arms were genuinely fed a corpus block, and they differ from each other in exactly one way: whether the source's verbatim line was shown.`,
  );
  md.push(``);
  md.push(`---`);
  md.push(``);
  md.push(`# Appendix — full detail per arm`);
  md.push(``);
  md.push(`Everything withheld above: mechanism, band, and the source receipt. Now safe to read.`);
  md.push(``);
  results.forEach((r, i) => {
    md.push(`## Case ${i + 1} — ${r.c.niche}`);
    md.push(``);
    md.push(`> **Ask:** _${r.c.ask}_`);
    md.push(``);
    ARMS.forEach((mode) => {
      const set = SETS[r.layout.indexOf(mode)];
      md.push(detail(`${ARM_LABEL[mode]}  (Set ${set})`, r.arms[mode]));
      md.push(``);
    });
    if (r.p.handles.length) {
      const shown = r.p.handles.map((h, j) => `@${h} _(${r.p.archetypeNames[j] ?? "?"})_`).join(", ");
      md.push(`**Corpus rows both grounded arms were shown:** ${shown}`);
      md.push(``);
    }
    md.push(`---`);
    md.push(``);
  });

  writeFileSync(OUT_MD, md.join("\n"));

  console.log(`\n${"─".repeat(90)}`);
  console.log(`  wrote ${OUT_MD}`);
  console.log(`  raw   ${OUT_JSON}`);
  if (void_.length) console.log(`  🔴 ${void_.length} VOID case(s): ${void_.map((r) => r.c.id).join(", ")}`);
  console.log(`${"─".repeat(90)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
