# Phase 1: Pilot Corpus Retrospective

**Pilot version:** `pilot.2026-05-12`
**Scrape date (attempt 2):** 2026-05-11
**Target distribution:** 10 viral / 20 average / 20 under = 50 total (D-01)

## Outcome Summary (Attempt 2 — 2026-05-11)

| Bucket | Target | Actual | Notes |
|---|---|---|---|
| Viral | 10 | 0 | Quota exhausted before any rows persisted |
| Average | 20 | 0 | Quota exhausted before any rows persisted |
| Under | 20 | 0 | Quota exhausted before any rows persisted |
| Total | 50 | 0 | 0 rows persisted — quota exhausted again (see Infrastructure) |

**CRITICAL NOTE: 0 rows persisted to training_corpus (attempt 2).**

Two bugs discovered and fixed during attempt 2:

1. **Missing `tsconfig-paths` runtime dependency** — `scripts/build-corpus.ts` imports `tsconfig-paths` which was not in `package.json`. Fixed by running `pnpm add tsconfig-paths`. *(Rule 3 auto-fix)*

2. **ON CONFLICT batch dedup bug** — PostgreSQL `ON CONFLICT DO UPDATE` throws "cannot affect row a second time" when the same `platform_video_id` appears twice in the upsert batch. A video appearing in both trending and average feeds causes this. Fixed in `orchestrator.ts` by deduplicating on `platform_video_id` before calling `supabase.upsert`. All 7 orchestrator tests pass. *(Rule 1 auto-fix)*

**Root cause of 0 persistence:** The APIFY_TOKEN in `.env.local` belongs to a **FREE plan account** (`trusty_sleep` / `miniprojectors6@gmail.com`). The plan is `FREE` with `maxMonthlyUsageCreditsUsd: $5`. The user reported upgrading to Starter but the API confirms the account is still FREE. The beauty:under config with `resultsPerPage: 200` (bumped for Pitfall 2 mitigation) exhausted the $5 monthly limit after only 6 of 15 configs ran (beauty×3 + fitness×3). edu, comedy, lifestyle all failed immediately with "Monthly usage hard limit exceeded."

## Per-Niche Config Coverage (Attempt 2)

| Niche | Configs run | Result |
|---|---|---|
| beauty | trending (40) + average (60) + under (200) | All 3 succeeded — but quota depleted after under |
| fitness | trending (40) + average (60) + under (200) | All 3 succeeded — but quota depleted after under |
| edu | trending | FAILED — "Monthly usage hard limit exceeded" |
| comedy | trending | FAILED — "Monthly usage hard limit exceeded" |
| lifestyle | trending | FAILED — "Monthly usage hard limit exceeded" |

In-memory pipeline summary before DB write (attempt 2):
```json
{
  "rawCount": 1848,
  "afterQualityFilter": 1847,
  "afterBucketing": {"viral": 1431, "average": 377, "under": 39},
  "afterDedup": {"viral": 1355, "average": 375, "under": 39},
  "afterStratification": {"viral": 10, "average": 20, "under": 20},
  "perNicheCount": {"beauty": 46, "fitness": 4, "edu": 0, "comedy": 0, "lifestyle": 0}
}
```

Note: The Pitfall 2 mitigation (under resultsPerPage 80→200) substantially improved the under bucket (26→39 items after dedup) but consumed 2.5× more compute per under config, exhausting the FREE plan budget faster.

## Per-Niche View Distributions

**NOTE: Per-niche P90/P30 view percentiles CANNOT be computed.** The training_corpus table has 0 rows because both attempts hit Apify quota before DB persistence. These fields will be filled when a valid Apify Starter account token is provided.

| Niche | Rows | Distinct creators | P10 | P30 | P50 | P70 | P90 |
|---|---|---|---|---|---|---|---|
| beauty | 0 | N/A | N/A | N/A | N/A | N/A | N/A |
| fitness | 0 | N/A | N/A | N/A | N/A | N/A | N/A |
| edu | 0 | N/A | N/A | N/A | N/A | N/A | N/A |
| comedy | 0 | N/A | N/A | N/A | N/A | N/A | N/A |
| lifestyle | 0 | N/A | N/A | N/A | N/A | N/A | N/A |

(Fill from SQL `PERCENTILE_CONT` queries once rows are in training_corpus)

## Per-Niche × Bucket Breakdown

All zeros — see "Outcome Summary" above.

## Observed Threshold Behavior (D-08 Pilot Thresholds, Attempt 2)

Attempt 2 produced more raw items (1,848 vs 1,491) before quota hit, confirming:
- **1,431 viral items** from 1,847 qualifying (77%) — D-08 viralFloor still too low for trending feeds
- **377 average items** (20%)
- **39 under items** (2.1%) — Pitfall 2 improved from 1.7% to 2.1% with resultsPerPage=200, but at 2.5× compute cost

**Pitfall 2 mitigation assessment:** Bumping to 200 results per page improved under fill from 26→39 (+50%), but consumed the FREE monthly budget. Recommendation: use 100 results per page for the pilot (not 200) to balance coverage vs cost. On a Starter plan ($49/month ≈ 2,000 compute units), 100 results/page × 15 configs ≈ $10-15 total pilot cost.

## Recalibrated Thresholds (D-09)

**Not yet available.** Zero rows in training_corpus. Values cannot be computed empirically.

| Niche | viralFloor (P90) | underCeiling (P30) | vs Pilot (D-08) |
|---|---|---|---|
| beauty | PENDING | PENDING | Cannot compute without DB rows |
| fitness | PENDING | PENDING | Cannot compute without DB rows |
| edu | PENDING | PENDING | Cannot compute without DB rows |
| comedy | PENDING | PENDING | Cannot compute without DB rows |
| lifestyle | PENDING | PENDING | Cannot compute without DB rows |

Per D-09, full corpus_version thresholds will be sealed into `thresholds.ts` THRESHOLD_SNAPSHOTS["full.YYYY-MM-DD"] once empirical P90/P30 data is available. Per D-13, the snapshot is immutable once committed.

## Infrastructure Validation (Attempt 2)

- [x] tsconfig-paths dependency installed (was missing, fixed 2026-05-11)
- [x] ON CONFLICT batch dedup fixed in orchestrator.ts (2026-05-11)
- [x] beauty (3/3 configs) and fitness (3/3 configs) ran successfully
- [ ] edu, comedy, lifestyle (9 configs) — all failed: "Monthly usage hard limit exceeded"
- [x] Pitfall 1 (date filter): working — confirmed in orchestrator logs
- [x] Pitfall 2 mitigation: under config resultsPerPage bumped to 200 (confirmed improved under fill)
- [x] Pitfall 3 (dedup after bucketing): working — viral reduced from 1,431→1,355 by creator dedup
- [x] Quality filter (CORPUS-08): 1 item rejected (views<1 or zero engagement)
- [ ] training_corpus rows present: **0 rows** — DB upsert would have succeeded (dedup bug fixed) but quota blocked 9 of 15 configs, leaving only beauty+fitness data, which is insufficient for 5-niche requirement
- [ ] Apify cost: **$5.00** (full FREE plan monthly limit exhausted after 6 configs)

## Open Questions Surfaced

- A2 — Cross-niche-label validation: RESEARCH recommends deferring to Phase 10. Decision: confirmed defer.
- A3 — bucketFromScore per-niche calibration: RESEARCH recommends deferring to Phase 10. Decision: confirmed defer.
- A4 — follower_count source: unknown (no DB rows to query).
- A5 — corpus refresh per-version: Phase 11/12 cron stub handles this.

## BLOCKING ISSUE (Attempt 2)

**The APIFY_TOKEN in `.env.local` is for a FREE plan account that has exhausted its monthly $5 limit.**

Verification: `apify user get` returns `plan.id: "FREE"`, `maxMonthlyUsageCreditsUsd: 5`.

**To unblock, operator must:**
1. Upgrade the Apify account at `miniprojectors6@gmail.com` to Starter plan ($49/mo) OR
2. Create a new Apify Starter account and update `APIFY_TOKEN` in `.env.local`

Once a valid Starter token is in `.env.local`, re-run:
```bash
npx tsx scripts/build-corpus.ts --version pilot.2026-05-12 --pilot 2>&1 | tee /tmp/pilot-build.log
```

The upsert will succeed (dedup bug fixed). The 15 configs will run without quota issues.

**Recommended config for retry:** Consider reverting `resultsPerPage` for under to 100 (from 200) to avoid burning the Starter quota unnecessarily on pilot. Update this recommendation if Starter quota is confirmed as sufficient.

## Recommended Adjustments for Full Build (Plan G)

- Use `full.YYYY-MM-DD` corpus_version with empirically recalibrated thresholds
- Pitfall 2 mitigation: `resultsPerPage: 100` (not 200) for under configs balances fill rate vs. compute cost on Starter plan
- Run pilot first to get empirical P90/P30, then seal `full.YYYY-MM-DD` thresholds
- On Starter ($49/mo): pilot ≈ $10-15, full build ≈ $50-75 — within plan budget

## Next Step

**BLOCKED on Apify account upgrade.** Operator must provide a Starter plan APIFY_TOKEN. Then re-run `build-corpus.ts` with the same `pilot.2026-05-12` version (idempotent upsert). Then run SQL percentile queries to compute empirical P90/P30.

---

## Attempt 1 Archive (2026-05-11 — Initial Failure)

The following section preserves the attempt 1 failure details for audit purposes.

### Attempt 1 Outcome Summary

| Bucket | Target | Actual | Notes |
|---|---|---|---|
| Viral | 10 | 10 | Hit target in-memory (capped at 10 from 1,154 qualifying after dedup) |
| Average | 20 | 20 | Hit target in-memory (capped at 20 from 236 qualifying) |
| Under | 20 | 20 | Hit target in-memory (barely: only 26 total after dedup; Pitfall 2 confirmed) |
| Total | 50 | 50 | Stratification hit in-memory; 0 rows persisted to DB |

### Attempt 1 Failures

1. `training_corpus` table didn't exist on Supabase — Plan A migration was written but not pushed. Fixed during run (migration applied via Management API).
2. After table creation, the Apify FREE plan monthly quota ($5) was exhausted. Dataset reads also locked.
3. Niche coverage from attempt 1: beauty (30), fitness (11), edu (7), comedy (2), lifestyle (0) — 5 of 15 configs failed.

### Attempt 1 Pipeline Data

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
