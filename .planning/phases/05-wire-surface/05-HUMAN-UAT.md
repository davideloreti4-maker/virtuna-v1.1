---
status: partial
phase: 05-wire-surface
source: [05-VERIFICATION.md]
started: 2026-06-06T18:33:56Z
updated: 2026-06-06T19:02:00Z
---

## Current Test

ALL 5 EXERCISED (2026-06-06). 4 PASS, 1 PARTIAL (#4 null-gate only — R11 positive path blocked by handle-not-threaded, see Gaps). 2 new non-blocking findings: #R11-handle-threading (wiring), IN-02 (copy hierarchy). Engine + D-01 rubric-sum + insight-hero + permalink dual-read all proven live (analysis 1dtSt9diWtgS, engine 3.8.0, 78s).

## Tests

### 1. R6 — Full E2E latency ≤90s on a live run
expected: `npx tsx scripts/measure-pipeline.ts <video-url>` completes ≤90s total; omni first paint ~17s; fold ∥ Apollo parallel (no serialization regression from the surface work).
result: PASS (2026-06-06) — 2 runs same video: 79.3s and 70.7s, both ≤90s. fold ∥ apollo confirmed parallel (fold 52.4s ∥ deepseek/apollo 55.1s, both start @23.6s). NOTE: run 1's 79.3s included an omni-flash Zod retry (~10s — invalid `emotion_arc` label outside low/mid/high enum, attempt0→attempt1); clean run = 70.7s, matching the 74s baseline. Omni-flash schema-drift is a separate robustness item (see Gaps).

### 2. Live same-video-twice determinism gate (R8 / D-01)
expected: Run `/analyze` (or measure-pipeline) on the SAME video twice; both `overall_score` values are byte-identical OR land in the same D-02 band. Record both composites. (Arithmetic determinism is unit-proven; this confirms the live cure given thinking-mode residual + the untouched behavioral half.)
result: PASS via band clause (2026-06-06) — NOT byte-identical: overall 78 (behavioral 74) vs 76 (behavioral 71), Δ2. Both → bandLabel "High potential" (≥70); confidenceRange@0.75 = [72,84] vs [70,82] (overlapping); Δ2 < band half-width 6. Derived apollo composite ~82.7 vs ~81.8 (Δ~1 — rubric-sum stabilized as designed). Residual swing lives in the UNTOUCHED fold/behavioral half (Δ3, weight 0.533), confirming the b593c124 audit: the D-02 band is the cure, not byte-identity. Acceptable per the OR clause.

### 3. Real-run DB persist of `variants.apollo.dimensions[].score` (D-01 threading)
expected: Run a real `/analyze`, query the `analysis_results` row, confirm the 6 dimension `score` values persist non-null; permalink reload renders the insight-hero from `variants.apollo`.
result: PASS (2026-06-06, live UI run via Playwright + throwaway user; analysis id `1dtSt9diWtgS`, video = @areyoukiddingtv 120s clip). DB row: `engine_version=3.8.0`, `latency_ms=78023` (78s), `overall_score=74`, confidence 0.75 HIGH. **All 6 `variants.apollo.dimensions[].score` non-null at the fixed band anchors** — hook 85, retention 85, clarity 85, share_pull 50, substance 50, credibility 85 (strong→85/mid→50, zero weak). `apollo.composite_score=82`; rubric-sum check exact: 85·0.80 + (85+85+50+50+85)·0.04 = 68 + 14.2 = 82.2 → 82. `rewrites`=3. **This is the CR-01 fix proven live** — had the prompt blueprint still omitted `score`, Zod would have failed → null → no apollo; instead all 6 emitted band-anchored scores. Permalink reload (`/analyze/1dtSt9diWtgS`) re-rendered the full insight-hero from `variants.apollo` (dual-read confirmed, 0 console errors).

### 4. Live R11 range surface + null-gate behavior
expected: On a fresh analysis with a creator baseline (follower_count > 0), the EngagementRangeCard renders a lo–hi range + confidence; on permalink reload (live-only design) it is absent with the "estimate available on fresh run" affordance reading as intentional; no card when no baseline.
result: PARTIAL — **null-gate PASS, positive-range UNTESTED (blocked by a wiring finding).** No EngagementRangeCard rendered (correct null-gate). BUT the cause is a gap: pipeline logged `"No creator handle provided, using cold-start context"` — the onboarding TikTok handle (@areyoukiddingtv) did NOT thread into the analyze pipeline, so `creatorContext.follower_count` was null → `computeEngagementRange` correctly returned null → card absent. The honest null-gate works; the positive lo–hi range path could not be exercised because no baseline reached the engine. See Gaps (#R11-handle-threading). Also note: the board's `/analyze` surface does not host the EngagementRangeCard — that card lives in the results-panel (simulation) surface; the board null-gate (no fake engagement) is what was observed here.

### 5. D-08 insight-hero visual hierarchy (incl. IN-02 ordering)
expected: Insight-hero reads as the board HERO; rewrites are struck-through original + copyable variants; 6 scored dimensions cited; score band demoted. Confirm the ceiling_capper vs confidence_scope hierarchy reads correctly (IN-02 was flagged INFO — subjective).
result: PASS with one INFO note (2026-06-06, Insight region rendered on permalink). Renders: **3 hook rewrites** each = struck-through verbatim original (`<del>`) + distinct copyable variant + Copy button (verbatim-grounded, D-08 ✓); **6 dimension scores** numeric + band (Hook 85 Strong, Retention 85 Strong, Clarity 85 Strong, Share pull 50 Mid, Substance 50 Mid, Credibility 85 Strong — exact DB match); **demoted score band** "High potential · 68–80" (D-02 ✓). INFO (IN-02 confirmed as flagged): the hero's LEAD paragraph is the `confidence_scope` caveat ("Sensor did not provide mute-readability…"), with the highest-leverage `ceiling_capper` not surfaced as the lead — the subjective hierarchy inversion the review flagged. Cosmetic/copy-hierarchy, not a defect; candidate polish for the UI/UX milestone.

## Summary

total: 5
passed: 4
issues: 0
pending: 0
partial: 1
skipped: 0
blocked: 0

## Gaps

- **Omni-flash schema-drift (robustness, track-3 QA):** 1 of 2 runs on the same video returned an `emotion_arc[].label` outside the `low|mid|high` enum → Zod fail on attempt 0, retry on attempt 1 (~10s + 1 extra omni call). 50% retry rate on this sample. The plus→flash flip (ENGINE 3.7.0) may have raised schema-drift; P5 review added a prompt/schema-drift guard (7ab7ffd9) — confirm it covers `emotion_arc` labels. Not a UAT blocker (retry recovers) but a latency tax worth a wider N-video QA sweep before main merge.
- ~~#3 / #4 / #5 pending~~ — RESOLVED 2026-06-06 via live Playwright UI run (analysis `1dtSt9diWtgS`). #3 PASS, #5 PASS, #4 PARTIAL (null-gate only).
- **#R11-handle-threading (NEW, gates R11 positive path):** the onboarding/profile TikTok handle does NOT reach the analyze pipeline — `runPredictionPipeline` logged `"No creator handle provided, using cold-start context"` despite `@areyoukiddingtv` set in onboarding (persisted to `creator_profiles`/`tiktok_accounts`). So `follower_count` never reaches `computeEngagementRange` and the R11 range can NEVER render in practice — only the null-gate fires. The P5 research gate (D-05) assumed the creator baseline reaches the engine; for the **upload** path it does not. Action: thread `creatorContext.follower_count` from the user's creator profile into the analyze route → pipeline input before R11 can show a real range. Likely a small wiring fix in `/api/analyze` route (load profile → set creatorContext). Until then R11 is dormant in the product even though the compute is correct + unit-tested.
- **IN-02 hierarchy (INFO, from code review):** insight-hero leads with `confidence_scope` (caveat) instead of `ceiling_capper` (highest-leverage insight). Confirmed in live render. Subjective copy-hierarchy polish → defer to UI/UX milestone.
- **Omni-flash schema-drift (still open):** the live UI run was CLEAN (no retry, emotion_arc 7 pts), but the earlier 2-run measure showed a 50% `emotion_arc[].label` Zod-retry rate — keep the wider N-video QA sweep before main merge.
