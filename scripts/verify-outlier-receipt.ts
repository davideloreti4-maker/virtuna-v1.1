/**
 * verify-outlier-receipt.ts — run the REAL Discover/Explore tile path over a REAL Apify
 * payload and print what a creator would actually see.
 *
 * The unit tests use hand-copied figures; this runs the shipped composition
 * (`rankOutliers` → `attachOutlierReceipt`, exactly as /api/discover does) over the raw
 * dump captured by `probe-author-baseline-coverage.ts`, so the numbers below are the ones
 * the route would emit for that pull.
 *
 * Costs $0.00 — reads the dump, no network.
 *
 * Run:
 *   node node_modules/tsx/dist/cli.mjs scripts/verify-outlier-receipt.ts <dump.json>
 */
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";

const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

/* eslint-disable @typescript-eslint/no-require-imports */
const { rankOutliers } = require("@/lib/discover/outlier-compute");
const { attachOutlierReceipt } = require("@/lib/discover/outlier-receipt");

const DUMP = process.argv[2];
if (!DUMP) throw new Error("usage: verify-outlier-receipt.ts <dump.json>");

/** Mirrors outlier-tile.tsx's formatMultiplier + its badge-or-nothing rule. */
function badge(multiplier: number | null, label: string | null): string {
  if (multiplier == null || !label) return "— (no badge)";
  if (!Number.isFinite(multiplier) || multiplier <= 0) return "— (no badge)";
  const v = multiplier >= 10 ? `${Math.round(multiplier)}×` : `${multiplier.toFixed(1)}×`;
  return `${v} ${label}`;
}

interface Row {
  label: string;
  mode: "profile" | "niche";
  videos: Array<Record<string, unknown>>;
}

const dump: Row[] = JSON.parse(readFileSync(DUMP, "utf-8"));
let failures = 0;

for (const set of dump) {
  const videos = set.videos.map((v) => ({ ...v, postedAt: new Date(v.postedAt as string) }));
  console.log(`\n${"═".repeat(84)}\n${set.label} — mode=${set.mode}, ${videos.length} raw posts\n${"═".repeat(84)}`);

  // EXACTLY what /api/discover/route.ts does.
  const tiles = attachOutlierReceipt(rankOutliers(videos, set.mode).slice(0, 30), set.mode);
  if (tiles.length === 0) {
    console.log("(no tiles — everything fell outside the 90-day window)");
    continue;
  }

  console.log(`  ${"caption".padEnd(30)} ${"views".padStart(9)}   what the tile SHOWS`);
  for (const t of tiles.slice(0, 12)) {
    const cap = String(t.caption || t.platformVideoId).replace(/\s+/g, " ").slice(0, 30);
    console.log(`  ${cap.padEnd(30)} ${String(t.views).padStart(9)}   ${badge(t.multiplier, t.baselineLabel)}`);
  }

  const withBadge = tiles.filter((t: { multiplier: number | null }) => t.multiplier != null).length;
  console.log(`\n  badge coverage: ${withBadge}/${tiles.length}`);

  // ── The invariant the whole change exists to enforce ────────────────────────
  const sizes = [tiles.length, Math.ceil(videos.length / 2), Math.ceil(videos.length / 3)];
  const seen = new Map<string, Set<string>>();
  const multipliers = new Map<string, number[]>();
  for (const n of sizes) {
    const subset = videos.slice(0, Math.max(1, n));
    for (const t of attachOutlierReceipt(rankOutliers(subset, set.mode), set.mode)) {
      const key = t.platformVideoId as string;
      if (!seen.has(key)) seen.set(key, new Set());
      seen.get(key)!.add(badge(t.multiplier, t.baselineLabel));
      if (typeof t.multiplier === "number") {
        multipliers.set(key, [...(multipliers.get(key) ?? []), t.multiplier]);
      }
    }
  }
  const drifted = [...seen.entries()].filter(([, values]) => values.size > 1);
  if (drifted.length === 0) {
    console.log(`  ✅ every video prints the SAME badge at pull sizes ${sizes.join("/")} — N-invariant`);
    continue;
  }

  // Quantify: the badge's spread across pull sizes, as a share of its largest reading.
  const spread = Math.max(
    ...[...multipliers.entries()]
      .filter(([, xs]) => xs.length > 1)
      .map(([, xs]) => (Math.max(...xs) - Math.min(...xs)) / Math.max(...xs)),
    0,
  );

  console.log(
    `\n  ⚠️  ${drifted.length}/${seen.size} video(s) print a different badge at a different pull size` +
      ` — worst spread ${(spread * 100).toFixed(1)}%`,
  );
  for (const [id, values] of drifted.slice(0, 4)) console.log(`     ${id}: ${[...values].join("  ≠  ")}`);

  if (set.mode === "niche") {
    // The cross-creator median bug. This one MUST be dead.
    failures += drifted.length;
    console.log(`  🔴 NICHE mode must be fully N-invariant (views ÷ followers cannot move) — REGRESSION.`);
  } else {
    // KNOWN AND ACCEPTED, not fixed by this change: a profile pull's own-median denominator is
    // the median of the posts that came back, so it still shifts with the sample. It is the
    // SAME arithmetic that shipped before — the switch relabels it, it does not stabilize it.
    // The Phase 1 handoff called this out ("a fixed baseline N would close it") and it is a
    // ~7% wobble against the 830% cross-creator bug. Reported, not failed.
    console.log(
      `  ⚠️  PROFILE mode: known residual, unchanged by this switch (own-median is still a` +
        ` sample statistic). Both call sites use a FIXED SCRAPE_LIMIT=30, so it does not move in` +
        ` production. Closing it needs a fixed baseline N — not in scope here.`,
    );
  }
}

console.log(`\n${"═".repeat(84)}`);
if (failures > 0) {
  console.log(`🔴 FAILED — ${failures} N-dependent badge(s) in NICHE mode`);
  process.exit(1);
}
console.log("✅ PASSED — no niche badge moves with the size of the pull");
