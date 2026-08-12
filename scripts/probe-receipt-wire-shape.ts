/**
 * probe-receipt-wire-shape.ts — do Discover and the composed card print the SAME number for the
 * same row, against the real corpus? The live half of the B1 one-band rule (Task 9).
 *
 * Two surfaces read `outlier_teardowns.outlier_multiplier` through different mappers:
 * `discover/corpus-reads.ts` normalizes with `num()` and clamps; `tools/composed-card-receipt.ts`
 * guards with `typeof m !== "number"` and clamps. Unit tests on both sides supply their own
 * fixtures, so nothing but this probe has ever compared them on a real row.
 *
 * MEASURED 2026-08-12 (the reason this probe exists — the first hypothesis was wrong):
 *   - `outlier_multiplier` is a Postgres `numeric`, and the SQL/MCP console renders it QUOTED,
 *     which reads exactly like PostgREST's string serialization. Through supabase-js it arrives
 *     as a JS **number** (`typeof number`), so the receipt seam's `typeof` guard is not a bug.
 *     Do not "fix" it off the console output — measure with this probe.
 *   - `views` is `bigint` and also arrives as a number.
 *   - A 1328.6× row clamps to 100 on BOTH surfaces. That is B1 holding end to end.
 *
 * Exit code is the assertion: 0 = every sampled row agrees, 1 = the two surfaces disagree.
 *
 * Run: `npx tsx scripts/probe-receipt-wire-shape.ts`
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { materializeReceipts } = await import("@/lib/tools/composed-card-receipt");
  const { toCorpusVideo } = await import("@/lib/discover/corpus-reads");
  const { getCorpusClient } = await import("@/lib/grounding/corpus");

  const supabase = getCorpusClient();
  const { data, error } = await supabase
    .from("outlier_teardowns")
    .select("id, creator_handle, outlier_multiplier, baseline_label, views")
    .not("creator_handle", "is", null)
    .not("baseline_label", "is", null)
    .gte("outlier_multiplier", 3)
    .limit(5);

  if (error || !data?.length) {
    console.error("no printable row available:", error?.message ?? "none matched");
    process.exit(1);
  }

  console.log("── raw wire shape, straight off PostgREST ──");
  for (const r of data as Array<Record<string, unknown>>) {
    console.log(
      `  ${String(r.id).slice(0, 8)}  outlier_multiplier=${JSON.stringify(r.outlier_multiplier)} ` +
        `(typeof ${typeof r.outlier_multiplier})  views=${JSON.stringify(r.views)} (typeof ${typeof r.views})`,
    );
  }

  const ids = (data as Array<{ id: string }>).map((r) => r.id);
  const receipts = await materializeReceipts(ids, { supabase });

  console.log("\n── what each surface prints for the same row ──");
  let mismatches = 0;
  for (const r of data as Array<Record<string, unknown>>) {
    const id = String(r.id);
    const receipt = receipts.get(id);
    // Discover reads the same column through its own mapper.
    const discover = toCorpusVideo({
      id,
      video_url: null,
      cover_url: null,
      creator_handle: r.creator_handle as string | null,
      spoken_hook: null,
      hook_template: null,
      hook_archetype: null,
      niche: null,
      views: r.views as number | null,
      platform: null,
      engagement_rate: null,
      posted_at: null,
      outlier_multiplier: r.outlier_multiplier as number | string | null,
      baseline_label: r.baseline_label as string | null,
    });
    const agree = receipt?.multiplier === discover.multiplier;
    if (!agree) mismatches++;
    console.log(
      `  ${id.slice(0, 8)}  card=${JSON.stringify(receipt?.multiplier ?? null)} ` +
        `discover=${JSON.stringify(discover.multiplier)}  ${agree ? "agree" : "🔴 DISAGREE"}`,
    );
  }

  console.log(`\n${mismatches} of ${data.length} rows disagree between the two surfaces.`);
  process.exit(mismatches === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
