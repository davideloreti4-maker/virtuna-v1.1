# Data Analysis Report: Algorithm-Aligned TikTok Video Analysis

*Generated: 2026-02-16T10:02:56.230Z*
*Methodology: Algorithm-aligned analysis using TikTok's 2025-2026 engagement point system. Primary metrics weighted by algo importance: shares (3x) > comments (2x) > likes (1x). Completion rate and rewatches (4x, 5x) cannot be measured from scraped data.*

## 1. Executive Summary

- Analyzed **7'321** TikTok videos using algorithm-aligned weighted engagement scoring
- **TikTok 2025 algo weights**: rewatches (5x) > completion (4x) > shares (3x) > comments (2x) > likes (1x)
- **We measure**: shares (3x), comments (2x), likes (1x). Completion/rewatches require analytics access.
- **Share rate is the #1 measurable virality signal**: p50 = 0.280%, viral threshold (p90) = 1.830%
- Viral videos have 1163.21% higher share rate (5.723% vs 0.453%). Shares are weighted 3x in TikTok's algo — this is the strongest signal we can measure.

## 2. TikTok Algorithm Signal Hierarchy (2025-2026)

| Signal | Algo Points | Measurable? | Our Metric |
|--------|-------------|-------------|------------|
| Rewatches | 5 | No | — |
| Full watch (completion) | 4 | No | Duration as proxy |
| Shares | 3 | **Yes** | `share_rate` |
| Comments | 2 | **Yes** | `comment_rate` |
| Likes | 1 | **Yes** | `like_rate` |

**Weighted engagement score formula**: `(likes×1 + comments×2 + shares×3) / views`

Sources: [Sprout Social](https://sproutsocial.com/insights/tiktok-algorithm/), [Buffer](https://buffer.com/resources/tiktok-algorithm/), [Fanpage Karma](https://www.fanpagekarma.com/insights/the-2025-tiktok-algorithm-what-you-need-to-know/)

## 3. Data Quality

| Metric | Count |
|--------|-------|
| Total rows fetched | 7'389 |
| Duplicates removed | 0 |
| Outliers removed | 68 |
| **Final analyzed** | **7'321** |

## 4. Primary KPIs — Percentile Distribution

### weighted_engagement_score
*Mirrors TikTok's 2025 algo point system. Shares (3x) and comments (2x) weighted above likes (1x). Does NOT include completion/rewatches (not available from scraped data).*

| p10 | p25 | p50 | p75 | p90 | p95 | p99 |
|-----|-----|-----|-----|-----|-----|-----|
| 1.824% | 4.575% | 9.540% | 15.957% | 23.973% | 31.247% | 84.360% |

### share_rate
*Highest-value measurable signal. Shares are weighted 3x likes in TikTok's algo. A share rate of 2-5% indicates strong viral potential (industry benchmark 2025).*

| p10 | p25 | p50 | p75 | p90 | p95 | p99 |
|-----|-----|-----|-----|-----|-----|-----|
| 0.012% | 0.083% | 0.280% | 0.743% | 1.830% | 3.519% | 13.464% |

### comment_rate
*Conversation signal, weighted 2x likes. Comment quality matters more than quantity in 2025 algo, but we can only measure quantity from scraped data.*

| p10 | p25 | p50 | p75 | p90 | p95 | p99 |
|-----|-----|-----|-----|-----|-----|-----|
| 0.009% | 0.030% | 0.079% | 0.309% | 1.516% | 3.389% | 11.331% |

### like_rate
*Lowest algo signal (1x weight). 'Participation trophy' per TikTok's own point system. Still useful as baseline engagement indicator.*

| p10 | p25 | p50 | p75 | p90 | p95 | p99 |
|-----|-----|-----|-----|-----|-----|-----|
| 1.215% | 3.212% | 7.128% | 12.268% | 17.140% | 20.308% | 28.903% |

### share_to_like_ratio
*Measures active distribution vs passive consumption. High ratio = content people feel compelled to spread, not just tap 'like'. Strong virality amplifier.*

| p10 | p25 | p50 | p75 | p90 | p95 | p99 |
|-----|-----|-----|-----|-----|-----|-----|
| 0.0024 | 0.0175 | 0.0473 | 0.1111 | 0.2576 | 0.5000 | 1.5729 |

### comment_to_like_ratio
*Measures conversation depth. High ratio = content that provokes discussion, not just passive approval.*

| p10 | p25 | p50 | p75 | p90 | p95 | p99 |
|-----|-----|-----|-----|-----|-----|-----|
| 0.0017 | 0.0045 | 0.0148 | 0.0598 | 0.2000 | 0.3742 | 0.9576 |

## 5. Virality Tiers (Weighted Engagement Score)

| Tier | Label | Score Range | WES Threshold | Median Share Rate | Median Comment Rate | Videos | % |
|------|-------|-------------|---------------|-------------------|---------------------|--------|---|
| 1 | Unlikely to perform | 0-25 | 0.000%-4.575% | 0.077% | 0.031% | 1829 | 24.98% |
| 2 | Below average | 25-45 | 4.575%-9.540% | 0.230% | 0.079% | 1831 | 25.01% |
| 3 | Average | 45-65 | 9.540%-15.957% | 0.390% | 0.117% | 1830 | 25% |
| 4 | Strong potential | 65-80 | 15.957%-23.973% | 0.718% | 0.123% | 1098 | 15% |
| 5 | Viral potential | 80-100 | 23.973%-22616.667% | 2.822% | 0.758% | 733 | 10.01% |

*Tiers based on weighted engagement score distribution, NOT simple engagement rate.*

## 6. Key Differentiators — Viral vs Average (Ordered by Algo Weight)

**Viral**: WES p90+ (733 videos) | **Average**: WES p40-p60 (1465 videos)

- 🔴 **share_rate** [HIGH (3x)]: Viral videos have 1163.21% higher share rate (5.723% vs 0.453%). Shares are weighted 3x in TikTok's algo — this is the strongest signal we can measure.
- ⚪ **share_to_like_ratio** [CONTEXT]: Viral videos have 266.13% higher share-to-like ratio (0.39 vs 0.11). People don't just like viral content — they actively distribute it.
- 🟡 **comment_rate** [MEDIUM (2x)]: Viral videos have 1254.93% higher comment rate (4.387% vs 0.324%). Comments weighted 2x in algo.
- ⚪ **comment_to_like_ratio** [CONTEXT]: Viral videos have 255.41% higher comment-to-like ratio (0.23 vs 0.06). Deeper conversation signals.
- ⚪ **weighted_engagement_score** [CONTEXT]: Viral videos have 704.48% higher weighted engagement score (76.740% vs 9.539%).
- 🟢 **like_rate** [LOW (1x)]: Viral videos have 574.38% higher like rate (50.796% vs 7.532%). Lowest algo signal but still present.
- ⚪ **duration_seconds** [CONTEXT]: Viral videos are 24.47% shorter (33.35s vs 44.15s). Shorter = higher likely completion rate.
- ⚪ **caption_length** [CONTEXT]: Viral video captions are 32.66% shorter (99.58 vs 147.88 chars).

## 7. Duration-Engagement Analysis

**Sweet spot (by weighted score)**: 50-55s
**Best share rate bucket**: 50-55s
**Duration-engagement correlation**: r=0.0059 (weak)

| Duration | Videos | Median WES | Median Share Rate | Median Comment Rate |
|----------|--------|------------|-------------------|---------------------|
| 0-5s | 8 | 3.589% | 0.260% | 0.007% |
| 5-10s | 1083 | 9.662% | 0.246% | 0.082% |
| 10-15s | 1452 | 10.145% | 0.276% | 0.069% |
| 15-20s | 1529 | 9.606% | 0.231% | 0.067% |
| 20-25s | 514 | 8.334% | 0.309% | 0.055% |
| 25-30s | 368 | 8.639% | 0.322% | 0.074% |
| 30-35s | 267 | 8.083% | 0.261% | 0.059% |
| 35-40s | 183 | 7.326% | 0.302% | 0.069% |
| 40-45s | 134 | 9.569% | 0.340% | 0.094% |
| 45-50s | 147 | 7.036% | 0.281% | 0.077% |
| 50-55s | 130 | 11.904% | 0.360% | 0.134% |
| 55-60s | 173 | 9.107% | 0.290% | 0.102% |
| 60s+ | 1333 | 10.098% | 0.334% | 0.125% |

## 8. Aggregate Engagement Ratios

- Per 100 views: **9.48** likes, **0.07** comments, **1.02** shares
- Per 100 likes: **0.73** comments, **10.71** shares

## 9. Context Signals (Secondary — Not Primary Algo Ranking Factors)

*Hashtags and sounds help TikTok categorize content but don't directly boost ranking. Engagement signals dominate.*

### Top Hashtags
| Hashtag | Count | Median WES | Power? |
|---------|-------|------------|--------|
| #fyp | 2897 | 10.697% | Yes |
| #viral | 1653 | 10.633% | Yes |
| #foryou | 951 | 8.785% |  |
| #contentcreator | 918 | 11.683% | Yes |
| #trending | 779 | 9.330% |  |
| #foryoupage | 668 | 9.020% |  |
| #creator | 578 | 9.685% | Yes |
| #fypシ | 570 | 10.667% | Yes |
| #tiktokmarketing | 540 | 8.722% |  |
| #trend | 406 | 7.525% |  |
| #tiktok | 368 | 5.751% |  |
| #motivation | 363 | 14.170% | Yes |
| #viralvideo | 352 | 4.829% |  |
| #entrepreneur | 289 | 9.706% | Yes |
| #dance | 287 | 10.106% | Yes |

### Top Sounds
| Sound | Count | Median WES | Viral Overrep. |
|-------|-------|------------|----------------|
| original sound | 62 | 7.914% | 0.16x |
| Love You So | 60 | 2.166% | 0x |
| Big Guy - from "The SpongeBob Movie: Sea | 30 | 4.087% | 0.33x |
| original sound - dropship | 24 | 10.626% | 0x |
| Original sound | 16 | 20.520% | 1.87x |
| Aesthetic | 15 | 4.533% | 0x |
| Original Sound | 13 | 9.205% | 1.54x |
| Yacht Club | 13 | 13.539% | 0.77x |
| Tokyo Grift | 13 | 8.526% | 0x |
| nhạc nền - dropship | 12 | 9.411% | 0x |

## 10. Implications for Prediction Engine v2

- **Scoring formula must weight by algo importance**: Use `(likes×1 + comments×2 + shares×3) / views` as base. When completion rate becomes available (video upload), weight it 4x.
- **Share rate is the virality gateway**: Videos above 1.830% share rate (p90) are in the viral tier. This should be the primary signal Gemini and DeepSeek evaluate.
- **Share-to-like ratio reveals content quality**: A video with high likes but low shares is passively consumed, not virally distributed. Flag this in the analysis.
- **Duration sweet spot**: 50-55s for highest weighted engagement. Use as a calibration signal, not a rule.
- **Demote hashtag/sound analysis**: These are content context signals, not ranking factors. Do NOT weight them highly in the prediction formula.

