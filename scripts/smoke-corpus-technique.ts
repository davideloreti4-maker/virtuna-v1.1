/**
 * smoke-corpus-technique.ts — LIVE proof that the first-frame TECHNIQUE axis reaches the corpus.
 *
 * What unit tests cannot prove here: everything below an injected `retrieve`. The technique filter
 * is a join against `teardown_collections` INSIDE the RPC, so only a real call proves the migration,
 * the backfill, the slug derivation and the wrapper params all line up.
 *
 * The specific failure this guards against is the one that motivated the whole axis: the corpus
 * shipped TWO taxonomies both called "visual hook", and only the STAGING one was ever promoted. So
 * asking for a technique used to silently answer from the setting. Case C below asserts they are
 * genuinely independent — filtering on a technique must NOT collapse to a setting filter.
 *
 * No model call — embed → RPC → warrant only. Cheap and deterministic.
 *
 * Run (FOREGROUND, sandbox OFF): npx tsx scripts/smoke-corpus-technique.ts
 * Needs .env.local: DASHSCOPE_API_KEY + SUPABASE_SERVICE_ROLE_KEY (+ URL).
 */

import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

/* eslint-disable @typescript-eslint/no-require-imports */
const { executeCorpusSearch } = require("@/lib/grounding/corpus-tool");
const { retrieveCachedExamples } = require("@/lib/grounding/retrieve");

interface Row {
  creator: string | null;
  visual_setting: string | null;
  hook_technique?: string;
  spoken_hook: string;
}

let failures = 0;
function check(label: string, ok: boolean, detail: string) {
  console.log(`${ok ? "  ✅" : "  ❌"} ${label} — ${detail}`);
  if (!ok) failures++;
}

async function search(args: Record<string, unknown>) {
  const res = await executeCorpusSearch(args, "tiktok", 1, retrieveCachedExamples);
  return JSON.parse(res.content) as {
    count: number;
    grounded: boolean;
    warrant: string;
    results: Row[];
  };
}

async function main() {
  console.log("\n── A. one named technique returns ONLY rows filed under it ──");
  {
    const p = await search({ query: "strong opening shot", hook_technique: "camera-whip", limit: 12 });
    const named = p.results.filter((r) => (r.hook_technique ?? "").includes("Camera Whip"));
    check("camera-whip", p.count > 0, `${p.count} rows`);
    check("every row carries the technique", named.length === p.count, `${named.length}/${p.count}`);
    console.log(`     e.g. @${p.results[0]?.creator} — "${p.results[0]?.spoken_hook?.slice(0, 60)}…"`);
  }

  console.log("\n── B. a FAMILY widens the net beyond any single technique ──");
  {
    const fam = await search({ query: "strong opening shot", hook_family: "subject-motion", limit: 12 });
    const one = await search({ query: "strong opening shot", hook_technique: "camera-whip", limit: 12 });
    check("subject-motion", fam.count > 0, `${fam.count} rows`);
    check("family ⊇ technique", fam.count >= one.count, `${fam.count} ≥ ${one.count}`);
    const kinds = new Set(fam.results.map((r) => r.hook_technique).filter(Boolean));
    check("spans several devices", kinds.size > 1, `${kinds.size} distinct: ${[...kinds].slice(0, 3).join(" · ")}`);
  }

  console.log("\n── C. 🔴 TECHNIQUE and SETTING are independent axes ──");
  {
    // The regression that motivated this work: if the technique filter were secretly the setting
    // filter, these rows would all share one staging value. They must not.
    const p = await search({ query: "opening shot", hook_family: "subject-motion", limit: 12 });
    const settings = new Set(p.results.map((r) => r.visual_setting).filter(Boolean));
    check(
      "one technique family spans MULTIPLE settings",
      settings.size > 1,
      `${settings.size} settings: ${[...settings].join(" · ")}`,
    );

    // And the converse: a setting filter must not constrain the technique.
    const g = await search({ query: "opening shot", visual_setting: "greenscreen", limit: 12 });
    const allGreen = g.results.every((r) => r.visual_setting === "greenscreen");
    check("setting filter still works unchanged", allGreen && g.count > 0, `${g.count} rows, all greenscreen`);
  }

  console.log("\n── D. an uncatalogued row OMITS the field (absent ≠ 'no visual hook') ──");
  {
    const p = await search({ query: "high protein breakfast", limit: 12 });
    const withField = p.results.filter((r) => "hook_technique" in r).length;
    check(
      "unfiltered search mixes catalogued + uncatalogued",
      withField < p.count,
      `${withField}/${p.count} catalogued — the rest omit the key entirely`,
    );
  }

  console.log("\n── E. a real technique + an absurd subject is still honestly UNGROUNDED ──");
  {
    // The technique filter must not become a backdoor to grounding: constraining on a device says
    // nothing about whether the rows are about the subject that was asked.
    const p = await search({ query: "quantum chromodynamics lattice gauge theory", hook_family: "subject-motion", limit: 6 });
    check("returns rows (cosine always does)", p.count > 0, `${p.count} rows`);
    check("but reports grounded:false", p.grounded === false, `warrant=${p.warrant}`);
  }

  console.log(
    failures === 0
      ? "\n✅ technique axis live-verified against prod\n"
      : `\n❌ ${failures} check(s) failed\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("smoke failed:", e);
  process.exit(1);
});
