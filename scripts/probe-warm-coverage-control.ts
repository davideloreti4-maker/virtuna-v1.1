/**
 * probe-warm-coverage-control.ts — the negative control for probe-warm-coverage.ts.
 *
 * The main probe measured gate 1 passing on ~96% of real asks. That is only meaningful if gate 1
 * CAN fail. This runs deliberately off-corpus and degenerate queries through the identical path.
 *
 * If nonsense also passes, the 96% is not "the corpus covers our creators" — it is "the gate has
 * no topicality control", and gate 1 is a branch that almost never takes its else.
 *
 * Cost: DashScope embeddings only. Zero Apify. Nothing written.
 *   node node_modules/tsx/dist/cli.mjs scripts/probe-warm-coverage-control.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

/* eslint-disable @typescript-eslint/no-require-imports */
const { getCorpusClient, matchSharedTeardowns } = require("@/lib/grounding/corpus");
const { embedQueryText } = require("@/lib/grounding/embedder");
const {
  resolveRetrieveConfig,
  isAdmissible,
  isProofGrade,
  isFreshTeardown,
  hasReusableSignal,
} = require("@/lib/grounding/retrieve");

/**
 * Controls, in rough order of how obviously they should MISS.
 * "carbonara recipe" is here because retrieve.ts records it measuring 0.673 against this corpus —
 * higher than an on-topic personal-branding query. If the floor cannot reject it, the floor is
 * not measuring topicality.
 */
const CONTROLS = [
  "asdfghjkl qwerty zxcvbn",
  "yes",
  "ok",
  "the",
  "carbonara recipe",
  "how to replace a timing belt on a 1998 diesel tractor",
  "medieval Latin manuscript palaeography",
  "settlement of the Peloponnesian War",
  "quantum chromodynamics lattice gauge theory",
  "my cat will not stop knocking things off the table",
  "conveyancing solicitor fees in rural Wales",
  "bulk carrier ballast water treatment regulations",
];

async function main() {
  const supabase = getCorpusClient();
  const cfg = resolveRetrieveConfig();
  console.log(`config: minSimilarity=${cfg.minSimilarity} fetchCount=${cfg.fetchCount}`);
  console.log(`gate 1 bar: >= 3 rows passing isProofGrade\n`);
  console.log("query                                              adm  proof  gate1   topSim  medSim");
  console.log("-".repeat(92));

  let passes = 0;
  for (const q of CONTROLS) {
    const embedding = await embedQueryText(q);
    const rows = await matchSharedTeardowns(supabase, {
      embedding,
      count: cfg.fetchCount,
      filterPlatform: null,
      filterFormat: null,
      filterArchetype: null,
      filterVisual: null,
      filterEditing: null,
      filterNiche: null,
      filterHookTechnique: null,
      filterHookFamily: null,
    });
    const good = rows.filter(
      (r: Record<string, unknown>) =>
        (r.similarity as number) >= cfg.minSimilarity &&
        isFreshTeardown(r.proof_captured_at, cfg.freshDays) &&
        isAdmissible(r) &&
        hasReusableSignal(r),
    );
    const proof = good.filter((r: Record<string, unknown>) => isProofGrade(r));
    const sims = rows.map((r: Record<string, unknown>) => r.similarity as number).sort((a: number, b: number) => b - a);
    const med = sims.length ? sims[Math.floor(sims.length / 2)] : 0;
    const hit = proof.length >= 3;
    if (hit) passes++;
    console.log(
      `${q.slice(0, 48).padEnd(50)} ${String(good.length).padStart(2)}   ${String(proof.length).padStart(3)}   ${(hit ? "PASS" : "miss").padEnd(6)}  ${sims[0]?.toFixed(3) ?? "—"}   ${med.toFixed(3)}`,
    );
  }
  console.log("-".repeat(92));
  console.log(`\n${passes}/${CONTROLS.length} deliberately off-corpus queries PASSED gate 1.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
