# Phase 1: Training Corpus & Eval Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-11
**Phase:** 1-Training Corpus & Eval Foundation
**Areas discussed:** Corpus discovery, Outcome bucketing, Primary accuracy metric, Target threshold rule

---

## Pre-decision (from initial area selection)

**User-injected constraint:** "for corpus we'll test with 50 videos and then go to the 50" (interpreted as 500). Locked as: phased build — 50-video pilot validates infrastructure end-to-end, then 500-video full corpus with calibrated thresholds derived from pilot data.

---

## Corpus Discovery

| Option | Description | Selected |
|--------|-------------|----------|
| Trending feeds per niche | Apify trending scraper across ≥5 niches; naturally biased toward outcomes we want to predict; underperformers underrepresented | ✓ |
| Existing competitor pool | Reuse `competitor_videos` table; zero new scraping infra; niches uneven | |
| Hashtag-driven scrape | Per-niche hashtag list; balanced niche control; hashtag-to-niche curation overhead | |
| Hybrid (trending + bottom-percentile sweep) | Trending for viral/avg + dedicated low-view scrape for under; full distribution; two actor configs | |

### Underperformer Sourcing (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Same creators, low-engagement back-catalog | After identifying viral/avg from trending, scrape same creators' last N videos | ✓ (initially) → REPLACED |
| Separate hashtag scrape sorted by views ascending | Apify search by niche hashtag, sort by lowest views | |
| Mixed — 50/50 split | Hedge against either-source bias | |

**Mid-discussion correction:** During bucketing follow-up, agent re-evaluated and acknowledged the back-catalog approach was over-engineered — it biases viral pool toward creators with high variance (serial-creators with back-catalog flops) and under-represents one-hit-wonders, a huge fraction of real TikTok virality. Replaced with **per-bucket independent sourcing** (trending feeds for viral, mid-range hashtag for average, dedicated low-views hashtag sweep for under). The independent-sourcing version is what's locked in CONTEXT.md (D-02).

### Niche Set

| Option | Description | Selected |
|--------|-------------|----------|
| Beauty / Fitness / Edu / Comedy / Lifestyle | Matches PROJECT.md multi-niche set; broad TikTok genre coverage | ✓ |
| Replace one with Food | Food is huge on TikTok, behaves differently; swap out Lifestyle | |
| Add 2 more — 7 niches total | Add Food + Tech; weaker per-niche statistics in pilot | |

### Min Video Age

| Option | Description | Selected |
|--------|-------------|----------|
| 7 days | Engagement curve plateaus by day 5–7 | ✓ |
| 14 days | Safer plateau; corpus drifts older | |
| 48 hours | Aggressive; many videos still in growth phase | |

### Creator Diversity Cap

| Option | Description | Selected |
|--------|-------------|----------|
| Max 3 videos per creator | ≥34 distinct creators in viral bucket; forces content-quality signal | ✓ |
| Max 5 per creator | Easier to fill buckets | |
| No cap | Take whatever trending returns | |

---

## Outcome Bucketing

### Bucket Rule (initial round)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-niche engagement-rate percentiles | (likes+5×comments+10×shares+8×saves)/followers_at_post; top 10% per niche | (initially recommended) — REJECTED |
| Per-niche view percentiles (likes-adjusted) | views/followers ratio per niche; simpler | |
| Absolute thresholds per niche | Hand-tuned per niche; brittle | |
| Composite outcome score | Weighted TikTok-algo proxy; depends on completion% | |

**User's pushback:** "i dont know 1 seems too exaggerated no? a video could have 10m view but now [not] the best metrics but still be underperformer". Surfaced the critical insight that engagement-rate-per-follower can mislabel high-reach videos.

### Bucket Rule (re-do round)

| Option | Description | Selected |
|--------|-------------|----------|
| Views-relative-to-niche | viral = views ≥ niche P90; under = views ≤ P40 | (initially recommended) |
| Composite: 0.6×views_pct + 0.4×engagement_pct | Weighted blend of reach + quality | |
| Views-relative + engagement floor | viral = views ≥ P90 AND engagement ≥ median; under = views ≤ P40 OR engagement ≤ P15 | |
| Pure views in niche | viral = top 100 by views per niche; bottom 200 = under | |

**User followed up:** "should we just scrape videos under 10k views for example? in addition to the viral ones. think about this honestly whats the best solution"

### Bucket Rule (final synthesis — agent acknowledged over-engineering)

After user pushed for honest analysis, agent revised approach. Locked decision: **per-niche absolute view thresholds** (D-07/D-08) + per-bucket independent sourcing (D-02). Pilot thresholds are loose starting points; empirical recalibration after pilot scrape using niche P90 / P30 produces the full-corpus thresholds.

| Option | Description | Selected |
|--------|-------------|----------|
| Per-niche absolute thresholds + independent sourcing per bucket | 3 Apify configs per niche × 5 niches = 15 small scrapes; pilot uses loose starting numbers, recalibrate from pilot data | ✓ |
| Same approach, tune the numbers | | |
| Keep back-catalog approach | | |

User added: "yes makes sense analyze tho right threshholds?" — Agent admitted uncertainty about specific numbers, proposed pilot-as-empirical-calibrator approach. User accepted.

### Threshold Refresh

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed snapshot per corpus version | Compute boundaries once when corpus is sealed; tag with corpus_version | ✓ |
| Recompute on every refresh | Each 30-day refresh recomputes percentiles; engine comparisons become moving targets | |
| Fixed with overlap window | Carry over last cohort's boundaries until distribution drift exceeds threshold | |

### Borderline Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Exclude the gray zone | Discard 8–12% / 38–42% windows; cleaner labels | (initially recommended) — REJECTED |
| Include all, label with confidence weight | Every video gets label + confidence; eval weights samples | |
| Hard cutoff, no exclusion | Pure percentile cutoff; nothing dropped | ✓ (after user pushback) |

**User's pushback:** "i dont think excluding is the right workaround?" — Agent agreed, re-presented options without exclusion, user chose hard cutoff.

### Bucketing Logic Location

| Option | Description | Selected |
|--------|-------------|----------|
| TypeScript classifier in src/lib/engine/corpus/ | Importable, Vitest-testable, version-controlled with engine | ✓ |
| Computed column in Postgres | Generated column; can't reference cross-row percentiles | |
| Materialized view refreshed on corpus update | View joins corpus + niche-percentile lookup | |

### Corpus Version Identifier

| Option | Description | Selected |
|--------|-------------|----------|
| Semver-style per build (pilot.2026-05-11, full.2026-05-25) | Every benchmark_results row tagged with corpus_version + engine_version | ✓ |
| Date-only | Simpler; pilot vs full distinction lost | |
| Hash-based | Deterministic but not human-readable | |

---

## Primary Accuracy Metric

### Primary Gate Metric

| Option | Description | Selected |
|--------|-------------|----------|
| Macro-F1 on 3-class bucket | Averages F1 across viral/avg/under classes; handles class imbalance | ✓ |
| Viral-vs-non-viral AUC | Binary; matches actionable user question; collapses 3-bucket signal | |
| Spearman rank correlation within niche | Ranking quality; doesn't say if absolute predictions are useful | |
| MAE on engagement-rate | Continuous error; doesn't measure bucket fit | |

**User's note:** "i think 1 is fine but it could be more accurate in specific domains no?" — produced the per-niche floor refinement.

### Per-Niche Floor on the Gate

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — add per-niche floor (5pp regression cap) | Global macro-F1 ↑ AND every niche within 5pp of v2.1 | ✓ |
| Yes, but looser floor (10pp) | More permissive | |
| Track per-niche but don't gate on it | Report-only | |

### Secondary Metrics Tracked

User selected:
- ✓ Calibration ECE + per-class precision/recall
- ✓ Per-signal contribution + cost per analysis
- ✓ Spearman ρ + engagement MAE
- (rejected) Confusion matrix only — too minimal

### Additional Report Content (multi-select)

User selected all four:
- ✓ Failure case curation (top 10 mispredictions per run with pipeline trace)
- ✓ Per-stage latency p50/p95/p99 + cost breakdown
- ✓ Drift detector across corpus versions
- ✓ Viral recall + under precision focus

**User's open question:** "anything else we should do?" — agent surfaced the four above, user took all.

---

## Target Threshold Rule

### Acceptance Threshold Formula

| Option | Description | Selected |
|--------|-------------|----------|
| Relative improvement + statistical significance | ≥X% relative AND bootstrap p < 0.05 (≥200 iterations) | ✓ |
| Absolute improvement floor | Macro-F1 ≥ 0.05 absolute; not scale-invariant | |
| Statistical significance only | Rigorous but doesn't require meaningful improvement | |
| Tiered ship-criteria | Ship/iterate/reject thresholds; needs pre-commitment | |

### Adaptive Relative Target Based on Baseline

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — sliding scale | ≤0.40 → 15%; 0.40–0.55 → 10%; >0.55 → 7% + significance | ✓ |
| No — fixed 15% regardless | Could be infeasibly ambitious for strong baselines | |
| Fixed 10% with stronger significance | Middle ground; doesn't solve diminishing returns | |

### Persistence Location

| Option | Description | Selected |
|--------|-------------|----------|
| Both — .planning/research/v2.1-baseline.md + eval-config.ts | Doc for reasoning, code for runtime constants, cross-linked | ✓ |
| Doc only | Code has to read or hardcode | |
| Code only | Less human-readable rationale | |

### Phase 1 Deliverable

| Option | Description | Selected |
|--------|-------------|----------|
| Baseline report + locked threshold formula | v2.1-baseline.md + eval-config.ts constants + seeded benchmark_results row | ✓ |
| Baseline only — threshold deferred to Phase 12 | "Moving the bar later" anti-pattern risk | |
| Threshold formula only | Baseline measured but report deferred; harder for downstream agents | |

---

## Claude's Discretion

Decisions deferred to research / planning agents:
- Apify scraper module structure (extend `src/lib/scraping/` vs scaffold `src/lib/scraping/corpus/`)
- Eval harness CLI (`tsx scripts/eval.ts`) vs API endpoint
- Bootstrap method (paired vs unpaired)
- Failure case curation storage (Supabase table vs JSON files in `.planning/benchmarks/`)

## Deferred Ideas

Captured in CONTEXT.md `<deferred>` section:
- Drift-aware adaptive thresholds across corpus versions
- Confidence-weighted labels (revisit if hard cutoffs cause noise)
- Outcome auto-scraper for in-product analyses (out-of-scope per PROJECT.md)
- Four-class bucketing system (overengineered for sample size)
- Re-niching the corpus if pilot data reveals weak per-niche signal
- Eval harness public dashboard / Studio page
