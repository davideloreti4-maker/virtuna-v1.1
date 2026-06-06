---
phase: 05-wire-surface
verified: 2026-06-06T20:32:00Z
status: human_needed
score: 17/17 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run scripts/measure-pipeline.ts (or /analyze) on a real video; assert total E2E ≤90s with fold ∥ Apollo unchanged, omni ~17s first paint"
    expected: "Total ≤90s; no latency regression from the wire+surface work (no new LLM call added in P5)"
    why_human: "Needs live engine + real video + API quota — cannot measure latency from static code (R6)"
  - test: "Run the SAME video twice via scripts/measure-pipeline.ts (or /analyze); record both overall_score values"
    expected: "Byte-identical OR both land in the same D-02 band (variance-shrink contract, NOT product-layer byte-identity per 05-VALIDATION)"
    why_human: "W0 unit test proves the rubric adder (same parsed dims → same sum); the live cure is gated by thinking-mode residual + the untouched behavioral 53.3% half — only a real run proves it (R8/D-01, required before sign-off per VALIDATION)"
  - test: "Run a real /analyze for a known-follower creator; query the analysis_results row + reload the permalink"
    expected: "variants.apollo.dimensions[].score persists non-null to DB; the insight-hero renders the scored dimensions on permalink reload (dual-read)"
    why_human: "Requires live Supabase write + a real Qwen run — assembly-hop threading is structurally verified but DB persistence of the new score field needs a live write (D-01 threading)"
  - test: "Live run for a known-follower creator vs a no-creator run; observe the results-panel engagement card"
    expected: "Known-follower run renders the EngagementRangeCard (lo–hi + confidence); no-creator run renders no card; permalink reload correctly shows no card (live-only, reload affordance reads as intentional)"
    why_human: "R11 range is computed on the live in-memory PredictionResult (not persisted) — needs a live analyze to confirm it surfaces and that null-gating + reload affordance behave correctly (R11/D-06)"
  - test: "Visual UAT of the insight-hero D-08 information hierarchy on a real board"
    expected: "Insight (read + rewrites + dimensions) is the visual hero; the score band is clearly demoted below it; IN-02 (ceiling_capper vs confidence_scope ordering) reads correctly to a human"
    why_human: "Subjective visual hierarchy + IN-02 field-label ordering deferred to UAT in 05-REVIEW; cannot assess perceived prominence from static code"
---

# Phase 5: Wire + Surface Verification Report

**Phase Goal:** Connect the three calls and surface the insight — finalize the score via D-01 rubric-sum (band→fixed-anchor deterministic composite); build the grounded engagement estimate (R11); build the insight-hero board frame (dual-read apollo_reasoning, struck-through/copyable rewrites, 6 scored dimensions, demoted D-02 band, D-07 heatmap drop-point join at surface-time, D-03 progressive reveal); strip the dead fake-engagement UI. Full Apollo flow on the board.
**Verified:** 2026-06-06T20:32:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| 1  | Apollo composite_score is deterministic weighted SUM of 6 dimension anchors (D-01) | ✓ VERIFIED | deepseek.ts:156-164 — block-scoped reduce, HOOK_WEIGHT=0.80, BODY_WEIGHT=0.20/5, overwrites composite post-clamp |
| 2  | Each Apollo dimension carries a zod-bounded numeric score from its band (D-01) | ✓ VERIFIED | types.ts:782 `score: z.number().min(0).max(100)` inside ApolloDimensionSchema |
| 3  | Corpus §4 instructs band-anchored numeric scores + deterministic sum; holistic-composite inverted | ✓ VERIFIED | apollo-core.ts:186,189,190,262,264 — anchors 85/50/20, "composite is NOT a holistic judgment"; old phrase grep=0 |
| 4  | ENGINE_VERSION bumped past 3.7.0 (cache invalidation) | ✓ VERIFIED | version.ts:31 `ENGINE_VERSION = "3.8.0"`; version.test.ts pin updated |
| 5  | CR-01 fixed: user-message blueprint includes required `score` field with band anchors | ✓ VERIFIED | deepseek.ts:328-334 — `"score": 85\|50\|20` on all 6 dims; comment marks score REQUIRED with strong→85/mid→50/weak→20 |
| 6  | CR-02 fixed: composite_score blueprint comment no longer says "Not arithmetic" | ✓ VERIFIED | deepseek.ts:336 — "it is IGNORED — TypeScript overwrites it with the deterministic hook-weighted sum"; guard test asserts no "Not arithmetic" |
| 7  | predicted_engagement is a grounded RANGE (lo–hi) anchored to follower_count × quality read (R11) | ✓ VERIFIED | aggregator.ts:182-231 computeEngagementRange; types.ts:258 EngagementRange; field type at :288 |
| 8  | R11 range computed + rendered from LIVE result only; NOT persisted this phase | ✓ VERIFIED | route.ts predicted_engagement grep=0; aggregator.ts:1068 lives on in-memory PredictionResult; reload affordance in EngagementRangeCard |
| 9  | Two follower tiers → materially different ranges for the same video | ✓ VERIFIED | aggregator.test.ts tier-sensitivity test GREEN (58/58) |
| 10 | Range computed in aggregator from existing creatorContext — no new LLM call (R7/R6) | ✓ VERIFIED | aggregator.ts:1068 reads pipelineResult.creatorContext; no new AggregateScoresOptions; pure function |
| 11 | follower_count null/≤0 → null (no fabricated number, WR-03) | ✓ VERIFIED | aggregator.ts:189-195 guard rejects null/undefined/≤0 |
| 12 | Insight-hero renders read + 3 rewrites (struck-through+copyable) + 6 dims + heatmap + demoted band + flop warning in D-08 order | ✓ VERIFIED | InsightHeroFrame.tsx (340 lines) — `<del>` original :114, Copy button :126, dims :151-172, D-02 band :210-212 below |
| 13 | Hero dual-reads apollo_reasoning (variants.apollo OR top-level) — no permalink blank | ✓ VERIFIED | InsightHeroFrame.tsx:188-191 useMemo dual-read; permalink dual-read test GREEN |
| 14 | Each dimension renders band AND score; legacy band-only rows render defensively | ✓ VERIFIED | InsightHeroFrame.tsx:151 `typeof dim.score === 'number'`; :166-171 conditional score + band |
| 15 | At least one rewrite labelled with fold heatmap biggest-drop mm:ss at render time (D-07/R4) | ✓ VERIFIED | InsightHeroFrame.tsx:194-201 findBiggestDrop+formatTime; :286-289 attached to retention-lever rewrite |
| 16 | Score band reused from verdict-derive, demoted below insight (D-02/D-08) | ✓ VERIFIED | InsightHeroFrame.tsx:25 imports confidenceRange/bandLabel/bandTone; rendered after rewrites+dims |
| 17 | Hero paints on Apollo wave_2 via insight_hero panel (D-03); mounted in board | ✓ VERIFIED | panel-mapping.ts:21,35 insight_hero in PANEL_IDS + STAGE_TO_PANEL.wave_2; Board.tsx:40,518 mount; board-types/constants registered |
| 18 | Dead TikTokResultCard predicted_engagement path removed from results-panel (D-08) | ✓ VERIFIED | results-panel.tsx TikTokResultCard grep=0; EngagementRangeCard wired null-gated :158-159 |

**Score:** 18/18 truths verified (17 declared must-haves + CR/WR remediation re-verify)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/lib/engine/types.ts` | ApolloDimensionSchema.score + EngagementRange | ✓ VERIFIED | score :782, EngagementRange :258, field :288 |
| `src/lib/engine/deepseek.ts` | post-parse rubric-sum + blueprint with score | ✓ VERIFIED | HOOK_WEIGHT :157, blueprint :328-336 (CR fixed) |
| `src/lib/engine/apollo-core.ts` | inverted §4 contract | ✓ VERIFIED | anchors + composite-as-sum; old phrase grep=0 |
| `src/lib/engine/version.ts` | bumped ENGINE_VERSION | ✓ VERIFIED | 3.8.0 :31 |
| `src/lib/engine/aggregator.ts` | computeEngagementRange wired | ✓ VERIFIED | function :182, wired :1068, WR-03 guard :192 |
| `src/lib/engine/panel-mapping.ts` | insight_hero → wave_2 | ✓ VERIFIED | :21,:35 |
| `src/components/board/InsightHeroFrame.tsx` | net-new hero (≥80 lines) | ✓ VERIFIED | 340 lines, dual-read, D-07/D-02 |
| `src/components/board/Board.tsx` | frame mounted | ✓ VERIFIED | import :40, render :518 |
| `src/components/app/simulation/results-panel.tsx` | dead block removed, range wired | ✓ VERIFIED | TikTokResultCard grep=0, EngagementRangeCard :158 |
| `src/components/app/simulation/EngagementRangeCard.tsx` | range display (≥20 lines) | ✓ VERIFIED | 114 lines, lo/hi/confidence/basis :48, never a point |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| deepseek.ts | data.dimensions[].score | weighted reduce → composite overwrite | ✓ WIRED | :159-163 |
| aggregator.ts | deepseek.composite_score | apollo_score blend (reads the sum) | ✓ WIRED | unchanged consumer of now-deterministic sum |
| aggregator.ts | creatorContext.follower_count | computeEngagementRange anchor | ✓ WIRED | :197 |
| aggregator.ts | predicted_engagement | assembly site replaces hard null | ✓ WIRED | :1068 |
| InsightHeroFrame | row.variants.apollo ?? apollo_reasoning | dual-read useMemo | ✓ WIRED | :188-191 |
| InsightHeroFrame | findBiggestDrop/formatTime | D-07 drop-point label | ✓ WIRED | :197-201, :286-295 |
| panel-mapping | STAGE_TO_PANEL.wave_2 | insight_hero added | ✓ WIRED | :35 |
| results-panel | result.predicted_engagement | EngagementRangeCard, null-gated | ✓ WIRED | :158-159 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| InsightHeroFrame | apollo | useAnalysisStream(live SSE) + usePermalinkAnalysis(DB) dual-read | Yes — real engine apollo_reasoning / variants.apollo | ✓ FLOWING |
| EngagementRangeCard | range | result.predicted_engagement (live PredictionResult) | Yes (live-only; null on permalink by design) | ✓ FLOWING (live) |
| composite_score | data.dimensions[].score | LLM Apollo output via Zod-validated schema | Yes — deterministic arithmetic over validated scores | ✓ FLOWING |

### Behavioral Spot-Checks / Probe Execution

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Targeted P5 suites | `vitest run deepseek + aggregator + InsightHeroFrame + results-panel-null + version` | 113/113 passed (5 files) | ✓ PASS |
| CR-01/CR-02 prompt-contract guard | included in deepseek.test.ts :944-978 | blueprint has score field; no "Not arithmetic" — GREEN | ✓ PASS |
| Sum-identity + determinism (unit) | deepseek.test.ts :783,:800 | composite==sum, same input twice→identical — GREEN | ✓ PASS |

No runnable server probe; E2E latency + live determinism are manual-only (see human verification).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| R4 | 05-03 | Audience-aware insight — rewrite cites archetype bounce point | ✓ SATISFIED | D-07 drop-point label at surface-time, InsightHeroFrame :286-295 |
| R5 | 05-01,02,03 | Honest expert score (rederived from Apollo, demoted) | ✓ SATISFIED | rubric-sum composite + D-02 band demoted below insight |
| R6 | 05-01,02 | E2E ≤90s | ? NEEDS HUMAN | no new LLM call by construction; live measure required (harness exists) |
| R7 | 05-01,02 | ~3 LLM calls | ✓ SATISFIED | no new call added in P5 (R11 reads existing creatorContext) |
| R8 | 05-01 | Determinism — same video → same output | ✓ SATISFIED (unit) / ? NEEDS HUMAN (live) | rubric-sum adder deterministic; live same-video-twice gate manual per VALIDATION |
| R9 | 05-04 | Honest by deletion — fake engagement removed | ✓ SATISFIED | TikTokResultCard path stripped; null-gated range; ≤0 follower guard |
| R11 | 05-02,04 | Grounded engagement estimate as range | ✓ SATISFIED | computeEngagementRange tier-sensitive range; EngagementRangeCard |
| R12 | (exclusion) | One brain across modes | ✓ SATISFIED (untouched) | no Remix files in P5 commits — verify-untouched, no regression |

All requirement IDs declared across plan frontmatter (R4, R5, R6, R7, R8, R11) accounted for. No orphaned requirements. R12 is an explicit P5 build-exclusion (verified untouched).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | none | — | No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER in any P5-modified file; no stub/empty-return anti-patterns |

### Human Verification Required

5 items require live/human testing (per signed 05-VALIDATION contract these are MANUAL-ONLY and gate sign-off — they do NOT fail the phase):

1. **R6 E2E ≤90s (live)** — `scripts/measure-pipeline.ts <video>`; assert total ≤90s.
2. **Live same-video-twice determinism gate** — same video twice; PASS if byte-identical OR same D-02 band. Required before phase sign-off per VALIDATION.
3. **Real-run DB persist of dimension scores** — `/analyze` then query `analysis_results`; confirm `variants.apollo.dimensions[].score` non-null + permalink renders hero.
4. **R11 live range surface + null-gate** — known-follower run shows EngagementRangeCard; no-creator run + permalink reload show no card (intentional).
5. **D-08 visual hierarchy + IN-02 UAT** — insight is the visual hero, score demoted; ceiling_capper/confidence_scope ordering reads correctly.

### Gaps Summary

No gaps. All 18 observable truths are VERIFIED in the codebase. The CR-01/CR-02 critical defects from 05-REVIEW are confirmed remediated in deepseek.ts (blueprint carries the required `score` field with 85/50/20 anchors; composite comment no longer says "Not arithmetic") and locked by a prompt-contract guard test. WR-03 (follower≤0) and WR-01/WR-02 (clipboard catch, stable keys) confirmed fixed. The rubric-sum is wired post-parse, computeEngagementRange is called at the assembly site, the InsightHeroFrame dual-reads apollo_reasoning and is mounted, and the dead TikTokResultCard path is gone. R11 live-only/null-on-permalink is an accepted documented UX cut (not a gap). Status is **human_needed** solely because the signed VALIDATION contract defers 5 items (E2E latency, live determinism gate, real-run DB persist, live R11 surface, D-08 visual UAT) to manual live verification — none are code defects.

---

_Verified: 2026-06-06T20:32:00Z_
_Verifier: Claude (gsd-verifier)_
