# Data Analysis Report: Scraped TikTok Videos

*Generated: 2026-02-16T09:47:10.093Z*

## 1. Executive Summary

- Analyzed **7'321** unique TikTok videos after deduplication and outlier filtering
- Engagement rates range from 1.50% (p10) to 47.20% (p99), with a median of 8.19%
- Optimal video duration is **50-55s** (highest median engagement rate: 9.91%)
- Viral videos are 34.11% shorter on average (29.46s vs 44.71s)
- 8 "power hashtags" identified (high frequency + above-median engagement)

## 2. Data Quality

| Metric | Count |
|--------|-------|
| Total rows fetched | 7'389 |
| Duplicates removed | 0 |
| Unique videos | 7'389 |
| Null views removed | 0 |
| Zero views removed | 19 |
| Extreme outliers (p99.5+ views) | 37 |
| Null duration removed | 12 |
| Zero duration removed | 0 |
| Total outliers removed | 68 |
| **Final analyzed count** | **7'321** |

Deduplication rate: 0%

## 3. Virality Tiers

| Tier | Label | Score Range | ER Min | ER Max | Videos | % |
|------|-------|-------------|--------|--------|--------|---|
| 1 | Unlikely to perform | 0-25 | 0.000% | 3.792% | 1830 | 25% |
| 2 | Below average | 25-45 | 3.792% | 8.191% | 1830 | 25% |
| 3 | Average | 45-65 | 8.191% | 13.900% | 1830 | 25% |
| 4 | Strong potential | 65-80 | 13.900% | 19.853% | 1098 | 15% |
| 5 | Viral potential | 80-100 | 19.853% | 22583.333% | 733 | 10.01% |

*Thresholds derived from actual engagement rate distribution percentiles (p25, p50, p75, p90).*

## 4. Key Differentiators (Viral vs Average)

Comparison: **Viral** (top 10%, p90+ ER, 733 videos) vs **Average** (p40-p60 ER, 1465 videos)

- **duration_seconds**: Viral videos are 34.11% shorter on average (29.46s vs 44.71s)
- **hashtag_count**: Viral videos use 8.48% fewer hashtags (4.8 vs 5.25)
- **caption_length**: Viral video captions are 31.1% shorter (94.14 vs 136.64 chars)
- **sound_usage_pct**: 99.18% of viral videos have a named sound vs 99.32% of average (0.14% lower)
- **share_ratio**: Viral videos have 878.93% higher share ratio (5.049% vs 0.516%)
- **comment_ratio**: Viral videos have 950.45% higher comment ratio (4.101% vs 0.390%)

## 5. Duration Analysis

**Sweet spot:** 50-55s (median ER: 9.91%)

| Duration | Videos | Median ER |
|----------|--------|-----------|
| 0-5s | 8 | 1.668% |
| 5-10s | 1083 | 8.250% |
| 10-15s | 1452 | 8.722% |
| 15-20s | 1529 | 8.390% |
| 20-25s | 514 | 7.058% |
| 25-30s | 368 | 7.322% |
| 30-35s | 267 | 6.849% |
| 35-40s | 183 | 6.548% |
| 40-45s | 134 | 8.344% |
| 45-50s | 147 | 6.097% |
| 50-55s ** | 130 | 9.914% |
| 55-60s | 173 | 7.903% |
| 60s+ | 1333 | 8.709% |

## 6. Hashtag Analysis

### Top 20 Hashtags

| Rank | Hashtag | Count | Median ER | Power? |
|------|---------|-------|-----------|--------|
| 1 | #fyp | 2897 | 9.570% | Yes |
| 2 | #viral | 1653 | 9.405% | Yes |
| 3 | #foryou | 951 | 8.040% |  |
| 4 | #contentcreator | 918 | 10.070% | Yes |
| 5 | #trending | 779 | 8.086% |  |
| 6 | #foryoupage | 668 | 7.859% |  |
| 7 | #creator | 578 | 8.467% | Yes |
| 8 | #fypシ | 570 | 9.752% | Yes |
| 9 | #tiktokmarketing | 540 | 7.304% |  |
| 10 | #trend | 406 | 6.565% |  |
| 11 | #tiktok | 368 | 4.967% |  |
| 12 | #motivation | 363 | 12.319% | Yes |
| 13 | #viralvideo | 352 | 4.212% |  |
| 14 | #entrepreneur | 289 | 8.077% |  |
| 15 | #dance | 287 | 8.834% | Yes |
| 16 | #smallbusiness | 272 | 5.494% |  |
| 17 | #digitalmarketing | 249 | 7.935% |  |
| 18 | #funny | 243 | 5.663% |  |
| 19 | #capcut | 208 | 6.006% |  |
| 20 | #creatorsearchinsights | 199 | 9.353% | Yes |

### Power Hashtags (8)

High frequency AND above-median engagement rate:

- **#fyp** — 2897 videos, 9.57% median ER
- **#viral** — 1653 videos, 9.40% median ER
- **#contentcreator** — 918 videos, 10.07% median ER
- **#creator** — 578 videos, 8.47% median ER
- **#fypシ** — 570 videos, 9.75% median ER
- **#motivation** — 363 videos, 12.32% median ER
- **#dance** — 287 videos, 8.83% median ER
- **#creatorsearchinsights** — 199 videos, 9.35% median ER

## 7. Sound Analysis

### Top 15 Sounds

| Rank | Sound | Count | Median ER | Viral Overrep. |
|------|-------|-------|-----------|----------------|
| 1 | original sound | 62 | 7.176% | 0x |
| 2 | Love You So | 60 | 1.861% | 0x |
| 3 | Big Guy - from "The SpongeBob Movie: Search for Sq | 30 | 3.824% | 0.33x |
| 4 | original sound - dropship | 24 | 8.779% | 0x |
| 5 | Original sound | 16 | 18.436% | 3.12x |
| 6 | Aesthetic | 15 | 4.115% | 0x |
| 7 | Original Sound | 13 | 8.720% | 1.54x |
| 8 | Yacht Club | 13 | 12.199% | 1.54x |
| 9 | Tokyo Grift | 13 | 7.210% | 0x |
| 10 | nhạc nền - dropship | 12 | 7.919% | 0x |
| 11 | original sound - coachhtet18 | 11 | 12.878% | 0x |
| 12 | original sound - reverse.soundeffects_ | 11 | 1.772% | 0x |
| 13 | Unstoppable (I put my armor on, show you how stron | 11 | 5.249% | 0x |
| 14 | Funny Song | 10 | 4.603% | 0x |
| 15 | original sound - 917josh_ | 10 | 7.168% | 0x |

### Viral-Overrepresented Sounds (5)

Sounds appearing disproportionately in viral-tier videos (>1.5x overrepresentation):

- **Original sound** — 3.12x overrepresentation, 16 videos
- **Original Sound** — 1.54x overrepresentation, 13 videos
- **Yacht Club** — 1.54x overrepresentation, 13 videos
- **original sound - elite_think** — 4x overrepresentation, 10 videos
- **original sound - miss_zhen_cuff168** — 3.75x overrepresentation, 8 videos

## 8. Engagement Patterns

### Per 100 Views

- **Likes:** 9.48
- **Comments:** 0.07
- **Shares:** 1.02

### Like:Comment:Share Ratio

For every **100 likes**, there are approximately **0.73 comments and 10.71 shares**.

### Engagement Rate Distribution

| Percentile | Engagement Rate |
|------------|-----------------|
| P10 | 1.502% |
| P25 | 3.792% |
| P50 | 8.191% |
| P75 | 13.900% |
| P90 | 19.853% |
| P95 | 24.485% |
| P99 | 47.200% |
| Mean | 13.311% |
| Std Dev | 264.031% |

## 9. Category Breakdown

*No category data available in the dataset.*

## 10. Implications for Engine

Key takeaways for downstream phases:

- **Phase 2 (Gemini Prompts):** Use virality tier thresholds and engagement patterns to calibrate prompt scoring anchors. The engagement rate distribution provides concrete numbers for "what good looks like" on TikTok.
- **Phase 3 (DeepSeek CoT):** Key differentiators between viral and average content should inform the chain-of-thought reasoning — especially duration, share ratio, and hashtag usage patterns.
- **Phase 5 (Aggregation Formula):** Duration sweet spot (50-55s) and engagement ratio patterns provide calibration data for the rules engine component.
- **Phase 10 (ML Training):** The full distribution stats and per-tier breakdowns provide training labels. Use engagement rate percentile boundaries as classification thresholds.
- **Phase 12 (Calibration):** calibration-baseline.json is the ground truth for A/B testing engine accuracy against real TikTok performance data.

