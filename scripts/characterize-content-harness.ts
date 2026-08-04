/**
 * HARNESS — does `characterizeContent` actually survive on the model it runs on?
 *
 * It is the SILENT gate on the entire Population drill. `api/tools/react` calls it as
 * `characterizeContent(...).catch(() => null)`, and a null vector means `population` stays null.
 * The row still seals with a real % — so the Overview looks completely healthy — while
 * Brain / Engagement / Audience never open, because `openStimulus` requires `snap?.population`:
 *
 *     if (snap?.population) setDetailId(id);   // the 3 pages
 *     else if (!snap) openDevelop(id);
 *     // sealed but no population → INERT. A click does nothing, and nothing is logged.
 *
 * There is NO retry anywhere in that path, which is exactly the shape of the CALIBRATE failure
 * (`defaultSynthesize` was single-shot too). `CHAR_MODEL` defaults to `QWEN_REASONING_MODEL`,
 * which moved plus → flash on 2026-08-04.
 *
 * Two distinct failure modes, and the second is the nastier one:
 *   1. THROW — call/parse/schema failure. Swallowed by the `.catch`.
 *   2. OUT-OF-VOCAB TOPICS — it returns valid JSON, passes Zod, and every `topics` key is
 *      invented rather than drawn from the supplied vocabulary. Downstream those keys match no
 *      persona's interests, so the O(N) projection scores on nothing. This one is INVISIBLE to
 *      every gate: tsc, the suite, and the schema all pass.
 *
 * Usage: npx tsx scripts/characterize-content-harness.ts [audienceId] [--runs N]
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
const runsIdx = argv.indexOf("--runs");
const RUNS = runsIdx >= 0 ? Number(argv[runsIdx + 1]) : 1;
const AUDIENCE_ID = argv.find((a) => !a.startsWith("--") && a !== String(RUNS));

/** Real queued hooks off the owner's own Overview — the exact input that is failing. */
const HOOKS = [
  "Your startup didn't fail because of the market. It failed because your code was garbage.",
  "Stop trying to build an MVP. You are building a monument to your own ego.",
  "Save this if you want to avoid the three fatal flaws that kill 90% of new ventures.",
];

const MODELS = ["qwen3.7-flash", "qwen3.7-plus"];

async function main() {
  const supabase = createServiceClient();
  let q = supabase.from("audiences").select("id,name,signature").not("signature", "is", null);
  q = AUDIENCE_ID ? q.eq("id", AUDIENCE_ID) : q.order("created_at", { ascending: false });
  const { data, error } = await q.limit(1).single();
  if (error || !data) throw new Error(`audience fetch failed: ${error?.message ?? "none found"}`);

  const vocab: string[] = data.signature?.audience?.topic_vocab ?? [];
  console.log(`\n████ characterizeContent HARNESS ████`);
  console.log(`  audience   : ${data.name} (${data.id})`);
  console.log(`  topic_vocab: ${vocab.length ? vocab.join(", ") : "(EMPTY — the axes gate fails before the call)"}`);
  if (vocab.length === 0) {
    console.log(`\n  ⚠️ No topic_vocab → signatureHasPopulationAxes() is false → the call never fires and`);
    console.log(`     population is null by design. That is a CALIBRATION gap, not a model failure.\n`);
    return;
  }

  const summary: Record<string, { ok: number; total: number; oov: number }> = {};

  for (const model of MODELS) {
    process.env.FLASH_MODEL = model;
    delete require.cache[require.resolve("../src/lib/audience/characterize-content")];
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { characterizeContent } = require("../src/lib/audience/characterize-content");

    console.log(`\n══ ${model} ══`);
    let ok = 0, oov = 0, total = 0;
    for (let r = 0; r < RUNS; r++) {
      for (const hook of HOOKS) {
        total++;
        const t = Date.now();
        try {
          const v = await characterizeContent(hook, vocab);
          const keys = Object.keys(v.topics ?? {});
          const inVocab = keys.filter((k) => vocab.includes(k));
          ok++;
          const secs = ((Date.now() - t) / 1000).toFixed(1);
          console.log(
            `  ✅ ${secs.padStart(5)}s  hook=${v.hookStrength} nov=${v.novelty} hype=${v.hype} slow=${v.slowness}` +
            `  topics ${String(keys.length).padStart(2)} (${inVocab.length} in-vocab)`,
          );
          // STEP 2 — the other half of the silent gate. route.ts wraps this in a bare
          // `catch { population = null }`, so a throw here is indistinguishable from a skip:
          // the row seals, and the 3 depth pages never open.
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { reactPopulation } = require("../src/lib/audience/population");
            const pop = reactPopulation(data.signature, v);
            const segs = pop?.segments?.length ?? 0;
            const n = pop?.total ?? pop?.n ?? "?";
            console.log(`      → reactPopulation OK: ${segs} segments, N=${n}`);
          } catch (pe) {
            const pm = pe instanceof Error ? pe.message : String(pe);
            console.log(`      → ❌ reactPopulation THREW: ${pm.slice(0, 200)}`);
            console.log(`         THIS is the silent gate — route.ts:313 swallows it into population=null.`);
          }
          if (keys.length > 0 && inVocab.length === 0) {
            oov++;
            console.log(`     ⚠️ EVERY topic key is OUT OF VOCAB — the O(N) scorer matches nothing.`);
            console.log(`        returned: ${keys.slice(0, 8).join(", ")}`);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`  ❌ ${((Date.now() - t) / 1000).toFixed(1).padStart(5)}s  ${msg.slice(0, 170)}`);
        }
      }
    }
    summary[model] = { ok, total, oov };
    console.log(`  → ${ok}/${total} returned a vector · ${oov} of those scored entirely out-of-vocab`);
  }

  console.log(`\n═══════════ VERDICT ═══════════`);
  for (const m of MODELS) {
    const s = summary[m]!;
    const usable = s.ok - s.oov;
    console.log(`  ${m.padEnd(15)} ${usable}/${s.total} USABLE  (${s.ok} parsed, ${s.oov} out-of-vocab)`);
  }
  console.log(`\n  A vector that parses but scores out-of-vocab is NOT a pass — it projects onto nothing.`);
  console.log(`  Anything less than a clean sweep on the shipped model means the Population drill is`);
  console.log(`  dark for that share of runs, silently, with the row still sealed.\n`);
}

main().catch((e) => { console.error("\n[characterize-content-harness] FATAL:", e?.stack ?? e?.message ?? e); process.exit(1); });
