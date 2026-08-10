/**
 * ab-judge.ts — does the C1 checkable-judge earn its flash call LIVE?
 *
 * Runs the C0-candidate config (GROUNDING_<SKILL>_ENABLED + _ADAPT) with ENGINE_JUDGE_<SKILL>
 * ON, through the REAL pipeline (nothing mocked), on the same cached probe family as every
 * prior grounding A/B. Generation is temp-0/seed-7, so each case reproduces its committed
 * evidence run (docs/AB-ADAPT-IDEAS-SCRIPT-2026-08-10-*.md) byte-for-byte — which means:
 *
 *   - case 1 · script (founder personal branding) REPRODUCES the measured failure (a Turn
 *     beat carrying compiled.ts's template verbatim, unfilled [slots] and all, plus a
 *     thesis inversion) — the judge must catch it live, and the revise outcome is the result
 *   - every other case reproduced CLEAN — any check that fires there is a FALSE POSITIVE,
 *     the exact failure mode that killed the S5 rubric critic (~100% taste misfires)
 *   - the latency delta vs the evidence docs' "adapt s" column is the judge's real cost
 *
 * 🔴 The honest gate stays OPEN (unchanged from 07-15): craft-read is not a view signal.
 *
 * Run: node node_modules/tsx/dist/cli.mjs scripts/ab-judge.ts
 *      (foreground, sandbox OFF — rtk silently drops DashScope/Supabase)
 * Needs .env.local: DASHSCOPE_API_KEY + SUPABASE_SERVICE_ROLE_KEY (+ URL).
 * Knobs: AB_LIMIT=n (cases), AB_SKILL=hooks|ideas|script (one skill only).
 */

import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync, writeFileSync } from "fs";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

/* eslint-disable @typescript-eslint/no-require-imports */
const { runHooksPipeline } = require("@/lib/tools/runners/hooks-runner");
const { runIdeasPipeline } = require("@/lib/tools/runners/ideas-runner");
const { runScriptPipeline } = require("@/lib/tools/runners/script-runner");

const PRIOR = process.env.AB_PRIOR ?? resolve(__dirname, "../../ab-grounding-3arm-raw.json");
// Per-skill output when AB_SKILL is set — sequential per-skill invocations must not clobber
// each other's artifact (the exact 08-10 trap: an un-suffixed OUT path overwrote per-run).
const SUFFIX = process.env.AB_SKILL ? `-${process.env.AB_SKILL}` : "";
const OUT_MD = resolve(__dirname, `../docs/AB-JUDGE-2026-08-10${SUFFIX}.md`);
const OUT_JSON = resolve(__dirname, `../../ab-judge-raw${SUFFIX}.json`);
const PLATFORM = "tiktok";
const CASES = Number(process.env.AB_LIMIT) > 0 ? Number(process.env.AB_LIMIT) : 4;

type SkillKey = "hooks" | "ideas" | "script";
const ALL_SKILLS: SkillKey[] = ["hooks", "ideas", "script"];
const SKILLS: SkillKey[] = ALL_SKILLS.includes(process.env.AB_SKILL as SkillKey)
  ? [process.env.AB_SKILL as SkillKey]
  : ALL_SKILLS;

interface PriorCase {
  c: { id: string; niche: string; ask: string; profile: Record<string, unknown> };
}

function envFor(skill: SkillKey) {
  for (const s of ALL_SKILLS) {
    const key = s.toUpperCase();
    const on = s === skill;
    for (const flag of [`GROUNDING_${key}_ENABLED`, `GROUNDING_${key}_ADAPT`, `ENGINE_JUDGE_${key}`]) {
      if (on) process.env[flag] = "true";
      else delete process.env[flag];
    }
    delete process.env[`GROUNDING_${key}_SURFACE`];
  }
}

interface RunRead {
  cards: number;
  heads: string[];
  /** script only — the Turn beat that actually shipped (the measured leak site). */
  turn: string | null;
  cited: number;
  warnings: string[];
  judgeTrace: string[];
  ms: number;
}

async function runCase(skill: SkillKey, pc: PriorCase): Promise<RunRead> {
  envFor(skill);
  const input = {
    ask: pc.c.ask,
    platform: PLATFORM,
    profileRow: {
      id: `abj-${pc.c.id}`,
      user_id: "abj-user",
      target_platforms: [PLATFORM],
      ...pc.c.profile,
    },
    audience: null,
  };
  const t0 = process.hrtime.bigint();
  const res =
    skill === "hooks"
      ? await runHooksPipeline(input)
      : skill === "ideas"
        ? await runIdeasPipeline(input)
        : await runScriptPipeline(input);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;

  interface AnyBlock {
    props?: Record<string, unknown> & {
      beats?: Array<{ label?: string; content?: string }>;
      proof?: unknown;
    };
  }
  const blocks = res.blocks as AnyBlock[];
  const heads = blocks.map((b) => {
    const p = b.props ?? {};
    return String(p.hookLine ?? p.title ?? p.openingBeatSeed ?? "(?)");
  });
  const turn =
    skill === "script"
      ? (blocks[0]?.props?.beats?.find((bt) => bt.label === "Turn")?.content ?? null)
      : null;
  return {
    cards: blocks.length,
    heads,
    turn,
    cited: blocks.filter((b) => b.props?.proof).length,
    warnings: res.warnings ?? [],
    judgeTrace: res.judgeTrace ?? [],
    ms,
  };
}

async function main(): Promise<void> {
  const prior: PriorCase[] = JSON.parse(readFileSync(PRIOR, "utf-8")).slice(0, CASES);

  interface CaseResult {
    id: string;
    niche: string;
    ask: string;
    skill: SkillKey;
    run: RunRead;
  }
  const results: CaseResult[] = [];

  for (const pc of prior) {
    for (const skill of SKILLS) {
      console.log(`\n[${pc.c.id} · ${skill}] "${pc.c.ask}"`);
      const run = await runCase(skill, pc);
      const fired = run.judgeTrace.length > 0;
      console.log(
        `   → ${run.cards} cards · ${run.cited} cited · ${Math.round(run.ms / 1000)}s · ` +
          (fired ? `judge: ${run.judgeTrace.join(" | ")}` : "judge: no checks fired"),
      );
      if (run.warnings.length) console.log(`   ⚠️ ${run.warnings.join(" · ")}`);
      results.push({ id: pc.c.id, niche: pc.c.niche, ask: pc.c.ask, skill, run });
    }
  }

  writeFileSync(OUT_JSON, JSON.stringify(results, null, 2));

  const md: string[] = [];
  md.push(`# C1 checkable-judge LIVE — adapt config + judge ON, per skill (LABELLED)`);
  md.push(``);
  md.push(
    `Same probe family as every grounding A/B; generation is temp-0/seed-7, so each case ` +
      `reproduces its committed 08-10 adapt-arm run — case 1 · script reproduces the MEASURED ` +
      `failure (verbatim template Turn with unfilled [slots] + thesis inversion), and any check ` +
      `firing on the other, clean, cases is a FALSE POSITIVE (the S5 rubric-critic failure mode). ` +
      `Latency compares against the evidence docs' "adapt s" column (same config minus the judge).`,
  );
  md.push(``);
  md.push(`> 🔴 **The honest gate stays open** — craft-read is not a view signal (unchanged from 07-15).`);
  md.push(``);
  md.push(`## Wire read — checks fired · outcome · cost, per case`);
  md.push(``);
  md.push(`| case | skill | cards (cited) | checks fired | revise | warnings shipped | s |`);
  md.push(`|---|---|---|---|---|---|---|`);
  for (const r of results) {
    const t = r.run.judgeTrace;
    const checks = t.filter((e) => e.startsWith("check:"));
    const revise = t.includes("revise:accepted")
      ? "accepted ✅"
      : t.includes("revise:rejected")
        ? "rejected → degrade"
        : "—";
    const unavailable = t.includes("judge:unavailable") ? " (judge UNAVAILABLE)" : "";
    md.push(
      `| ${r.niche} | ${r.skill} | ${r.run.cards} (${r.run.cited}) | ${checks.length ? checks.join("<br>") : "none"}${unavailable} | ${revise} | ${r.run.warnings.length ? r.run.warnings.join("<br>") : "none"} | ${Math.round(r.run.ms / 1000)} |`,
    );
  }
  md.push(``);
  md.push(`---`);
  md.push(``);
  for (const r of results.filter((x) => x.run.judgeTrace.length > 0 || x.run.warnings.length > 0)) {
    md.push(`## ${r.niche} · **${r.skill}** — the judged run in full`);
    md.push(``);
    md.push(`> **Ask:** _${r.ask}_`);
    md.push(``);
    md.push(`- trace: \`${r.run.judgeTrace.join(" | ")}\``);
    if (r.run.turn !== null) md.push(`- shipped Turn beat: **${r.run.turn}**`);
    md.push(`- cards: ${r.run.heads.map((h) => `“${h}”`).join(" · ")}`);
    if (r.run.warnings.length) md.push(`- ⚠️ shipped warnings: ${r.run.warnings.join(" · ")}`);
    md.push(``);
  }

  writeFileSync(OUT_MD, md.join("\n"));
  console.log(`\n${"─".repeat(90)}`);
  console.log(`  wrote ${OUT_MD}`);
  console.log(`  raw   ${OUT_JSON}`);
  console.log(`${"─".repeat(90)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
