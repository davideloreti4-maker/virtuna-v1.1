/**
 * HARNESS — does a FIRED sim actually open the 3 depth pages?
 *
 * Runs the EXACT path `api/tools/react` runs when the creator hits "Simulate ↑" in the ARM panel,
 * then feeds the result through `buildDomainTemplate` and evaluates `AmbientDetail`'s OWN tab
 * predicates. So it answers the only question that matters: after a real run, do Brain /
 * Engagement / Audience open — or does the drill stay shut?
 *
 * The route's population gate, verbatim (route.ts:257-258):
 *     const populationSignature =
 *       audience?.signature ?? (audience?.is_general ? GENERAL_BASELINE_SIGNATURE : null);
 *     const wantPopulation = !!populationSignature && signatureHasPopulationAxes(populationSignature);
 *
 * And the rail's render gate (AmbientOverviewRail.tsx:584) requires `snap.population` before it
 * will build a template at all — so a null population is not "2 of 3 tabs", it is NOTHING opening.
 *
 * Usage: npx tsx scripts/fired-sim-drill-harness.ts [audienceId ...] [--no-flash]
 *   --no-flash  skip the 10-persona panel call (cheaper; voices come back empty, tabs unaffected)
 * Spends DashScope money (a few hundredths of a cent per call). No Apify spend.
 */
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createServiceClient } = require("../src/lib/supabase/service");

const argv = process.argv.slice(2);
const NO_FLASH = argv.includes("--no-flash");
const IDS = argv.filter((a) => !a.startsWith("--"));

/** The owner's own failing stimulus, off their real Overview. */
const STIMULUS = "Your startup didn't fail because of the market. It failed because your code was garbage.";

async function main() {
  const { GENERAL_BASELINE_SIGNATURE } = await import("../src/lib/audience/general-baseline-signature");
  const { signatureHasPopulationAxes, reactPopulation } = await import("../src/lib/audience/population");
  const { characterizeContent } = await import("../src/lib/audience/characterize-content");
  const { buildDomainTemplate } = await import("../src/lib/surfaces/ambient-v2-population");
  const { runFlashTextMode } = await import("../src/lib/engine/flash/run-flash-text-mode");
  const { aggregateFlash } = await import("../src/lib/engine/flash/flash-aggregate");
  const { buildReactionPanel } = await import("../src/lib/engine/flash/build-reaction-panel");

  const supabase = createServiceClient();
  const { data: rows } = await supabase
    .from("audiences")
    .select("id,name,is_general,mode,signature,created_at")
    .order("created_at", { ascending: false });

  const all = (rows ?? []) as Array<{
    id: string; name: string; is_general: boolean; mode: string;
    signature: unknown; created_at: string;
  }>;
  // The virtual GENERAL audience is not a DB row (`user_id:"__virtual__"`, audience-repo.ts:51), so
  // it can never appear in the query above — yet it is what a user with `last_audience_id: null`
  // actually resolves to. Synthesised here so the General path is measurable like any other.
  const GENERAL_ROW = {
    id: "general",
    name: "General (virtual — no DB row)",
    is_general: true,
    mode: "socials",
    signature: null as unknown,
    created_at: "—",
  };
  const targets = IDS.length
    ? [...all, GENERAL_ROW].filter((a) => IDS.includes(a.id))
    : [GENERAL_ROW, ...all];

  console.log(`\n=== FIRED-SIM DRILL HARNESS — ${targets.length} audience(s) ===`);
  console.log(`stimulus: "${STIMULUS.slice(0, 60)}…"\n`);

  for (const audience of targets) {
    const created = audience.created_at.slice(0, 10);
    console.log(`─── ${audience.name}  [${audience.mode}]  created ${created}`);

    // ── the route's gate, verbatim ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sig: any =
      (audience.signature as any) ?? (audience.is_general ? GENERAL_BASELINE_SIGNATURE : null);
    const wantPopulation = !!sig && signatureHasPopulationAxes(sig);
    console.log(`    signature: ${audience.signature ? "present" : "NULL"} · is_general: ${audience.is_general}`);
    console.log(`    wantPopulation: ${wantPopulation}`);

    if (!wantPopulation) {
      console.log(`    → population: null`);
      console.log(`    → DRILL: does not open. Brain ✗  Engagement ✗  Audience ✗\n`);
      continue;
    }

    // ── the two real model calls the route fires concurrently ──
    let vector: unknown = null;
    try {
      vector = await characterizeContent(STIMULUS, sig.audience.topic_vocab ?? []);
    } catch (e) {
      console.log(`    characterizeContent THREW: ${(e as Error).message}`);
      console.log(`    → population: null (swallowed by .catch)`);
      console.log(`    → DRILL: does not open. Brain ✗  Engagement ✗  Audience ✗\n`);
      continue;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const topics = Object.keys((vector as any)?.topics ?? {});
    const vocab: string[] = sig.audience.topic_vocab ?? [];
    const inVocab = topics.filter((t) => vocab.includes(t));
    console.log(`    characterizeContent: ${topics.length} topics, ${inVocab.length} in-vocab`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let personas: any[] = [];
    let pct = 50;
    if (!NO_FLASH) {
      const { panel, audienceRepaint } = buildReactionPanel(null, audience as never);
      const { result } = await runFlashTextMode(STIMULUS, "hook", panel, audienceRepaint);
      personas = result.personas;
      const { fraction } = aggregateFlash(personas);
      const m = /(\d+)\s*\/\s*(\d+)/.exec(fraction);
      pct = m ? (Number(m[1]) / Number(m[2])) * 100 : 50;
      console.log(`    runFlashTextMode: ${personas.length} personas · ${fraction}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let aggregate: any = null;
    try {
      aggregate = reactPopulation(sig, vector as never);
    } catch (e) {
      console.log(`    reactPopulation THREW: ${(e as Error).message}`);
      console.log(`    → DRILL: does not open.\n`);
      continue;
    }
    console.log(`    reactPopulation: N=${aggregate.total} · ${aggregate.segments.length} segments · stop ${aggregate.stopPct}%`);

    // ── the rail's render gate + the template the drill renders ──
    const template = buildDomainTemplate({
      pct,
      aggregate,
      personas: personas as never,
      calibratedFrom: "harness",
      tier: "flash",
      conceptLabel: "hook",
      stimulusKey: "harness-1",
      transcript: STIMULUS,
    });

    // ── AmbientDetail's OWN predicates (AmbientDetail.tsx:303,308,419) ──
    const brainAvailable = !!template.brain; // no brainNote on this path
    const engagementAvailable =
      !!template.engagement || !!(template.population as { actionIntent?: unknown } | undefined)?.actionIntent;
    const audienceAvailable = !!template.population;

    console.log(
      `    → DRILL OPENS. Brain ${brainAvailable ? "✓" : "✗"}  ` +
        `Engagement ${engagementAvailable ? "✓" : "✗"}  Audience ${audienceAvailable ? "✓" : "✗"}`,
    );
    const voices = template.engagement?.voices?.rows?.length ?? 0;
    console.log(`       engagement voices: ${voices} row(s) · population room segments: ${aggregate.segments.length}\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
