/**
 * probe-author-baseline-coverage.ts — does a NICHE pull carry per-author aggregates, and do
 * those aggregates produce a printable number?
 *
 * The Phase 2 switch replaces the printed outlier multiplier's denominator (median of the
 * RETURNED set — moves with `resultsPerPage`) with the per-author baseline in
 * `author-baseline.ts`. That is only possible if `VideoData.author` is actually populated on
 * the paths that print it, AND if the resulting multiplier is not nonsense. Every wire-level
 * test mocks apify-client, so nothing in the suite has ever seen a real answer to either.
 *
 * ⚠️ SPENDS REAL APIFY MONEY. Free account, $5/mo hard cap — checks the balance and refuses
 * without headroom (at the cap Apify 403s and the app disguises it as "check your handle is
 * public"). Every scrape is DUMPED to disk so the analysis can be re-run for $0.00.
 *
 * Run (FOREGROUND, sandbox OFF — the sandbox drops the Apify network):
 *   node node_modules/tsx/dist/cli.mjs scripts/probe-author-baseline-coverage.ts \
 *     [--niche "startup founder"] [--handle someone] [--n 20] [--from <dump.json>]
 */
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

/* eslint-disable @typescript-eslint/no-require-imports */
const { createScrapingProvider } = require("@/lib/scraping");
const { computeAuthorBaseline, multiplierFor, formatMultiplier } = require("@/lib/discover/author-baseline");
const { rankOutliers } = require("@/lib/discover/outlier-compute");
const { accountMultiplier } = require("@/lib/grounding/outlier-gate");

const DUMP_DIR = "/private/tmp/claude-501/-Users-davideloreti-virtuna-v1-1/795208ef-4e77-4758-870c-13e7a8ad1c1e/scratchpad";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const NICHE = arg("--niche") ?? "startup founder";
const HANDLE = arg("--handle");
const N = Number(arg("--n") ?? 20);
const FROM = arg("--from");

interface Video {
  platformVideoId: string;
  caption: string;
  views: number;
  likes: number;
  saves: number;
  shares: number;
  postedAt: Date;
  author?: { handle: string; fans: number; heart: number; videoCount: number };
}

async function apifyUsed(): Promise<number> {
  const res = await fetch(`https://api.apify.com/v2/users/me/limits?token=${process.env.APIFY_TOKEN}`);
  const j = (await res.json()) as {
    data: {
      current: { monthlyUsageUsd: number };
      limits: { maxMonthlyUsageUsd: number };
      monthlyUsageCycle: { endAt: string };
    };
  };
  const { current, limits, monthlyUsageCycle } = j.data;
  const resets = new Date(monthlyUsageCycle.endAt).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  });
  console.log(
    `APIFY — $${current.monthlyUsageUsd.toFixed(4)} / $${limits.maxMonthlyUsageUsd.toFixed(2)}, resets ${resets} (UTC)`,
  );
  if (limits.maxMonthlyUsageUsd - current.monthlyUsageUsd < 0.2) {
    throw new Error(`at the Apify cap — refusing to run`);
  }
  return current.monthlyUsageUsd;
}

function fmt(n: number): string {
  return n >= 1_000_000 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}

function report(label: string, videos: Video[], mode: "profile" | "niche") {
  console.log(`\n${"═".repeat(96)}\n${label} — ${videos.length} posts, mode=${mode}\n${"═".repeat(96)}`);

  const withAuthor = videos.filter((v) => v.author);
  console.log(`authorMeta coverage: ${withAuthor.length}/${videos.length}`);
  if (withAuthor.length === 0) {
    console.log("🔴 NO author aggregates — a per-author denominator is IMPOSSIBLE on this path.");
    return;
  }

  const byAuthor = new Map<string, Video[]>();
  for (const v of withAuthor) {
    const h = v.author!.handle;
    if (!byAuthor.has(h)) byAuthor.set(h, []);
    byAuthor.get(h)!.push(v);
  }
  console.log(
    `distinct authors: ${byAuthor.size} — posts per author: [${[...byAuthor.values()].map((v) => v.length).sort((a, b) => b - a).join(", ")}]`,
  );

  // ── Are the lifetime aggregates SANE? heart/videoCount = avg likes per post ──────
  console.log(`\n  RAW AUTHOR AGGREGATES — is heart/videoCount a believable avg-likes-per-post?`);
  console.log(
    `  ${"handle".padEnd(20)} ${"fans".padStart(8)} ${"heart".padStart(9)} ${"vids".padStart(6)} ${"avgLikes".padStart(9)}  ${"this post: views/likes".padStart(24)}`,
  );
  for (const [handle, vs] of [...byAuthor.entries()].slice(0, 12)) {
    const a = vs[0]!.author!;
    const avg = a.videoCount > 0 ? a.heart / a.videoCount : 0;
    const v = vs[0]!;
    console.log(
      `  ${handle.slice(0, 20).padEnd(20)} ${fmt(a.fans).padStart(8)} ${fmt(a.heart).padStart(9)} ${String(a.videoCount).padStart(6)} ${fmt(Math.round(avg)).padStart(9)}  ${`${fmt(v.views)} / ${fmt(v.likes)}`.padStart(24)}`,
    );
  }

  const ranked = rankOutliers(videos, mode);
  console.log(`\nin-90d-window: ${ranked.length}/${videos.length}`);
  if (ranked.length === 0) {
    console.log("⚠️  EMPTY after the 90-day window filter — this pull produces NO tiles at all.");
    return;
  }

  console.log(
    `\n  ${"video".padEnd(24)} ${"views".padStart(8)} ${"likes".padStart(8)}  ${"SHIPPED".padStart(8)}  ${"own-median".padStart(13)}  ${"lifetime-likes".padStart(14)}  ${"vs followers".padStart(12)}`,
  );
  for (const t of ranked.slice(0, 12)) {
    const v = videos.find((x) => x.platformVideoId === t.platformVideoId)!;
    let ownMed = "—";
    let lifetime = "—";
    let vsFans = "—";
    if (v.author) {
      const peers = byAuthor.get(v.author.handle) ?? [];
      const own = computeAuthorBaseline(v.author, peers.map((p) => p.views));
      if (own?.basis === "own-median-views") ownMed = `${formatMultiplier(multiplierFor(v, own))} (n=${peers.length})`;
      const life = computeAuthorBaseline(v.author);
      if (life?.basis === "lifetime-avg-likes") lifetime = formatMultiplier(multiplierFor(v, life));
      // The durable RECEIPT metric already sanctioned in grounding/outlier-gate.ts — whose
      // header says it needs a per-survivor profile scrape because "follower_count is not
      // inline on a niche/search pull". Phase 1's `author.fans` made that stale.
      const acct = accountMultiplier(v.views, v.author.fans);
      if (acct) vsFans = formatMultiplier(acct.multiplier);
    }
    const id = (v.caption || v.platformVideoId).replace(/\s+/g, " ").slice(0, 24);
    console.log(
      `  ${id.padEnd(24)} ${fmt(v.views).padStart(8)} ${fmt(v.likes).padStart(8)}  ${`${t.multiplier.toFixed(1)}×`.padStart(8)}  ${ownMed.padStart(13)}  ${lifetime.padStart(14)}  ${vsFans.padStart(12)}`,
    );
  }

  // The N-dependence the whole switch exists to kill.
  const half = videos.slice(0, Math.ceil(videos.length / 2));
  const rankedHalf = rankOutliers(half, mode);
  const overlap = rankedHalf.filter((h) => ranked.some((r) => r.platformVideoId === h.platformVideoId));
  if (overlap.length > 0) {
    console.log(`\n  N-DEPENDENCE (same video, N=${videos.length} → N=${half.length}):`);
    for (const h of overlap.slice(0, 4)) {
      const full = ranked.find((r) => r.platformVideoId === h.platformVideoId)!;
      const v = videos.find((x) => x.platformVideoId === h.platformVideoId)!;
      const peersFull = (byAuthor.get(v.author?.handle ?? "") ?? []).map((p) => p.views);
      const ownFull = v.author ? computeAuthorBaseline(v.author, peersFull) : null;
      const ownHalf = v.author
        ? computeAuthorBaseline(
            v.author,
            half.filter((x) => x.author?.handle === v.author!.handle).map((x) => x.views),
          )
        : null;
      const o1 = ownFull ? formatMultiplier(multiplierFor(v, ownFull)) : "—";
      const o2 = ownHalf ? formatMultiplier(multiplierFor(v, ownHalf)) : "—";
      console.log(
        `    ${(v.caption || v.platformVideoId).replace(/\s+/g, " ").slice(0, 26).padEnd(26)} ` +
          `SHIPPED ${full.multiplier.toFixed(1)}× → ${h.multiplier.toFixed(1)}×   |   per-author ${o1} → ${o2}`,
      );
    }
  }
}

async function main() {
  mkdirSync(DUMP_DIR, { recursive: true });

  if (FROM) {
    const dump = JSON.parse(readFileSync(FROM, "utf-8")) as Array<{
      label: string;
      mode: "profile" | "niche";
      videos: Video[];
    }>;
    for (const d of dump) {
      report(`${d.label} (from dump, $0.00)`, d.videos.map((v) => ({ ...v, postedAt: new Date(v.postedAt) })), d.mode);
    }
    return;
  }

  const before = await apifyUsed();
  const provider = createScrapingProvider();
  const dump: Array<{ label: string; mode: string; videos: Video[] }> = [];

  if (NICHE !== "none") {
    const nicheVideos: Video[] = await provider.scrapeVideos(NICHE, N, "search");
    dump.push({ label: `NICHE "${NICHE}"`, mode: "niche", videos: nicheVideos });
    report(`NICHE pull — "${NICHE}"`, nicheVideos, "niche");
  }

  if (HANDLE) {
    const profileVideos: Video[] = await provider.scrapeVideos(HANDLE, N, "profile");
    dump.push({ label: `PROFILE @${HANDLE}`, mode: "profile", videos: profileVideos });
    report(`PROFILE pull — @${HANDLE}`, profileVideos, "profile");
  }

  const path = arg("--out") ?? `${DUMP_DIR}/apify-probe-dump.json`;
  writeFileSync(path, JSON.stringify(dump, null, 2));
  console.log(`\n${"═".repeat(96)}\nRAW DUMP → ${path}  (re-analyse free with --from ${path})`);
  console.log(`APIFY spend this probe: $${((await apifyUsed()) - before).toFixed(4)}`);
}

main().catch((e) => {
  console.error("PROBE FAILED:", e);
  process.exit(1);
});
