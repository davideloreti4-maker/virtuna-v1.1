/**
 * spike-free-subtitles.ts — Phase 0 of the Apify-first design.
 *
 * FOUR QUESTIONS, ONE RUN (the account is FREE with a $5/mo hard cap — see
 * memory: apify-free-plan-hard-limit):
 *
 *  Q1 COVERAGE — what fraction of scraped videos carry a FREE native subtitle track?
 *     `downloadSubtitlesOptions: "DOWNLOAD_SUBTITLES"` is the free tier ("only when present on the
 *     video"); the two transcribe options are AI and charged. The whole cost model of the design
 *     (D3: decode from VTT + caption + metrics on deaf-but-sighted flash) rests on this number.
 *
 *  Q2 USABILITY — does the VTT actually fetch and parse into the spoken hook? A URL that 403s or
 *     returns something unparseable is the same as no subtitle.
 *
 *  Q3 COST — what does one run of this shape actually bill? (Measured after, via the run's usage.)
 *
 *  Q4 BASELINE-N — `rankOutliers` computes `baseline = median(views of the returned set)`, so the
 *     multiplier is a WITHIN-SET statistic. This recomputes the multipliers at N=3, 6, 10 and the
 *     full set to show what a narrow scrape does to the receipt. Costs nothing extra — it is
 *     arithmetic over rows already fetched.
 *
 * Run (FOREGROUND, sandbox OFF — rtk drops the Apify/TikTok network):
 *   node node_modules/tsx/dist/cli.mjs scripts/spike-free-subtitles.ts
 * Needs .env.local: APIFY_TOKEN.
 */

import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { register } from "tsconfig-paths";
import { ApifyClient } from "apify-client";

config({ path: resolve(__dirname, "../.env.local") });
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

const OUT_DIR = resolve(__dirname, "../.spike-out");
const ACTOR = "clockworks/tiktok-scraper";
/** Wide on purpose — see Q4. The baseline is the median of what comes back. */
const RESULTS = 20;
const QUERY = "startup founder";

const token = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN;
if (!token) {
  console.error("No APIFY_TOKEN in .env.local — aborting before spending anything.");
  process.exit(1);
}

const client = new ApifyClient({ token });

/** Minimal WEBVTT → plain text. Drops the header, cue numbers, timestamps and blank lines. */
function parseVtt(vtt: string): string {
  return vtt
    .split(/\r?\n/)
    .filter(
      (l) =>
        l.trim() &&
        !/^WEBVTT/i.test(l) &&
        !/^\d+$/.test(l.trim()) &&
        !/-->/.test(l) &&
        !/^(NOTE|STYLE|REGION)/i.test(l),
    )
    .map((l) => l.replace(/<[^>]+>/g, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  console.log(`▸ actor   ${ACTOR}`);
  console.log(`▸ query   "${QUERY}"  · resultsPerPage ${RESULTS}`);
  console.log(`▸ subs    DOWNLOAD_SUBTITLES (free native only — no AI transcription)\n`);

  const started = Date.now();
  const run = await client.actor(ACTOR).call(
    {
      searchQueries: [QUERY],
      resultsPerPage: RESULTS,
      // THE ONE NEW LINE the design turns on. Free tier: native subs when the video has them.
      downloadSubtitlesOptions: "DOWNLOAD_SUBTITLES",
    },
    { waitSecs: 300 },
  );
  const elapsed = Math.round((Date.now() - started) / 1000);

  if (!run?.defaultDatasetId) {
    console.error("Run returned no dataset — it likely failed. Status:", run?.status);
    process.exit(1);
  }
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  console.log(`▸ run ${run.status} in ${elapsed}s · ${items.length} items\n`);

  // ── Q1 + Q2 ────────────────────────────────────────────────────────────────
  interface Row {
    handle: string;
    views: number;
    postedAt: string;
    durationSeconds: number;
    caption: string;
    subtitleUrl?: string;
    vttOk?: boolean;
    vttChars?: number;
    spokenOpening?: string;
    vttError?: string;
  }
  const rows: Row[] = [];

  for (const raw of items as Array<Record<string, any>>) {
    const meta = raw.videoMeta ?? {};
    const subs: Array<Record<string, any>> = meta.subtitleLinks ?? [];
    // Same selection rule as remapClockworksVideo: prefer English tiktokLink, else the first.
    const eng = subs.find((s) => String(s.language ?? "").toLowerCase().startsWith("en"));
    const pick = eng ?? subs[0];
    const subtitleUrl = pick?.tiktokLink ?? pick?.downloadLink;

    const row: Row = {
      handle: raw.authorMeta?.name ?? "?",
      views: raw.playCount ?? 0,
      postedAt: raw.createTime ? new Date(raw.createTime * 1000).toISOString().slice(0, 10) : "?",
      durationSeconds: meta.duration ?? 0,
      caption: String(raw.text ?? "").slice(0, 100),
      ...(subtitleUrl ? { subtitleUrl } : {}),
    };

    if (subtitleUrl) {
      try {
        const res = await fetch(subtitleUrl);
        if (!res.ok) {
          row.vttOk = false;
          row.vttError = `HTTP ${res.status}`;
        } else {
          const text = parseVtt(await res.text());
          row.vttOk = text.length > 0;
          row.vttChars = text.length;
          row.spokenOpening = text.slice(0, 160);
          if (!text.length) row.vttError = "parsed to empty";
        }
      } catch (e) {
        row.vttOk = false;
        row.vttError = e instanceof Error ? e.message : String(e);
      }
    }
    rows.push(row);
  }

  const withUrl = rows.filter((r) => r.subtitleUrl);
  const usable = rows.filter((r) => r.vttOk);
  const pct = (n: number) => (rows.length ? Math.round((n / rows.length) * 100) : 0);

  const out: string[] = [];
  out.push("═".repeat(74), "FREE SUBTITLE COVERAGE — Phase 0", "═".repeat(74), "");
  out.push(`items scraped                 ${rows.length}`);
  out.push(`carry a native subtitle URL   ${withUrl.length}  (${pct(withUrl.length)}%)   ← Q1`);
  out.push(`VTT fetched + parsed to text  ${usable.length}  (${pct(usable.length)}%)   ← Q2 (the real number)`);
  const failed = withUrl.filter((r) => !r.vttOk);
  if (failed.length) {
    out.push(`  fetch/parse failures: ${failed.map((f) => f.vttError).join(", ")}`);
  }
  if (usable.length) {
    const avg = Math.round(usable.reduce((a, r) => a + (r.vttChars ?? 0), 0) / usable.length);
    out.push(`avg transcript length         ${avg} chars`);
  }
  out.push("", "─".repeat(74), "SPOKEN OPENINGS (what flash would decode from)", "─".repeat(74));
  for (const r of usable.slice(0, 6)) {
    out.push("", `@${r.handle} · ${r.views.toLocaleString()} views · ${r.durationSeconds}s`);
    out.push(`  "${r.spokenOpening}…"`);
  }
  const noSubs = rows.filter((r) => !r.subtitleUrl).slice(0, 5);
  if (noSubs.length) {
    out.push("", "─".repeat(74), "NO NATIVE SUBS (would escalate per D5)", "─".repeat(74));
    for (const r of noSubs) out.push(`  @${r.handle} · ${r.views.toLocaleString()} views · ${r.durationSeconds}s`);
  }

  // ── Q4: what a narrow scrape does to the multiplier ────────────────────────
  out.push("", "═".repeat(74), "Q4 — BASELINE vs SCRAPE SIZE (why 'just scrape 3' breaks)", "═".repeat(74));
  out.push("`rankOutliers`: baseline = median(views of the RETURNED set). Same top video, different N:");
  out.push("");
  const byViews = [...rows].sort((a, b) => b.views - a.views);
  const top = byViews[0];
  if (top) {
    out.push(`top video: @${top.handle} · ${top.views.toLocaleString()} views`);
    out.push("");
    out.push("   N    baseline (median views)   its multiplier");
    for (const n of [3, 6, 10, rows.length]) {
      if (n > rows.length) continue;
      const slice = byViews.slice(0, n);
      const base = median(slice.map((v) => v.views)) || 1;
      const mult = top.views / base;
      const tag = n === rows.length ? ` (full set)` : "";
      out.push(`  ${String(n).padStart(2)}    ${String(Math.round(base).toLocaleString()).padStart(18)}   ${mult.toFixed(1)}×${tag}`);
    }
    out.push("");
    out.push("The SAME video earns a different receipt purely from how many siblings were scraped.");
    out.push("A narrow scrape does not just risk missing outliers — it CHANGES the number printed.");
  }

  const report = out.join("\n");
  console.log(report);
  writeFileSync(resolve(OUT_DIR, "free-subtitles-report.txt"), report);
  writeFileSync(resolve(OUT_DIR, "free-subtitles-rows.json"), JSON.stringify(rows, null, 2));

  // ── Q3: what this run actually cost ────────────────────────────────────────
  try {
    const info = await client.run(run.id).get();
    const usd = (info as unknown as { usageTotalUsd?: number })?.usageTotalUsd;
    console.log(`\n▸ THIS RUN COST: $${(usd ?? 0).toFixed(4)}  (${elapsed}s, ${rows.length} items)`);
    const limits = await (await fetch(`https://api.apify.com/v2/users/me/limits?token=${token}`)).json();
    const d = limits?.data ?? {};
    console.log(
      `▸ account now:   $${(d.current?.monthlyUsageUsd ?? 0).toFixed(2)} / $${d.limits?.maxMonthlyUsageUsd ?? "?"}`,
    );
  } catch {
    console.log("\n(could not read run usage — check the console)");
  }
  console.log(`\nreport → ${resolve(OUT_DIR, "free-subtitles-report.txt")}`);
}

main().catch((e) => {
  console.error("SPIKE FAILED:", e?.message ?? e);
  process.exit(1);
});
