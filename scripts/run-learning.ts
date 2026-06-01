/**
 * 1:1 E2E learning loop — CLI runner.
 *
 * Drives the whole loop end-to-end on live data:
 *
 *   feed    → OPERATOR-CURATED ingest (no scraping): you download a video by
 *             hand, read its real metrics off the post, and feed the raw mp4 in
 *             with --views/--likes/etc. Stores it 1:1 like a user upload and
 *             inserts the training row. The intended front door — curated by
 *             strategy, not an automated sweep of platform users.
 *   ingest  → (automated alternative) scrape real TikTok videos (Apify),
 *             download the raw mp4, store in the `videos` bucket under
 *             `training/`, insert a row with the REAL platform metrics.
 *   sweep   → run each scraped video BLIND through the EXACT production pipeline
 *             (video_upload mode) and capture the engine's feature_vector +
 *             per-signal scores + predicted bucket.  ($$ + slow — real vision runs)
 *   label   → assign the real outcome (percentile-within-niche → viral/avg/under)
 *             and the engine-vs-reality comparison.
 *   fit     → fit per-niche aggregator weights from the labeled pairs and MEASURE
 *             the macro-F1 lift over the current hand-set weights. Does NOT touch
 *             production scoring (applying learned weights is a separate gate).
 *   doctor  → DETERMINISM GATE. Run one video through the pipeline TWICE and assert
 *             the scalar scores are identical. This is the precondition for trusting
 *             the fit number — you can't separate model error from sampling jitter
 *             if the scorer drifts run-to-run. Run this BEFORE fit on fresh data.
 *   status  → counts by status + per-niche/bucket breakdown of the training table.
 *
 * Run:
 *   npx tsx scripts/run-learning.ts status
 *   npx tsx scripts/run-learning.ts feed --niche fitness --video ~/Downloads/clip.mp4 --views 1200000 --likes 95000 --url https://www.tiktok.com/@x/video/7401234567890
 *   npx tsx scripts/run-learning.ts ingest --niche fitness --config trending,under --pilot
 *   npx tsx scripts/run-learning.ts sweep  --max-rows 40 --max-cost-cents 1500
 *   npx tsx scripts/run-learning.ts label  --min-cohort 8
 *   npx tsx scripts/run-learning.ts fit
 *   npx tsx scripts/run-learning.ts doctor --video /path/to.mp4 --niche fitness
 *
 * Env (.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * DASHSCOPE_API_KEY (sweep/doctor), APIFY_TOKEN (ingest).
 */
import { config } from "dotenv";
import { resolve, basename } from "path";
config({ path: resolve(__dirname, "../.env.local") });

import { register } from "tsconfig-paths";
import { readFileSync } from "fs";
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

import { ApifyClient } from "apify-client";
import { createServiceClient } from "../src/lib/supabase/service";
import { ingestScrapedItems, ingestManualVideo, parseTikTokVideoId } from "../src/lib/engine/learning/ingest";
import { runPredictSweep } from "../src/lib/engine/learning/predict-sweep";
import { runLabelPass } from "../src/lib/engine/learning/label";
import { runFitWeights } from "../src/lib/engine/learning/run";
import { buildApifyJobs, NICHES, type Niche, type ScrapeConfigKind } from "../src/lib/engine/corpus/apify-jobs";
import { runPredictionPipeline } from "../src/lib/engine/pipeline";
import { aggregateScores } from "../src/lib/engine/aggregator";
import type { AnalysisInput } from "../src/lib/engine/types";

// ─── tiny flag parser ─────────────────────────────────────────────────────────
function parseFlags(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}
const num = (v: string | boolean | undefined, d: number): number =>
  typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : d;
/** Optional numeric flag: returns undefined when absent/invalid (lets the row builder apply its own default). */
const optNum = (v: string | boolean | undefined): number | undefined =>
  typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined;
const optStr = (v: string | boolean | undefined): string | undefined =>
  typeof v === "string" && v.trim() !== "" ? v : undefined;

function assertNiche(v: string | boolean | undefined): Niche {
  if (typeof v !== "string" || !(NICHES as readonly string[]).includes(v)) {
    throw new Error(`--niche must be one of: ${NICHES.join(", ")} (got ${String(v)})`);
  }
  return v as Niche;
}

const log = (m: string) => console.log(`[learning] ${m}`);

// ─── ingest ─────────────────────────────────────────────────────────────────
async function cmdIngest(flags: Record<string, string | boolean>) {
  const niche = assertNiche(flags.niche);
  const isPilot = flags.pilot === true || flags.pilot === "true";
  const waitSecs = num(flags.wait, 600);
  const corpusVersion = typeof flags.version === "string" ? flags.version : "learning-v1";
  const configs = (typeof flags.config === "string" ? flags.config.split(",") : ["trending", "average", "under"])
    .map((c) => c.trim()) as ScrapeConfigKind[];

  if (!process.env.APIFY_TOKEN) throw new Error("APIFY_TOKEN missing (.env.local)");
  const apify = new ApifyClient({ token: process.env.APIFY_TOKEN });
  const jobs = buildApifyJobs(niche, isPilot);

  let totalIngested = 0;
  let totalSkipped = 0;
  for (const kind of configs) {
    const job = jobs[kind];
    if (!job) {
      log(`unknown config "${kind}" — skipping`);
      continue;
    }
    log(`scraping niche=${niche} config=${kind} actor=${job.actorId} (pilot=${isPilot})…`);
    const run = await apify.actor(job.actorId).call(job.input, { waitSecs });
    const { items } = await apify.dataset(run.defaultDatasetId).listItems();
    log(`scraped ${items.length} raw items → ingesting (download mp4 + store + row)…`);

    const res = await ingestScrapedItems(items, niche, { corpusVersion, scrapeKind: kind, societyId: niche });
    totalIngested += res.ingested;
    totalSkipped += res.skipped;
    log(`config=${kind}: ingested=${res.ingested} skipped=${res.skipped}`);
  }
  log(`DONE ingest — niche=${niche} ingested=${totalIngested} skipped=${totalSkipped}`);
}

// ─── feed (operator-curated manual ingest — no scraping) ──────────────────────
async function cmdFeed(flags: Record<string, string | boolean>) {
  const niche = assertNiche(flags.niche);
  const videoPath = optStr(flags.video);
  if (!videoPath) throw new Error("--video <path> required (local mp4 you downloaded)");
  const views = optNum(flags.views);
  if (views === undefined || views < 0) throw new Error("--views <N> required (real TikTok view count it achieved)");

  const url = optStr(flags.url) ?? null;
  // Stable dedup/storage id: explicit --id, else parsed from the URL, else the filename stem.
  const platformVideoId =
    optStr(flags.id) ??
    parseTikTokVideoId(url) ??
    basename(videoPath).replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!platformVideoId) throw new Error("could not derive a video id — pass --id <slug>");

  const buf = readFileSync(videoPath);
  log(`feed — niche=${niche} id=${platformVideoId} views=${views} (${(buf.length / 1e6).toFixed(1)}MB) → videos/training/…`);

  const res = await ingestManualVideo(new Uint8Array(buf), {
    niche,
    platform_video_id: platformVideoId,
    real_views: views,
    video_url: url,
    creator_handle: optStr(flags.handle) ?? null,
    posted_at: optStr(flags["posted-at"]) ?? null,
    duration_seconds: optNum(flags.duration) ?? null,
    real_likes: optNum(flags.likes) ?? null,
    real_comments: optNum(flags.comments) ?? null,
    real_shares: optNum(flags.shares) ?? null,
    real_saves: optNum(flags.saves) ?? null,
    real_completion_pct: optNum(flags.completion) ?? null,
    follower_count: optNum(flags.followers) ?? null,
    society_id: optStr(flags.society) ?? null,
  });

  if (res.ok) {
    log(`DONE feed — row inserted (status=scraped). Next: sweep → label → fit.`);
  } else {
    log(`feed SKIPPED (${res.skipped}${res.error ? `: ${res.error}` : ""}). Note: re-feeding an existing id is a no-op (dedup).`);
    process.exitCode = 1;
  }
}

// ─── sweep (BLIND prediction, real pipeline — $$ + slow) ──────────────────────
async function cmdSweep(flags: Record<string, string | boolean>) {
  if (!process.env.DASHSCOPE_API_KEY) throw new Error("DASHSCOPE_API_KEY missing (.env.local)");
  const maxRows = num(flags["max-rows"], 100);
  const maxCostCents = num(flags["max-cost-cents"], 2000);
  log(`predict sweep — maxRows=${maxRows} maxCostCents=${maxCostCents} ($${(maxCostCents / 100).toFixed(2)} cap). Real vision runs — this costs money.`);
  const res = await runPredictSweep({ maxRows, maxCostCents });
  log(`DONE sweep — predicted=${res.predicted} failed=${res.failed} skipped=${res.skipped} cost=$${(res.costCents / 100).toFixed(2)}`);
}

// ─── label ────────────────────────────────────────────────────────────────────
async function cmdLabel(flags: Record<string, string | boolean>) {
  const minCohort = num(flags["min-cohort"], 8);
  const res = await runLabelPass({ minCohort });
  log(`DONE label — labeled=${res.labeled} bucketMatchRate=${res.bucketMatchRate ?? "n/a"}`);
  if (res.skippedNiches.length) log(`  skipped niches (cohort < ${minCohort}): ${res.skippedNiches.join(", ")}`);
}

// ─── fit (measure-only — does NOT touch production) ───────────────────────────
async function cmdFit() {
  const r = await runFitWeights();
  console.log("\n========== FIT WEIGHTS REPORT ==========");
  console.log(`rows used        : ${r.rowsUsed}`);
  console.log(`fitted niches    : ${r.fittedNiches.join(", ") || "(none — too little data)"}`);
  console.log(`defaulted niches : ${r.defaultedNiches.join(", ") || "(none)"}`);
  console.log("\n  baseline (hand-set weights)");
  console.log(`    n=${r.baseline.n}  matchRate=${(r.baseline.matchRate * 100).toFixed(1)}%  macroF1=${r.baseline.macroF1.toFixed(4)}`);
  console.log("  learned (per-niche fitted weights)");
  console.log(`    n=${r.learned.n}  matchRate=${(r.learned.matchRate * 100).toFixed(1)}%  macroF1=${r.learned.macroF1.toFixed(4)}`);
  console.log(`\n  >> macro-F1 LIFT (learned − baseline): ${r.macroF1Lift >= 0 ? "+" : ""}${r.macroF1Lift.toFixed(4)}`);
  console.log(`     ${r.macroF1Lift > 0.02 ? "learned weights beat hand-set — candidate for the apply gate" : r.macroF1Lift < -0.02 ? "hand-set weights win — DO NOT apply learned" : "≈ tie — not enough signal/data to justify a production change"}`);
  console.log("\n  per-niche weights:");
  for (const [niche, w] of Object.entries(r.weightsByNiche)) {
    const top = Object.entries(w).filter(([, x]) => x > 0).sort((a, b) => b[1] - a[1]).map(([k, x]) => `${k}=${x.toFixed(2)}`).join(" ");
    console.log(`    ${niche.padEnd(12)} ${top}`);
  }
  console.log("\n  NOTE: measurement only — learned weights are NOT applied to production scoring.");
}

// ─── doctor (determinism gate) ────────────────────────────────────────────────
async function cmdDoctor(flags: Record<string, string | boolean>) {
  if (!process.env.DASHSCOPE_API_KEY) throw new Error("DASHSCOPE_API_KEY missing (.env.local)");
  const supabase = createServiceClient();
  const niche = (typeof flags.niche === "string" && (NICHES as readonly string[]).includes(flags.niche)) ? (flags.niche as Niche) : ("fitness" as Niche);

  // Resolve a storage path in the `videos` bucket: reuse --storage-path, else upload --video.
  let storagePath: string;
  if (typeof flags["storage-path"] === "string") {
    storagePath = flags["storage-path"];
    log(`doctor — reusing existing videos/${storagePath}`);
  } else {
    const videoPath = typeof flags.video === "string" ? flags.video : "/Users/davideloreti/Downloads/TikTok Video Downloader.mp4";
    const buf = readFileSync(videoPath);
    storagePath = `training/doctor-${Date.now()}.mp4`;
    log(`doctor — uploading ${videoPath} (${(buf.length / 1e6).toFixed(1)}MB) → videos/${storagePath}`);
    const up = await supabase.storage.from("videos").upload(storagePath, buf, { contentType: "video/mp4", upsert: true });
    if (up.error) throw new Error("upload failed: " + up.error.message);
  }

  const input: AnalysisInput = {
    input_mode: "video_upload",
    video_storage_path: storagePath,
    content_type: "video",
    niche,
  };

  // CRITICAL: bypassCache so each run genuinely re-runs the engine (not the cached result).
  async function scoreOnce(tag: string) {
    const pr = await runPredictionPipeline(input, { requestId: `doctor-${tag}-${Date.now()}`, bypassCache: true });
    return aggregateScores(pr);
  }

  log("doctor — run 1/2 (this re-runs the full engine, ~$1.5 + ~170s)…");
  const a = await scoreOnce("a");
  log("doctor — run 2/2…");
  const b = await scoreOnce("b");

  const scalarDrift =
    a.overall_score !== b.overall_score ||
    a.behavioral_score !== b.behavioral_score ||
    a.gemini_score !== b.gemini_score ||
    Math.abs(a.confidence - b.confidence) > 1e-9;

  const curveA = a.heatmap?.weighted_curve ?? [];
  const curveB = b.heatmap?.weighted_curve ?? [];
  const curveMaxDiff =
    curveA.length === curveB.length && curveA.length > 0
      ? Math.max(0, ...curveA.map((v, i) => Math.abs(v - curveB[i])))
      : NaN;

  console.log("\n========== DETERMINISM GATE ==========");
  console.log(`overall_score    : ${a.overall_score} vs ${b.overall_score}`);
  console.log(`behavioral_score : ${a.behavioral_score} vs ${b.behavioral_score}`);
  console.log(`gemini_score     : ${a.gemini_score} vs ${b.gemini_score}`);
  console.log(`confidence       : ${a.confidence} vs ${b.confidence}`);
  console.log(`curveMaxDiff     : ${curveMaxDiff}  (soft diagnostic — temp:0 territory)`);
  console.log(`reproducible     : ${!scalarDrift}`);
  if (scalarDrift) {
    console.error("\n[doctor] FAIL — temp:0 + seed did NOT yield identical scores. Do NOT trust a fit number until this passes.");
    process.exit(1);
  }
  console.log("\n[doctor] PASS — scorer is reproducible. The fit number is trustworthy on this basis.");
}

// ─── status ────────────────────────────────────────────────────────────────────
async function cmdStatus() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("engine_training_videos")
    .select("status, niche, real_bucket, engine_predicted_bucket, bucket_match");
  if (error) throw new Error(error.message);
  const rows = data ?? [];

  const byStatus = new Map<string, number>();
  for (const r of rows) byStatus.set(r.status as string, (byStatus.get(r.status as string) ?? 0) + 1);
  console.log("\n========== engine_training_videos ==========");
  console.log(`total rows: ${rows.length}`);
  for (const [s, c] of [...byStatus.entries()].sort()) console.log(`  ${s.padEnd(10)} ${c}`);

  const labeled = rows.filter((r) => r.status === "labeled");
  if (labeled.length) {
    const byNiche = new Map<string, { v: number; a: number; u: number; match: number }>();
    for (const r of labeled) {
      const k = (r.niche as string) ?? "?";
      const e = byNiche.get(k) ?? { v: 0, a: 0, u: 0, match: 0 };
      if (r.real_bucket === "viral") e.v++;
      else if (r.real_bucket === "average") e.a++;
      else if (r.real_bucket === "under") e.u++;
      if (r.bucket_match) e.match++;
      byNiche.set(k, e);
    }
    console.log("\n  labeled by niche (viral/avg/under | engine match-rate):");
    for (const [niche, e] of [...byNiche.entries()].sort()) {
      const n = e.v + e.a + e.u;
      console.log(`    ${niche.padEnd(12)} ${e.v}/${e.a}/${e.u}  | ${n ? ((e.match / n) * 100).toFixed(0) : "0"}%  (n=${n}${e.v >= 4 && e.u >= 4 ? "" : "  ⚠ <4 in a class — fit will default this niche"})`);
    }
  } else {
    console.log("\n  (no labeled rows yet — run ingest → sweep → label)");
  }
}

// ─── main ────────────────────────────────────────────────────────────────────
async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  switch (cmd) {
    case "ingest": return cmdIngest(flags);
    case "feed": return cmdFeed(flags);
    case "sweep": return cmdSweep(flags);
    case "label": return cmdLabel(flags);
    case "fit": return cmdFit();
    case "doctor": return cmdDoctor(flags);
    case "status": return cmdStatus();
    default:
      console.log("usage: run-learning <feed|ingest|sweep|label|fit|doctor|status> [flags]");
      console.log("  feed   --niche <n> --video <path> --views <N> [--url <u>] [--id <slug>] [--likes N] [--comments N] [--shares N] [--saves N] [--completion P] [--followers N] [--duration S] [--handle @x] [--posted-at ISO] [--society s]");
      console.log("  ingest --niche <n> [--config trending,average,under] [--pilot] [--wait 600] [--version learning-v1]");
      console.log("  sweep  [--max-rows 100] [--max-cost-cents 2000]");
      console.log("  label  [--min-cohort 8]");
      console.log("  fit");
      console.log("  doctor [--video <path> | --storage-path <key>] [--niche fitness]");
      console.log("  status");
      process.exit(cmd ? 1 : 0);
  }
}

main().catch((err) => {
  console.error(`[learning] FATAL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
