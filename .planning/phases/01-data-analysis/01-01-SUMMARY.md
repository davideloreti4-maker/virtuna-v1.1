---
phase: 01-data-analysis
plan: 01
subsystem: data-analysis
tags: [supabase, tiktok, weighted-engagement, virality, creator-size, velocity, statistics, typescript, apify]

# Dependency graph
requires: []
provides:
  - calibration-baseline.json with algorithm-aligned weighted engagement scoring
  - Creator size normalization (nano→mega tiers, size-adjusted WES, views/follower breakout signal)
  - View velocity analysis (views/day as traction proxy)
  - Save rate (bookmarks/views) as high-intent signal
  - 5 virality tiers based on weighted engagement score
  - Viral vs average differentiators ordered by algo weight
  - Data analysis report with 12 sections
  - Apify data import script for both apidojo and clockworks scraper formats
affects: [02-gemini-prompts, 03-deepseek-cot, 05-aggregation-formula, 10-ml-training, 12-calibration]

# Tech tracking
tech-stack:
  added: [dotenv, tsx (script runner), apify-client]
  patterns: [paginated Supabase fetch with service role, percentile-based statistical analysis, dual-format Apify import]

key-files:
  created:
    - scripts/analyze-dataset.ts (990 lines — analysis with 12-step pipeline)
    - scripts/import-apify-data.ts (241 lines — dual-format Apify importer)
    - src/lib/engine/calibration-baseline.json (968 lines — machine-readable patterns)
    - .planning/phases/01-data-analysis/data-analysis-report.md (221 lines — human-readable report)
  modified:
    - package.json (added "analyze" script)

key-decisions:
  - "Algorithm-aligned weighted engagement: (likes×1 + comments×2 + shares×3) / views mirrors TikTok 2025 point system"
  - "Share rate is #1 measurable virality KPI — viral threshold at 1.83% (p90)"
  - "Save rate (bookmarks/views) added as high-intent signal — viral videos 217% higher"
  - "Creator size normalization via 5 tiers (nano<10K, micro<100K, mid<500K, macro<1M, mega>1M)"
  - "Views/follower ratio as breakout signal — nano creators reach 28x audience, mega only 0.94x"
  - "View velocity (views/day) as traction proxy — p50=1,633, p90=57K"
  - "Hashtags/sounds demoted to context signals — NOT primary algo ranking factors"
  - "Dual-format Apify import supports both apidojo and clockworks TikTok scraper output"

patterns-established:
  - "Standalone scripts use direct @supabase/supabase-js createClient (not SSR variant)"
  - "Scripts load .env.local via dotenv config path"
  - "Statistical analysis uses linear interpolation for percentile computation"
  - "Apify runs imported with upsert on platform+platform_video_id conflict"

# Metrics
duration: ~45min (including research + 3 iterations)
completed: 2026-02-16
---

# Phase 1 Plan 1: Algorithm-Aligned TikTok Data Analysis

**Mined 7,321 TikTok videos with algorithm-aligned weighted engagement scoring: 5 tiers, creator size normalization, view velocity, save rate, and share rate as #1 virality signal**

## Commits

1. `026659c` — feat(01-01): build and run TikTok data analysis script (initial)
2. `3a294f1` — chore(01-01): validate outputs and add analyze script
3. `3cff710` — feat(01-01): algorithm-aligned calibration baseline using TikTok 2025 point system
4. `0d7594d` — feat(01-01): add creator size, view velocity, and save rate layers

## Key Findings

### Weighted Engagement Score
- Formula: `(likes×1 + comments×2 + shares×3) / views`
- p50: 9.54%, p90: 23.97%
- Viral videos have 704% higher WES than average

### Top Differentiators (viral vs average)
| Signal | Algo Weight | Viral vs Average |
|--------|-------------|-----------------|
| Share rate | 3x | +1,163% |
| Comment rate | 2x | +1,255% |
| Save rate | High intent | +217% |
| Like rate | 1x | +574% |

### Creator Size Impact (4,028 videos with follower data)
| Tier | WES | Share Rate | Views/Follower |
|------|-----|------------|----------------|
| Nano (<10K) | 7.60% | 0.26% | 27.98x |
| Micro (10K-100K) | 9.67% | 0.37% | 10.52x |
| Mid (100K-500K) | 8.95% | 0.34% | 4.69x |
| Macro (500K-1M) | 8.57% | 0.31% | 2.06x |
| Mega (1M+) | 8.38% | 0.21% | 0.94x |

### View Velocity
- p50: 1,633 views/day, p90: 57,017 views/day
- Weakly correlated with WES (r=-0.0008) — content quality > timing

### Data Pipeline
- 7,389 videos imported from 79+ Apify runs (apidojo/tiktok-scraper)
- Dual-format import handles both apidojo and clockworks scraper outputs
- Follower count, verified status, bookmarks, upload date captured in metadata

## Next Phase Readiness
- `calibration-baseline.json` ready for Phase 2 (Gemini prompt calibration anchors)
- Algorithm signal weights ready for Phase 3 (DeepSeek CoT weighted reasoning)
- Creator size tiers ready for Phase 5 (size-normalized aggregation)
- Full distribution stats + velocity data ready for Phase 10 (ML features)
- No blockers for downstream phases

---
*Phase: 01-data-analysis*
*Completed: 2026-02-16*
