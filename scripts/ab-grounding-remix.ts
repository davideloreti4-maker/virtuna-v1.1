/**
 * ab-grounding-remix.ts — does grounding-as-remix beat the blind transplant (and the baseline)?
 *
 * The 3-arm run (docs/AB-GROUNDING-3ARM-2026-07-14.md) showed today's grounding LOSING to writing
 * cold, because it fed the writer a clipped madlib and let it transplant blindly. This run adds the
 * arm that experiment never had: grounding-as-remix (scripts/proto-adapt-hooks.ts) — the full
 * decoded anatomy through a focused adapt stage with a per-hook dosage knob.
 *
 * To stay honest and cheap it REUSES the three cached arms from the prior run verbatim (same asks,
 * same profiles) and only generates the new remix arm — so the comparison is apples-to-apples and
 * costs 8 generations, not 32. Output is LABELLED (the owner is steering the design now, not blind-
 * grading), rendered to docs/AB-GROUNDING-REMIX-2026-07-15.md.
 *
 * Run: npx tsx scripts/ab-grounding-remix.ts
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
const { remixHooks, wordCount, HOOK_WORD_CAP } = require("./proto-adapt-hooks");

const PRIOR = process.env.AB_PRIOR ?? resolve(__dirname, "../../ab-grounding-3arm-raw.json");
const OUT_MD = resolve(__dirname, "../docs/AB-GROUNDING-REMIX-2026-07-15.md");
const OUT_JSON = resolve(__dirname, "../../ab-grounding-remix-raw.json");
const PLATFORM = "tiktok";

interface CachedHook { hookLine: string; mechanism?: string; band?: string; proof?: string | null; }
interface PriorCase {
  c: { id: string; niche: string; ask: string; profile: Record<string, unknown> };
  arms: { ungrounded: { hooks: CachedHook[] }; verbatim: { hooks: CachedHook[] } };
}

function lines(hooks: { hookLine?: string }[]): string {
  if (!hooks?.length) return "_(no hooks)_\n";
  return hooks.map((h, i) => `${i + 1}. ${h.hookLine ?? "(none)"}`).join("\n") + "\n";
}

async function main(): Promise<void> {
  const prior: PriorCase[] = JSON.parse(readFileSync(PRIOR, "utf-8"));
  const results: Array<{
    niche: string; ask: string;
    ungrounded: CachedHook[]; verbatim: CachedHook[];
    remix: Array<{ hookLine: string; sourceIndex: number; dosage: string; fitReason: string }>;
    exemplars: Array<{ handle: string | null; archetype: string | null }>;
  }> = [];

  for (let i = 0; i < prior.length; i++) {
    const pc = prior[i];
    console.log(`\n[${i + 1}/${prior.length}] ${pc.c.id} — "${pc.c.ask}"`);
    console.log(`   generating remix arm…`);
    const r = await remixHooks({
      ask: pc.c.ask,
      platform: PLATFORM,
      niche: (pc.c.profile.niche_primary as string) ?? null,
      profile: pc.c.profile,
    });
    const dz = r.hooks.reduce((m: Record<string, number>, h: { dosage: string }) => {
      m[h.dosage] = (m[h.dosage] || 0) + 1; return m;
    }, {});
    const over = r.hooks.filter((h: { hookLine: string }) => wordCount(h.hookLine) > HOOK_WORD_CAP).length;
    console.log(`   → ${r.hooks.length} hooks · dosage ${JSON.stringify(dz)} · over ${HOOK_WORD_CAP}w: ${over}`);
    results.push({
      niche: pc.c.niche, ask: pc.c.ask,
      ungrounded: pc.arms.ungrounded.hooks, verbatim: pc.arms.verbatim.hooks,
      remix: r.hooks,
      exemplars: r.exemplars.map((e: { handle: string | null; hookArchetype: string | null }) => ({
        handle: e.handle, archetype: e.hookArchetype,
      })),
    });
  }

  writeFileSync(OUT_JSON, JSON.stringify(results, null, 2));

  const md: string[] = [];
  md.push(`# Grounding-as-remix vs the transplant vs cold — LABELLED`);
  md.push(``);
  md.push(
    `The 3-arm run showed today's grounding (a blind transplant of a clipped madlib) **losing** to ` +
      `writing cold. This adds the arm it was missing: **grounding-as-remix** — the FULL decoded ` +
      `anatomy of each proven structure (beats, "when to use this", the belief↔reality tension, the ` +
      `unclipped why) through a focused adapt stage that picks, per hook, how hard to borrow ` +
      `(**clone / swap / angle / none**) and judges fit before using a structure.`,
  );
  md.push(``);
  md.push(`Same asks and profiles as before. Cold + transplant are the **cached** outputs from that run; only remix is new. Labelled — judge the approach.`);
  md.push(``);
  md.push(`---`);
  md.push(``);

  results.forEach((r, i) => {
    md.push(`## Case ${i + 1} — ${r.niche}`);
    md.push(``);
    md.push(`> **Ask:** _${r.ask}_`);
    md.push(``);
    md.push(`**① Cold — no library** _(won the last round)_`);
    md.push(``);
    md.push(lines(r.ungrounded));
    md.push(`**② Transplant — grounding as it ships today**`);
    md.push(``);
    md.push(lines(r.verbatim));
    md.push(`**③ Remix — full anatomy + dosage knob** _(new)_`);
    md.push(``);
    md.push(
      r.remix.length
        ? r.remix
            .map((h, j) => {
              const w = wordCount(h.hookLine);
              const flag = w > HOOK_WORD_CAP ? ` ⚠️${w}w` : "";
              return `${j + 1}. ${h.hookLine}${flag}  \n    ⤷ _${h.dosage}${h.sourceIndex ? ` from #${h.sourceIndex}` : ""} — ${h.fitReason}_`;
            })
            .join("\n") + "\n"
        : "_(no hooks)_\n",
    );
    md.push(`<sub>exemplars shown to remix: ${r.exemplars.map((e) => `@${e.handle} (${e.archetype})`).join(", ")}</sub>`);
    md.push(``);
    md.push(`---`);
    md.push(``);
  });

  // dosage census — does the model actually vary the dial, or clone everything?
  const census: Record<string, number> = {};
  let total = 0;
  results.forEach((r) => r.remix.forEach((h) => { census[h.dosage] = (census[h.dosage] || 0) + 1; total++; }));
  md.push(`## Did the dosage knob actually get used?`);
  md.push(``);
  md.push(`If remix cloned everything it would just be the transplant with extra steps. Spread across all ${total} remix hooks:`);
  md.push(``);
  md.push(`| dosage | count | what it means |`);
  md.push(`|---|---|---|`);
  md.push(`| clone | ${census.clone ?? 0} | a proven line already fit; swapped the subject |`);
  md.push(`| swap | ${census.swap ?? 0} | kept the structure, fresh line in the creator's voice |`);
  md.push(`| angle | ${census.angle ?? 0} | took only the idea, fully re-voiced |`);
  md.push(`| none | ${census.none ?? 0} | nothing fit — wrote original |`);
  md.push(``);

  const over = results.flatMap((r) => r.remix).filter((h) => wordCount(h.hookLine) > HOOK_WORD_CAP);
  const totalHooks = results.flatMap((r) => r.remix).length;
  md.push(`## Length — is the ≤ ${HOOK_WORD_CAP}-word cap holding?`);
  md.push(``);
  md.push(
    over.length === 0
      ? `✅ All ${totalHooks} remix hooks are ${HOOK_WORD_CAP} words or fewer. No two-sentence sprawl, no spelled-out enumerations.`
      : `⚠️ ${over.length}/${totalHooks} hooks still exceed ${HOOK_WORD_CAP} words:\n\n${over.map((h) => `- (${wordCount(h.hookLine)}w) ${h.hookLine}`).join("\n")}`,
  );
  md.push(``);

  writeFileSync(OUT_MD, md.join("\n"));
  console.log(
    `\n${"─".repeat(80)}\n  wrote ${OUT_MD}\n  dosage: ${JSON.stringify(census)}\n  over ${HOOK_WORD_CAP}w: ${over.length}/${totalHooks}\n${"─".repeat(80)}\n`,
  );
}

main().catch((e) => { console.error(e); process.exit(1); });
