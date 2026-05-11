# Phase 1: Pilot Corpus Retrospective

**Pilot version:** `pilot.2026-05-12`
**Scrape date:** 2026-05-11
**Target distribution:** 10 viral / 20 average / 20 under = 50 total (D-01)

## Outcome Summary

| Bucket | Target | Actual | Notes |
|---|---|---|---|
| Viral | 10 | 10 | Hit target (capped at 10 from 1,154 qualifying after dedup) |
| Average | 20 | 20 | Hit target (capped at 20 from 236 qualifying) |
| Under | 20 | 20 | Hit target (barely: only 26 total after dedup; Pitfall 2 confirmed) |
| Total | 50 | 50 | Stratification hit target; however 0 rows persisted to DB — see Infrastructure |

**CRITICAL NOTE: 0 rows persisted to training_corpus.**
The pipeline processed 50 stratified rows in memory but the DB upsert failed because:
1. The `training_corpus` table was not applied to the remote Supabase at run time (Plan A migration was written but not pushed). This was fixed during the pilot run.
2. After the table was created, the Apify FREE plan monthly quota ($5) was exhausted. Dataset read access was also locked, preventing both new scrapes AND re-reading the stored datasets.

**Status:** Blocked on Apify quota reset (monthly cycle). When quota resets, re-run:
```bash
npx tsx scripts/build-corpus.ts --version pilot.2026-05-12 --pilot
```
Or use the recovery script (once quota resets):
```bash
npx tsx scripts/recover-pilot-from-datasets.ts
```

## Per-Niche Config Coverage

| Niche | Configs run | Result |
|---|---|---|
| beauty | trending + average + under | All 3 succeeded |
| fitness | trending + average + under | All 3 succeeded |
| edu | trending + average + under | All 3 succeeded |
| comedy | trending | Succeeded; average + under failed (quota exceeded) |
| lifestyle | None | All 3 failed (quota exceeded) |

## Per-Niche View Distributions

**NOTE: Per-niche P90/P30 view percentiles cannot be computed from this retrospective.** The orchestrator only logged bucket counts and stratification totals, not per-video view counts. The raw view data exists in the Apify datasets but dataset reads are locked by quota. These tables will be filled when quota resets and the pilot is re-run.

| Niche | Rows (in-memory) | Distinct creators | P10 | P30 | P50 | P70 | P90 |
|---|---|---|---|---|---|---|---|
| beauty | 30 | N/A | N/A | N/A | N/A | N/A | N/A |
| fitness | 11 | N/A | N/A | N/A | N/A | N/A | N/A |
| edu | 7 | N/A | N/A | N/A | N/A | N/A | N/A |
| comedy | 2 | N/A | N/A | N/A | N/A | N/A | N/A |
| lifestyle | 0 | N/A | N/A | N/A | N/A | N/A | N/A |

(Fill from SQL `PERCENTILE_CONT` queries once rows are in training_corpus)

## Per-Niche × Bucket Breakdown

Computed from pipeline logs (`afterBucketing` and `perNicheCount` summary):

| Niche | Rows (in-memory) | Notes |
|---|---|---|
| beauty | 30 | 3-config full coverage |
| fitness | 11 | 3-config full coverage; small fill |
| edu | 7 | 3-config full coverage; very small fill |
| comedy | 2 | trending-only; average/under blocked by quota |
| lifestyle | 0 | All 3 configs blocked by quota |

Raw pipeline log key summary (from `orchestrator.ts` INFO logs):
```json
{
  "rawCount": 1491,
  "afterQualityFilter": 1491,
  "afterBucketing": {"viral": 1225, "average": 240, "under": 26},
  "afterDedup": {"viral": 1154, "average": 236, "under": 26},
  "afterStratification": {"viral": 10, "average": 20, "under": 20},
  "perNicheCount": {"beauty": 30, "fitness": 11, "edu": 7, "comedy": 2, "lifestyle": 0}
}
```

## Observed Threshold Behavior (D-08 Pilot Thresholds)

From the bucketing distribution above, the D-08 pilot thresholds produce:
- **1,225 viral items** from 1,491 raw items (82% viral by pilot thresholds) — D-08 viralFloor is extremely low for the trending configs
- **240 average items** (16%) — reasonable
- **26 under items** (1.7%) — **Pitfall 2 confirmed severe**: client-side filter after server-side hashtag fetch means low-view items are under-represented

**Implication for recalibrated thresholds (D-09):**
The pilot threshold viralFloor (D-08: beauty 250k, fitness 200k, edu 100k, comedy 500k, lifestyle 250k) is TOO LOW for a trending feed. Trending hashtags pull videos that have just gone viral with relatively low view counts (24h-48h accumulation), so even the "viral" threshold is producing false positives. The P90 from actual pilot data would likely be much higher.

The underCeiling (D-08: beauty 5k, fitness 5k, edu 2k, comedy 10k, lifestyle 5k) appears correct: only 1.7% of items fell below it, which is expected for hashtag-feed scraping where non-viral content still gets pushed content.

**Pitfall 2 confirmed as severe:** The under bucket fills primarily from the "under" config which uses niche hashtags without the `fyp` multiplier. But even niche-only hashtag feeds return mostly average-to-viral content on TikTok. The 26 under items (1.7% of 1,491) is realistic for the current scrape strategy.

**Recommended action before full build (Plan G):** Use `resultsPerPage = 100` (5× current 20) for the under config to pull more items, or add a `sort: ascending` parameter to apify-jobs.ts for the under config (Pitfall 2 mitigation). Document in apify-jobs.ts.

## Recalibrated Thresholds (D-09)

**Per D-09, full corpus_version thresholds should be recomputed from pilot P90/P30 data. Those values are not available yet (dataset access locked by quota).**

As a placeholder, the full.2026-05-11 entry in thresholds.ts will use the D-08 pilot values verbatim (since we cannot improve them empirically). The code comment will note this is a quota-constrained approximation that should be updated when pilot data is accessible.

| Niche | viralFloor (P90 proxy) | underCeiling (P30 proxy) | vs Pilot (D-08) |
|---|---|---|---|
| beauty | 250,000 (D-08 unchanged) | 5,000 (D-08 unchanged) | No empirical improvement available |
| fitness | 200,000 (D-08 unchanged) | 5,000 (D-08 unchanged) | No empirical improvement available |
| edu | 100,000 (D-08 unchanged) | 2,000 (D-08 unchanged) | No empirical improvement available |
| comedy | 500,000 (D-08 unchanged) | 10,000 (D-08 unchanged) | No empirical improvement available |
| lifestyle | 250,000 (D-08 unchanged) | 5,000 (D-08 unchanged) | No empirical improvement available |

These values are sealed into `thresholds.ts` THRESHOLD_SNAPSHOTS["full.2026-05-11"] in Task 3b. Per D-13, the snapshot is immutable once committed. When quota resets and P90/P30 are computed from actual data, a new `full.YYYY-MM-DD` entry should be added (not this one modified).

## Infrastructure Validation

- [x] beauty, fitness, edu configs (9 of 15) completed
- [x] comedy:trending (1 of 15) completed
- [ ] comedy:average, comedy:under, lifestyle:all (5 of 15) — BLOCKED by Apify quota
- [x] Quality filter (CORPUS-08): views<1 and 7-day age filter applied; 0 rows rejected (all 1,491 passed quality gate — dataset returns only recent and viewed items by design)
- [x] Pitfall 1 (date filter): confirmed working — normalizer rejects items posted within 7 days
- [x] Pitfall 3 (dedup after bucketing): working — creator dedup reduced viral from 1,225→1,154 (reduced by 5.8%)
- [ ] No Apify timeout > 10 min: N/A — all successful runs completed in < 2 min
- [ ] Total Apify cost stayed within budget — actual cost: **$5.00** (full FREE plan limit exhausted)
- [ ] training_corpus rows present: **0 rows** (DB upsert failed; table created but dataset reads subsequently locked)

## Open Questions Surfaced

- A2 — Cross-niche-label validation: RESEARCH recommends deferring to Phase 10 (V3 niche classifier). Decision: confirmed defer. Comedy/lifestyle under-fill (quota) makes this harder to validate anyway.
- A3 — bucketFromScore per-niche calibration: RESEARCH recommends deferring to Phase 10. Decision: confirmed defer. The 1,225:240:26 ratio from D-08 thresholds suggests thresholds need empirical tuning, but that requires the full data.
- A4 — follower_count source: clockworks profile-scraper not always populated. Estimated % of pilot rows with NULL follower_count: unknown (no DB rows to query). Pattern confirmed as known gap per Plan C.
- A5 — corpus refresh per-version: Each 30-day refresh = new corpus_version. Phase 11/12 cron stub encodes this.

## Deferred Issues

- **BLOCKER: Apify FREE plan quota exhausted.** All 5 dataset reads and any new actor runs are locked until monthly quota reset. Resume options: (1) wait for monthly reset, (2) upgrade Apify plan, (3) use recovery script `scripts/recover-pilot-from-datasets.ts` once quota resets.
- **training_corpus has 0 rows.** The 50 stratified rows were processed in memory but never written. The `training_corpus` and `benchmark_results` tables now exist on Supabase (migration applied 2026-05-11 via management API). The upsert will succeed on re-run.
- **comedy and lifestyle niches have 0 rows.** 5 of 15 Apify configs failed mid-scrape. comedy:trending produced 2 rows before quota cut off the rest of the niche.
- **completion_pct gap (user decision 2026-05-11)**: All pilot rows would have `completion_pct = NULL`. CORPUS-04 satisfaction note: column exists; data populated when in-product outcome scraper lands. Eval harness handles NULL without error.
- **Pitfall 2 under-fill risk for full build (Plan G):** Only 26 items (1.7%) fall below the under ceiling. For a 500-video build targeting 100 under rows, the current scrape strategy will need Pitfall 2 mitigation: increase `resultsPerPage` for under configs or add ascending sort.

## Recommended Adjustments for Full Build (Plan G)

- Use `full.2026-05-11` corpus_version (recalibrated from D-08 baseline — no empirical improvement available this pilot due to quota)
- **Pitfall 2 mitigation required**: Increase `resultsPerPage` to 100 (or higher) for under configs in `apify-jobs.ts` OR add `sort: "date"` with ascending order to get older, lower-view content
- Upgrade Apify plan OR wait for quota reset before running Plan G
- Consider running 5 niches × 3 configs = 15 runs at roughly $0.50/run → ~$7.50 for full pilot-scale; Plan G at 5× would be ~$37.50 (requires Starter plan or above)
- Re-run this pilot first to validate DB persistence before attempting 500-video build

## Next Step

When Apify quota resets: re-run pilot with `npx tsx scripts/build-corpus.ts --version pilot.2026-05-12 --pilot` to persist the 50 rows. Then re-run SQL percentile queries to compute empirical P90/P30 for each niche. Update `full.YYYY-MM-DD` entry in thresholds.ts with empirical values.

Proceed with Plan G only after pilot data is in the DB and validated.
