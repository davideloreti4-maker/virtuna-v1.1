/**
 * probe-receipt-coverage.ts — how often does a materialized receipt actually carry a NUMBER?
 *
 * D9 says a multiplier with no nameable basis does not print. `materializeReceipts` enforces that
 * via `hasKnownBaseline`. This counts, across the real `outlier_teardowns` table, how many rows a
 * `proof_strip` could resolve to and how many of those would render with a number — which decides
 * whether "proven structure beside no number" is an edge case or the default.
 *
 * Run: `npx tsx scripts/probe-receipt-coverage.ts`
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { getCorpusClient } = await import("@/lib/grounding/corpus");
  const { hasKnownBaseline } = await import("@/lib/grounding/retrieve");
  const { MAX_PRINTABLE_MULTIPLIER, MIN_OUTLIER_MULTIPLIER } = await import("@/lib/grounding/outlier-gate");

  const supabase = getCorpusClient();
  const { data, error } = await supabase
    .from("outlier_teardowns")
    .select("id, creator_handle, outlier_multiplier, views, baseline_label, cover_url, video_url");

  if (error || !data) {
    console.error("query failed:", error?.message);
    process.exit(1);
  }

  const rows = data as Array<{
    creator_handle: string | null;
    outlier_multiplier: number | null;
    views: number | null;
    baseline_label: string | null;
    cover_url: string | null;
    video_url: string | null;
  }>;

  const total = rows.length;
  const attributable = rows.filter((r) => r.creator_handle);          // no handle ⇒ no receipt at all
  const basisKnown = attributable.filter((r) => hasKnownBaseline({ baseline_label: r.baseline_label }));
  const withNumber = basisKnown.filter(
    (r) => typeof r.outlier_multiplier === "number" && Number.isFinite(r.outlier_multiplier) && r.outlier_multiplier > 0,
  );
  const inBand = withNumber.filter(
    (r) => r.outlier_multiplier! >= MIN_OUTLIER_MULTIPLIER && r.outlier_multiplier! <= MAX_PRINTABLE_MULTIPLIER,
  );
  const withViews = attributable.filter((r) => typeof r.views === "number" && r.views! > 0);
  const withCover = attributable.filter((r) => r.cover_url);
  const withVideo = attributable.filter((r) => r.video_url);

  const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;
  console.log(`outlier_teardowns rows                       ${total}`);
  console.log(`  → resolve to a receipt at all (handle)     ${attributable.length}  ${pct(attributable.length)}`);
  console.log(`  → basis known (baseline_label)             ${basisKnown.length}  ${pct(basisKnown.length)}`);
  console.log(`  → would PRINT a multiplier                 ${withNumber.length}  ${pct(withNumber.length)}`);
  console.log(`     of those, inside the ${MIN_OUTLIER_MULTIPLIER}–${MAX_PRINTABLE_MULTIPLIER}× band       ${inBand.length}`);
  console.log(`  → carry a view count                       ${withViews.length}  ${pct(withViews.length)}`);
  console.log(`  → carry a cover image                      ${withCover.length}  ${pct(withCover.length)}`);
  console.log(`  → carry a video url                        ${withVideo.length}  ${pct(withVideo.length)}`);

  const labels = new Map<string, number>();
  for (const r of rows) labels.set(String(r.baseline_label), (labels.get(String(r.baseline_label)) ?? 0) + 1);
  console.log("\nbaseline_label values:");
  for (const [label, n] of [...labels].sort((a, b) => b[1] - a[1])) console.log(`  ${n.toString().padStart(4)}  ${label}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
