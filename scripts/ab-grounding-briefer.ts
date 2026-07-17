/**
 * ab-grounding-briefer.ts — does the PROMOTED adapt-as-briefer (src/lib/grounding/adapt.ts) hold up?
 *
 * The prototype (scripts/proto-adapt-hooks.ts) proved the direction: full anatomy + a dosage knob
 * beats the blind transplant. But the prototype was the WRITER — it emitted the final hooks itself,
 * bypassing the runner's SIM gate, per-persona ASSIGNMENT, and sourceIndex→receipt link. Phase 1
 * promoted it to a BRIEFER: the adapt stage emits a fitted+dosed brief, and the EXISTING hooks writer
 * consumes it. This harness confirms the promotion did not regress the prototype's qualities, on the
 * REAL production path — nothing here is mocked.
 *
 * WHAT EACH CASE DOES
 *   1. PEEK (deterministic, temp0+seed): retrieve → adaptCorpusBlock → capture the brief the writer
 *      will consume. Parse its per-structure DOSAGE tags (clone/swap/angle; 'none' is dropped) and
 *      word-count each FITTED line (the briefer's own ≤20-word hook norm). If the brief carries no dosage
 *      tags, the adapt stage FELL BACK to the raw slice — surfaced, not hidden.
 *   2. REMIX RUN: GROUNDING_HOOKS_ENABLED=true + GROUNDING_HOOKS_ADAPT=true → runHooksPipeline. This
 *      is the actual writer, over the actual brief (the runner re-adapts internally; temp0+seed makes
 *      it byte-identical to the peek), producing final hooks + their on-card source citations. This
 *      exercises the whole wiring the prototype skipped.
 *
 * The cold + transplant arms are the CACHED outputs from the 3-arm run (docs/AB-GROUNDING-3ARM) — same
 * asks, same profiles — so this costs 8 remix runs, not 24, and the comparison is apples-to-apples.
 * Output is LABELLED (the owner is steering the design, not blind-grading craft).
 *
 * 🔴 The honest gate stays OPEN: none of this is a VIEW signal. Dosage-varies + tight + re-voiced is
 * evidence the machine works as designed, NOT that it makes a hook that performs. Keep the flag off.
 *
 * Run: npx tsx scripts/ab-grounding-briefer.ts
 * Needs .env.local: DASHSCOPE_API_KEY + SUPABASE_SERVICE_ROLE_KEY (+ URL).
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
const { runHooksPipeline } = require("@/lib/tools/runners/hooks-runner");

if (process.env.GROUNDING_HOOKS_RANK === "topical") {
  throw new Error("GROUNDING_HOOKS_RANK=topical — that reverts hooks to the pre-#297 topical path.");
}

const PRIOR = process.env.AB_PRIOR ?? resolve(__dirname, "../../ab-grounding-3arm-raw.json");
const OUT_MD = resolve(__dirname, "../docs/AB-GROUNDING-BRIEFER-2026-07-15.md");
const OUT_JSON = resolve(__dirname, "../../ab-grounding-briefer-raw.json");
const PLATFORM = "tiktok";
/** HOOKS-only norm: a hook is one line, so length is the fit constraint. Ideas/script measure fit
 *  differently (tension-completeness / beat-arc) — see adapt.ts. */
const WORD_CAP = 20;

const words = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

interface CachedHook {
  hookLine: string;
  proof?: string | null;
}
interface PriorCase {
  c: { id: string; niche: string; ask: string; profile: Record<string, unknown> };
  arms: { ungrounded: { hooks: CachedHook[] }; verbatim: { hooks: CachedHook[] } };
}

/** Mirror hooks-runner's adaptProfile construction so the peek brief == the runner's internal brief. */
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
  over: boolean;
}

/** Parse the fitted+dosed brief back into its per-structure verdicts (for the census + word-cap). */
function parseBrief(corpus: string | undefined): { structures: Structure[]; fellBack: boolean } {
  if (!corpus) return { structures: [], fellBack: false };
  const structures: Structure[] = [];
  const re = /^(\d+)\.\s+\[(clone|swap|angle|none)\]\s+(.*)$/;
  for (const line of corpus.split("\n")) {
    const m = re.exec(line.trim());
    if (!m) continue;
    const fitted = m[3].trim();
    structures.push({ n: Number(m[1]), dosage: m[2], fitted, over: words(fitted) > WORD_CAP });
  }
  // A defined corpus with no dosage tags = adapt fell back to the raw per-skill slice.
  return { structures, fellBack: structures.length === 0 };
}

interface RemixArm {
  hooks: Array<{ hookLine: string; proof: string | null }>;
  warnings: string[];
  ms: number;
}

async function remixArm(pc: PriorCase): Promise<RemixArm> {
  process.env.GROUNDING_HOOKS_ENABLED = "true";
  process.env.GROUNDING_HOOKS_ADAPT = "true";
  delete process.env.GROUNDING_HOOKS_SURFACE; // briefer ignores it; keep the env clean

  const t0 = process.hrtime.bigint();
  const res = await runHooksPipeline({
    ask: pc.c.ask,
    platform: PLATFORM,
    profileRow: {
      id: `br-${pc.c.id}`,
      user_id: "br-user",
      target_platforms: [PLATFORM],
      ...pc.c.profile,
    },
    audience: null, // no calibrated audience → grounding is the only variable vs the cached arms
  });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;

  interface Block {
    props?: {
      hookLine?: string;
      proof?: { handle?: string | null; multiplier?: number | null; views?: number | null } | null;
    };
  }
  const hooks = (res.blocks as Block[]).map((b) => {
    const p = b.props ?? {};
    const proof = p.proof?.handle
      ? `@${p.proof.handle}${p.proof.multiplier ? ` · ${p.proof.multiplier}×` : ""}${p.proof.views ? ` · ${p.proof.views} views` : ""}`
      : null;
    return { hookLine: p.hookLine ?? "(no hookLine)", proof };
  });
  return { hooks, warnings: res.warnings ?? [], ms };
}

function lines(hooks: CachedHook[] | RemixArm["hooks"]): string {
  if (!hooks?.length) return "_(no hooks)_\n";
  return hooks.map((h, i) => `${i + 1}. ${h.hookLine}`).join("\n") + "\n";
}

async function main(): Promise<void> {
  let prior: PriorCase[] = JSON.parse(readFileSync(PRIOR, "utf-8"));
  // Smoke knobs: AB_LIMIT=1 runs one case; AB_PEEK_ONLY=1 skips the (expensive) runHooksPipeline arm
  // and only exercises retrieval + the adapt briefer. Both are for cheap live-wiring checks.
  const limit = Number(process.env.AB_LIMIT);
  if (Number.isFinite(limit) && limit > 0) prior = prior.slice(0, limit);
  const peekOnly = process.env.AB_PEEK_ONLY === "1";

  const results: Array<{
    id: string;
    niche: string;
    ask: string;
    retrieved: number;
    archetypes: number;
    fellBack: boolean;
    structures: Structure[];
    brief: string | undefined;
    ungrounded: CachedHook[];
    verbatim: CachedHook[];
    remix: RemixArm;
  }> = [];

  for (let i = 0; i < prior.length; i++) {
    const pc = prior[i];
    console.log(`\n[${i + 1}/${prior.length}] ${pc.c.id} — "${pc.c.ask}"`);

    // ── PEEK: build the exact brief the writer will consume ──
    const retrieved = await retrieveCachedExamples({
      query: pc.c.ask,
      platform: PLATFORM,
      skill: "hooks",
      niche: pc.c.niche,
    });
    let brief: string | undefined;
    let parsed = { structures: [] as Structure[], fellBack: false };
    if (retrieved.examples.length > 0) {
      const block = await adaptCorpusBlock({
        skill: "hooks",
        ask: pc.c.ask,
        niche: pc.c.niche,
        platform: PLATFORM,
        profile: toAdaptProfile(pc.c.profile),
        examples: retrieved.examples,
      });
      brief = block.corpus;
      parsed = parseBrief(block.corpus);
    }
    const dz = parsed.structures.reduce((m: Record<string, number>, s) => {
      m[s.dosage] = (m[s.dosage] || 0) + 1;
      return m;
    }, {});
    console.log(
      retrieved.examples.length === 0
        ? `   probe: 🔴 VOID — retrieved 0`
        : parsed.fellBack
          ? `   brief: ⚠️ FELL BACK to raw slice (${retrieved.examples.length} retrieved)`
          : `   brief: ${parsed.structures.length}/${retrieved.examples.length} kept · dosage ${JSON.stringify(dz)}`,
    );

    // ── REMIX RUN: the actual writer over the actual brief ──
    const remix: RemixArm = peekOnly
      ? { hooks: [], warnings: ["(peek-only: runHooksPipeline skipped)"], ms: 0 }
      : await (async () => {
          console.log(`   running remix arm (flags on)…`);
          const r = await remixArm(pc);
          const cited = r.hooks.filter((h) => h.proof).length;
          console.log(`   → ${r.hooks.length} hooks · ${cited} cited a source · ${Math.round(r.ms / 1000)}s`);
          return r;
        })();

    results.push({
      id: pc.c.id,
      niche: pc.c.niche,
      ask: pc.c.ask,
      retrieved: retrieved.examples.length,
      archetypes: retrieved.stats.archetypes,
      fellBack: parsed.fellBack,
      structures: parsed.structures,
      brief,
      ungrounded: pc.arms.ungrounded.hooks,
      verbatim: pc.arms.verbatim.hooks,
      remix,
    });
  }

  writeFileSync(OUT_JSON, JSON.stringify(results, null, 2));

  // ── Report ──
  const md: string[] = [];
  md.push(`# Grounding-as-remix, PROMOTED — briefer path vs the transplant vs cold (LABELLED)`);
  md.push(``);
  md.push(
    `The prototype proved full-anatomy + a dosage knob beats the blind transplant, but it was the ` +
      `WRITER. Phase 1 promoted it to a **briefer**: the adapt stage (\`src/lib/grounding/adapt.ts\`) ` +
      `emits a fitted+dosed brief, and the **existing hooks writer** consumes it — so the SIM gate, ` +
      `the sourceIndex→receipt link, and per-persona targeting all survive. This run is that real ` +
      `path, nothing mocked. Cold + transplant are the **cached** 3-arm outputs; only remix is new.`,
  );
  md.push(``);
  md.push(
    `> 🔴 **The honest gate is still open.** Dosage-varies + tight + re-voiced shows the machine works ` +
      `as designed — NOT that it makes a hook that gets more views. That needs a real outcome signal.`,
  );
  md.push(``);
  md.push(`---`);
  md.push(``);

  results.forEach((r, i) => {
    md.push(`## Case ${i + 1} — ${r.niche}`);
    md.push(``);
    md.push(`> **Ask:** _${r.ask}_`);
    md.push(``);
    md.push(`**① Cold — no library**`);
    md.push(``);
    md.push(lines(r.ungrounded));
    md.push(`**② Transplant — grounding as it shipped (raw slice)**`);
    md.push(``);
    md.push(lines(r.verbatim));
    md.push(`**③ Remix — the promoted briefer path** _(new)_`);
    md.push(``);
    md.push(
      r.remix.hooks.length
        ? r.remix.hooks
            .map((h, j) => `${j + 1}. ${h.hookLine}${h.proof ? `  \n    ⤷ _source: ${h.proof}_` : ""}`)
            .join("\n") + "\n"
        : "_(no hooks)_\n",
    );
    if (r.retrieved === 0) {
      md.push(`> 🔴 **VOID** — retrieved 0; the remix arm degraded to ungrounded.`);
    } else if (r.fellBack) {
      md.push(`> ⚠️ The adapt stage **fell back to the raw slice** (kept 0 structures).`);
    } else {
      md.push(`<details><summary>the fitted brief the writer consumed (${r.structures.length} structures)</summary>\n`);
      md.push("```");
      md.push(r.brief ?? "");
      md.push("```");
      md.push(`</details>`);
    }
    md.push(``);
    md.push(`---`);
    md.push(``);
  });

  // ── Dosage census (structure-level: does the dial actually vary?) ──
  const census: Record<string, number> = {};
  let totalStruct = 0;
  results.forEach((r) =>
    r.structures.forEach((s) => {
      census[s.dosage] = (census[s.dosage] || 0) + 1;
      totalStruct++;
    }),
  );
  md.push(`## Did the dosage knob vary? (structure-level, ${totalStruct} kept structures)`);
  md.push(``);
  md.push(`'none' is not shown here — a structure judged no-fit is DROPPED from the brief, not kept.`);
  md.push(``);
  md.push(`| dosage | count |`);
  md.push(`|---|---|`);
  md.push(`| clone | ${census.clone ?? 0} |`);
  md.push(`| swap | ${census.swap ?? 0} |`);
  md.push(`| angle | ${census.angle ?? 0} |`);
  md.push(``);

  // ── Word cap on the briefer's own fitted lines ──
  const allStruct = results.flatMap((r) => r.structures);
  const over = allStruct.filter((s) => s.over);
  md.push(`## Are the briefer's fitted lines tight? (≤ ${WORD_CAP} words)`);
  md.push(``);
  md.push(
    over.length === 0
      ? `✅ All ${allStruct.length} fitted lines are ${WORD_CAP} words or fewer.`
      : `⚠️ ${over.length}/${allStruct.length} fitted lines exceed ${WORD_CAP} words:\n\n${over
          .map((s) => `- (${words(s.fitted)}w) ${s.fitted}`)
          .join("\n")}`,
  );
  md.push(``);

  // ── Wire check: did the promoted path actually engage + attribute? ──
  md.push(`## Did grounding actually engage, per case?`);
  md.push(``);
  md.push(`| case | niche | retrieved | kept | fell back | remix hooks | cited a source |`);
  md.push(`|---|---|---|---|---|---|---|`);
  results.forEach((r, i) => {
    const cited = r.remix.hooks.filter((h) => h.proof).length;
    const flag = r.retrieved === 0 ? " 🔴" : r.fellBack ? " ⚠️" : "";
    md.push(
      `| ${i + 1} | ${r.niche} | ${r.retrieved}${flag} | ${r.structures.length} | ${r.fellBack ? "yes" : "no"} | ${r.remix.hooks.length} | ${cited}/${r.remix.hooks.length} |`,
    );
  });
  md.push(``);

  writeFileSync(OUT_MD, md.join("\n"));

  const voids = results.filter((r) => r.retrieved === 0).length;
  const fell = results.filter((r) => r.fellBack).length;
  console.log(`\n${"─".repeat(90)}`);
  console.log(`  wrote ${OUT_MD}`);
  console.log(`  raw   ${OUT_JSON}`);
  console.log(`  dosage census: ${JSON.stringify(census)} · over ${WORD_CAP}w: ${over.length}/${allStruct.length}`);
  if (voids) console.log(`  🔴 ${voids} VOID case(s)`);
  if (fell) console.log(`  ⚠️ ${fell} case(s) fell back to the raw slice`);
  console.log(`${"─".repeat(90)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
