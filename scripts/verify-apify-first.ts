/**
 * verify-apify-first.ts — one real end-to-end run of the Phase 1 chain.
 *
 * Wire-level tests mock `apify-client`, so nothing in the suite has ever seen a real payload
 * from `searchSection:"/user"`, a real VTT URL, or a decode of real speech. This runs the whole
 * chain once, for real: stage 1 → stage 2 → per-author baseline → transcript → decode →
 * write-back → cache read-back.
 *
 * ⚠️ SPENDS REAL APIFY MONEY. The account is FREE with a $5/mo hard cap (memory:
 * apify-free-plan-hard-limit) — this checks the balance and REFUSES to start without headroom,
 * because at the cap Apify 403s and the app disguises it as "check your handle is public".
 *
 * ⚠️ Writes one row into the SHARED `outlier_teardowns` corpus. `getDiscoverCorpus()` reads any
 * `status='extracted'` row, so until Phase 1 is wired into a request path the row is deleted
 * again at the end (--keep to retain it).
 *
 * Run (FOREGROUND, sandbox OFF — the sandbox drops the Apify/TikTok network):
 *   node node_modules/tsx/dist/cli.mjs scripts/verify-apify-first.ts [--keep]
 * Needs .env.local: APIFY_TOKEN, DASHSCOPE_API_KEY, SUPABASE service key.
 */
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

/* eslint-disable @typescript-eslint/no-require-imports */
const { createScrapingProvider } = require("@/lib/scraping");
const {
  computeAuthorBaseline,
  multiplierFor,
  formatMultiplier,
} = require("@/lib/discover/author-baseline");
const { decodeVideo } = require("@/lib/decode/live-decode");
const { storeDecode, getCachedDecode } = require("@/lib/decode/decode-cache");
const { createServiceClient } = require("@/lib/supabase/service");

const KEEP = process.argv.includes("--keep");
const NICHE = "startup founder";

interface Video {
  platformVideoId: string;
  videoUrl: string;
  caption: string;
  views: number;
  likes: number;
  durationSeconds: number;
  coverUrl?: string;
  subtitleUrl?: string;
  author?: { handle: string; fans: number; heart: number; videoCount: number };
}

/** Refuse to spend at the cap — a 403 here reads as a bad handle and wastes an hour. */
async function assertApifyHeadroom() {
  const res = await fetch(
    `https://api.apify.com/v2/users/me/limits?token=${process.env.APIFY_TOKEN}`,
  );
  const j = (await res.json()) as {
    data: { current: { monthlyUsageUsd: number }; limits: { maxMonthlyUsageUsd: number } };
  };
  const used = j.data.current.monthlyUsageUsd;
  const cap = j.data.limits.maxMonthlyUsageUsd;
  console.log(`APIFY — $${used.toFixed(2)} / $${cap.toFixed(2)} used`);
  // Two runs at the measured $0.0513/run average, with slack.
  if (cap - used < 0.2) throw new Error(`at the Apify cap ($${used}/$${cap}) — refusing to run`);
}

async function main() {
  await assertApifyHeadroom();
  const provider = createScrapingProvider();

  // ── STAGE 1: people, not caption matches ────────────────────────────────
  const handles: string[] = await provider.searchCreators(NICHE, 3);
  console.log("STAGE 1 — creators:", handles);
  if (handles.length === 0) throw new Error("stage 1 returned nobody");

  // ── STAGE 2: that creator's own recent posts, with free subtitles ───────
  const videos: Video[] = await provider.scrapeVideos(handles[0], 6, "profile");
  console.log(`STAGE 2 — ${videos.length} posts from @${handles[0]}`);
  const withSubs = videos.filter((v) => v.subtitleUrl).length;
  console.log(`  subtitle coverage: ${withSubs}/${videos.length}`);

  const author = videos.find((v) => v.author)?.author;
  if (!author) throw new Error("no author aggregates — Task 2 is not wired");

  // ── BASELINE: own median views, because stage 2 gives us their own posts ─
  const baseline = computeAuthorBaseline(
    author,
    videos.map((v) => v.views),
  );
  if (!baseline) throw new Error("no baseline computable");
  console.log("BASELINE —", baseline);

  // Same denominator regardless of how many rows came back — the point of Task 1.
  const top = [...videos].sort((a, b) => b.views - a.views)[0]!;
  for (const n of [3, 6]) {
    const b = computeAuthorBaseline(author, videos.slice(0, n).map((v) => v.views));
    console.log(
      `  at N=${n}: ${b ? formatMultiplier(multiplierFor(top, b)) : "n/a"} ${b?.label ?? ""}`,
    );
  }
  console.log(
    `TOP — ${top.views} views · ${formatMultiplier(multiplierFor(top, baseline))} ${baseline.label}`,
  );

  // ── DECODE: from the free transcript ────────────────────────────────────
  const withSub = videos.find((v) => v.subtitleUrl) ?? top;
  console.log(`DECODING ${withSub.platformVideoId} (subtitleUrl: ${withSub.subtitleUrl ? "yes" : "NO"})`);
  const decode = await decodeVideo(withSub);
  console.log("DECODE —", decode ? JSON.stringify(decode, null, 2) : "FAILED (null)");
  if (!decode) throw new Error("decode returned null on a real video");

  // ── WRITE-BACK + CACHE READ ─────────────────────────────────────────────
  await storeDecode(withSub, decode, baseline);
  const cached = await getCachedDecode(withSub.platformVideoId);
  console.log("CACHE READ-BACK —", cached ? JSON.stringify(cached, null, 2) : "MISS");
  if (!cached) throw new Error("write-back did not land — the corpus is not self-filling");

  const client = createServiceClient();
  const { data } = await client
    .from("outlier_teardowns")
    .select("creator_handle, source_pool, status, hook_source, baseline_label, outlier_multiplier, hook_template")
    .eq("platform_video_id", withSub.platformVideoId)
    .maybeSingle();
  console.log("ROW —", JSON.stringify(data, null, 2));

  if (!KEEP) {
    await client
      .from("outlier_teardowns")
      .delete()
      .eq("platform_video_id", withSub.platformVideoId);
    console.log("CLEANED UP the verification row (pass --keep to retain it).");
  }
  console.log("PASS.");
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
