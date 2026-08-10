/**
 * ab-adapt-ideas-script.ts — do the Phase 2 adapt briefs (ideas + script) hold up LIVE?
 *
 * The hooks briefer was A/B'd twice (docs/AB-GROUNDING-BRIEFER-2026-07-15.md, re-run through the
 * Stage A guards in docs/AB-GROUNDING-BRIEFER-2026-08-10-stage-a.md). The ideas and script adapt
 * paths — same machinery, per-skill fit measures (ideas: belief↔reality tension, subject-bound;
 * script: beat-arc completeness over the proven rhythm) — were built in Phase 2 and unit-tested,
 * but have NEVER produced live output. C0 flips their flags, so this measures them first.
 *
 * Two arms per skill per case, both on the REAL pipeline (nothing mocked):
 *   A · SLICE — GROUNDING_<SKILL>_ENABLED=true, ADAPT unset (what ships today)
 *   B · ADAPT — both on (the C0 candidate), plus a deterministic PEEK of the brief the
 *       writer consumed (dosage census, per-skill fit read, fallback surfaced not hidden)
 *
 * Asks + profiles are the cached 3-arm set (same as every prior grounding A/B) so the owner reads
 * one consistent probe family across all three skills. Output is LABELLED (design steering, not
 * blind grading).
 *
 * 🔴 The honest gate stays OPEN (unchanged from 07-15): craft-read is not a view signal.
 *
 * Run: node node_modules/tsx/dist/cli.mjs scripts/ab-adapt-ideas-script.ts
 *      (foreground, sandbox OFF — rtk silently drops DashScope/Supabase)
 * Needs .env.local: DASHSCOPE_API_KEY + SUPABASE_SERVICE_ROLE_KEY (+ URL).
 * Knobs: AB_LIMIT=n (cases), AB_SKILL=ideas|script (one skill only).
 */

import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync, writeFileSync } from "fs";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

/* eslint-disable @typescript-eslint/no-require-imports */
const { adaptCorpusBlock } = require("@/lib/grounding/adapt");
const { retrieveCachedExamples } = require("@/lib/grounding/retrieve");
const { runIdeasPipeline } = require("@/lib/tools/runners/ideas-runner");
const { runScriptPipeline } = require("@/lib/tools/runners/script-runner");

const PRIOR = process.env.AB_PRIOR ?? resolve(__dirname, "../../ab-grounding-3arm-raw.json");
// Per-skill output when AB_SKILL is set — the two skills run as separate foreground invocations
// (background + sandbox-off do not compose here; see the 07-15 handoff), and each must not
// clobber the other's artifact.
const SUFFIX = process.env.AB_SKILL ? `-${process.env.AB_SKILL}` : "";
const OUT_MD = resolve(__dirname, `../docs/AB-ADAPT-IDEAS-SCRIPT-2026-08-10${SUFFIX}.md`);
const OUT_JSON = resolve(__dirname, `../../ab-adapt-ideas-script-raw${SUFFIX}.json`);
const PLATFORM = "tiktok";
const CASES = Number(process.env.AB_LIMIT) > 0 ? Number(process.env.AB_LIMIT) : 4;

type SkillKey = "ideas" | "script";
const SKILLS: SkillKey[] =
  process.env.AB_SKILL === "ideas" ? ["ideas"] : process.env.AB_SKILL === "script" ? ["script"] : ["ideas", "script"];

interface PriorCase {
  c: { id: string; niche: string; ask: string; profile: Record<string, unknown> };
}

/** Mirror the runners' adaptProfile construction (same as ab-grounding-briefer.ts). */
function toAdaptProfile(profile: Record<string, unknown>) {
  const ta = profile.target_audience;
  const list = (v: unknown): string[] | null => {
    if (!Array.isArray(v) || v.length === 0) return null;
    const out = v
      .map((w) => (typeof w === "string" ? w : (w as { url?: string })?.url))
      .filter((s): s is string => Boolean(s && s.trim()));
    return out.length ? out : null;
  };
  return {
    niche_primary: (profile.niche_primary as string) ?? null,
    target_audience: typeof ta === "string" ? ta.trim() || null : null,
    primary_goal: (profile.primary_goal as string) ?? null,
    writing_voice_sample: (profile.writing_voice_sample as string) ?? null,
    past_wins: list(profile.past_wins),
    past_flops: list(profile.past_flops),
  };
}

interface Structure {
  n: number;
  dosage: string;
  fitted: string;
}

/** Parse the fitted+dosed brief back into per-structure verdicts (shared brief format). */
function parseBrief(corpus: string | undefined): { structures: Structure[]; fellBack: boolean } {
  if (!corpus) return { structures: [], fellBack: false };
  const structures: Structure[] = [];
  const re = /^(\d+)\.\s+\[(clone|swap|angle|none)\]\s+(.*)$/;
  for (const line of corpus.split("\n")) {
    const m = re.exec(line.trim());
    if (m) structures.push({ n: Number(m[1]), dosage: m[2], fitted: m[3].trim() });
  }
  return { structures, fellBack: structures.length === 0 };
}

function envFor(skill: SkillKey, adapt: boolean) {
  const key = skill.toUpperCase();
  process.env[`GROUNDING_${key}_ENABLED`] = "true";
  if (adapt) process.env[`GROUNDING_${key}_ADAPT`] = "true";
  else delete process.env[`GROUNDING_${key}_ADAPT`];
  delete process.env[`GROUNDING_${key}_SURFACE`];
}

interface Card {
  head: string;
  body: string[];
  proof: string | null;
}

interface Arm {
  cards: Card[];
  warnings: string[];
  ms: number;
}

function proofLine(p: { handle?: string | null; multiplier?: number | null; views?: number | null } | null | undefined): string | null {
  if (!p?.handle) return null;
  return `@${p.handle}${p.multiplier ? ` · ${p.multiplier}×` : ""}${p.views ? ` · ${p.views} views` : ""}`;
}

async function runArm(skill: SkillKey, pc: PriorCase, adapt: boolean): Promise<Arm> {
  envFor(skill, adapt);
  const inputBase = {
    ask: pc.c.ask,
    platform: PLATFORM,
    profileRow: {
      id: `abis-${pc.c.id}`,
      user_id: "abis-user",
      target_platforms: [PLATFORM],
      ...pc.c.profile,
    },
    audience: null,
  };
  const t0 = process.hrtime.bigint();
  const res =
    skill === "ideas" ? await runIdeasPipeline(inputBase) : await runScriptPipeline(inputBase);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;

  interface AnyBlock {
    props?: Record<string, unknown> & {
      proof?: { handle?: string | null; multiplier?: number | null; views?: number | null } | null;
    };
  }
  const cards: Card[] = (res.blocks as AnyBlock[]).map((b) => {
    const p = b.props ?? {};
    if (skill === "ideas") {
      return {
        head: String(p.title ?? "(no title)"),
        body: [
          `angle: ${String(p.angle ?? "")}`,
          `seed hook: ${String(p.seedHook ?? "")}`,
        ],
        proof: proofLine(p.proof),
      };
    }
    const beats = Array.isArray(p.beats) ? (p.beats as Array<{ label?: string; content?: string }>) : [];
    return {
      head: String(p.openingBeatSeed ?? "(no opening seed)"),
      body: beats.map((bt) => `${bt.label ?? "?"}: ${bt.content ?? ""}`),
      proof: proofLine(p.proof),
    };
  });
  return { cards, warnings: res.warnings ?? [], ms };
}

async function peekBrief(skill: SkillKey, pc: PriorCase) {
  const retrieved = await retrieveCachedExamples({
    query: pc.c.ask,
    platform: PLATFORM,
    skill,
    niche: pc.c.niche,
  });
  if (retrieved.examples.length === 0) return { retrieved: 0, brief: undefined, structures: [], fellBack: false };
  const block = await adaptCorpusBlock({
    skill,
    ask: pc.c.ask,
    niche: pc.c.niche,
    platform: PLATFORM,
    profile: toAdaptProfile(pc.c.profile),
    examples: retrieved.examples,
  });
  const parsed = parseBrief(block.corpus);
  return { retrieved: retrieved.examples.length, brief: block.corpus, ...parsed };
}

function renderCards(cards: Card[]): string {
  if (!cards.length) return "_(no cards)_\n";
  return (
    cards
      .map(
        (c, i) =>
          `${i + 1}. **${c.head}**\n${c.body.map((l) => `   - ${l}`).join("\n")}${c.proof ? `\n   - ⤷ _source: ${c.proof}_` : ""}`,
      )
      .join("\n") + "\n"
  );
}

async function main(): Promise<void> {
  const prior: PriorCase[] = JSON.parse(readFileSync(PRIOR, "utf-8")).slice(0, CASES);

  interface CaseResult {
    id: string;
    niche: string;
    ask: string;
    skill: SkillKey;
    retrieved: number;
    fellBack: boolean;
    structures: Structure[];
    brief: string | undefined;
    slice: Arm;
    adapt: Arm;
  }
  const results: CaseResult[] = [];

  for (const pc of prior) {
    for (const skill of SKILLS) {
      console.log(`\n[${pc.c.id} · ${skill}] "${pc.c.ask}"`);

      const peek = await peekBrief(skill, pc);
      const dz = peek.structures.reduce((m: Record<string, number>, s) => {
        m[s.dosage] = (m[s.dosage] || 0) + 1;
        return m;
      }, {});
      console.log(
        peek.retrieved === 0
          ? `   probe: 🔴 VOID — retrieved 0`
          : peek.fellBack
            ? `   brief: ⚠️ FELL BACK to raw slice (${peek.retrieved} retrieved)`
            : `   brief: ${peek.structures.length}/${peek.retrieved} kept · dosage ${JSON.stringify(dz)}`,
      );

      console.log(`   running SLICE arm (adapt off)…`);
      const slice = await runArm(skill, pc, false);
      console.log(`   → ${slice.cards.length} cards · ${slice.cards.filter((c) => c.proof).length} cited · ${Math.round(slice.ms / 1000)}s`);
      console.log(`   running ADAPT arm (adapt on)…`);
      const adapt = await runArm(skill, pc, true);
      console.log(`   → ${adapt.cards.length} cards · ${adapt.cards.filter((c) => c.proof).length} cited · ${Math.round(adapt.ms / 1000)}s`);

      results.push({
        id: pc.c.id,
        niche: pc.c.niche,
        ask: pc.c.ask,
        skill,
        retrieved: peek.retrieved,
        fellBack: peek.fellBack,
        structures: peek.structures,
        brief: peek.brief,
        slice,
        adapt,
      });
    }
  }

  writeFileSync(OUT_JSON, JSON.stringify(results, null, 2));

  const md: string[] = [];
  md.push(`# Phase 2 adapt briefs LIVE — ideas + script, slice arm vs adapt arm (LABELLED)`);
  md.push(``);
  md.push(
    `The hooks briefer is measured (07-15 + the 08-10 Stage A re-run). These two skills share the ` +
      `machinery but have their OWN fit measures — ideas: a belief↔reality TENSION bound to the ` +
      `creator's subject; script: a BEAT ARC over the proven rhythm — and had never produced live ` +
      `output. Both arms are the real pipeline; only the corpus CONTENT differs.`,
  );
  md.push(``);
  md.push(`> 🔴 **The honest gate stays open** — craft-read is not a view signal (unchanged from 07-15).`);
  md.push(``);
  md.push(`---`);
  md.push(``);

  for (const r of results) {
    md.push(`## ${r.niche} · **${r.skill}**`);
    md.push(``);
    md.push(`> **Ask:** _${r.ask}_`);
    md.push(``);
    md.push(`**① SLICE — grounding as it ships today**`);
    md.push(``);
    md.push(renderCards(r.slice.cards));
    md.push(`**② ADAPT — the fitted+dosed brief** _(C0 candidate)_`);
    md.push(``);
    md.push(renderCards(r.adapt.cards));
    if (r.retrieved === 0) md.push(`> 🔴 **VOID** — retrieved 0; both arms degraded to ungrounded.`);
    else if (r.fellBack) md.push(`> ⚠️ The adapt stage **fell back to the raw slice** (kept 0 structures).`);
    else {
      md.push(`<details><summary>the fitted brief the writer consumed (${r.structures.length} structures)</summary>\n`);
      md.push("```");
      md.push(r.brief ?? "");
      md.push("```");
      md.push(`</details>`);
    }
    const warn = [...r.slice.warnings, ...r.adapt.warnings];
    if (warn.length) md.push(`\n⚠️ warnings: ${warn.join(" · ")}`);
    md.push(``);
    md.push(`---`);
    md.push(``);
  }

  md.push(`## Wire check — engagement + receipts, per case`);
  md.push(``);
  md.push(`| case | skill | retrieved | kept | fell back | slice cards (cited) | adapt cards (cited) | slice s | adapt s |`);
  md.push(`|---|---|---|---|---|---|---|---|---|`);
  for (const r of results) {
    const cited = (a: Arm) => `${a.cards.length} (${a.cards.filter((c) => c.proof).length})`;
    md.push(
      `| ${r.niche} | ${r.skill} | ${r.retrieved}${r.retrieved === 0 ? " 🔴" : ""} | ${r.structures.length} | ${r.fellBack ? "yes ⚠️" : "no"} | ${cited(r.slice)} | ${cited(r.adapt)} | ${Math.round(r.slice.ms / 1000)} | ${Math.round(r.adapt.ms / 1000)} |`,
    );
  }
  md.push(``);

  const census: Record<string, number> = {};
  results.forEach((r) => r.structures.forEach((s) => (census[s.dosage] = (census[s.dosage] || 0) + 1)));
  md.push(`Dosage census across kept structures: ${JSON.stringify(census)}`);
  md.push(``);

  writeFileSync(OUT_MD, md.join("\n"));
  console.log(`\n${"─".repeat(90)}`);
  console.log(`  wrote ${OUT_MD}`);
  console.log(`  raw   ${OUT_JSON}`);
  console.log(`  dosage census: ${JSON.stringify(census)}`);
  console.log(`${"─".repeat(90)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
