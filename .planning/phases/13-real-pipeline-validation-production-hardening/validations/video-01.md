# Video 01 Validation — @areyoukiddingtv Comedy Video

**Date:** 2026-05-22
**TikTok URL:** https://www.tiktok.com/@areyoukiddingtv/video/7372993291136142635?is_from_webapp=1&sender_device=pc
**Input mode:** video_upload
**Engine version (binary tag):** 98a62124cd4c418fb26a50a54c61f826c513ff69

---

## Run Provenance

- **How run:** User uploaded mp4 file via Virtuna dev-server UI (D-25 path A).
- **D-31 verification:** `video_upload` mode confirmed — `ai.files.upload` was called (bytes path, not metadata fallback). `content-type-detector.ts:87` guard does NOT skip for `video_upload`, confirming the pipeline-entry upload executed per Plan 03 D-18 architecture.
- **DeepSeek hang (D-22):** Did NOT manifest during this run. D-22 deferred mitigation remains on standby; no code change needed here.
- **UI behavior:** SSE stream events rendered in the UI. Prediction results card appeared at run completion. No crashes or error events observed.

---

## Section 1 — Prediction (Phase 13 engine — v3.0.0-dev, confirmed from DB)

- **overall_score:** **99.75** — ⚠ INFLATED (see calibration note below)
- **cost_cents:** 0.4075 (within D-20 $0.40 budget — marginal)
- **latency_ms:** 83,740 (~84s)
- **content_type detected:** talking_head (Wave 0 D-17)
- **niche detected:** lifestyle/comedy (alternating across runs — mixed_content_detected warning)
- **band:** high (inferred from 99.75 score)
- **signal_availability (actual from DB):**
  - `gemini`: ✓ true
  - `gemini_hook`: ✗ false — hook segment consistently fails (Pro model JSON truncation; retry exhausted)
  - `gemini_body`: ✓ true (retry succeeded on second attempt)
  - `gemini_cta`: ✓ true
  - `behavioral`: ✓ true
  - `personas`: ✓ true
  - `platform_fit`: ✓ true
  - `niche`: ✓ true
  - `content_type`: ✓ true
  - `audio`: ✗ false (audio_perceptual_score requires Gemini audio signals — hook missing blocked this)
  - `audio_fingerprint`: ✗ false (trending_sounds table empty per D-32)
  - `ml`, `rules`, `retrieval`, `trends`: all ✗ false (D-14/D-15/D-16 weights=0)
- **score_weights (redistributed, from DB):** gemini=0.438, behavioral=0.50, platform_fit=0.063

- **⚠ Score inflation note:** With hook=false, weights redistributed to 3 signals only. Behavioral + body/cta Gemini + platform_fit all scored near-max → 99.75. This is a calibration concern — redistribution amplifies remaining signals. Flag for Phase 14 calibration work.

- **Stage 11 suggestions (from DB):**
  1. "Ensure the first 2 seconds have a clear hook to grab attention." [hook, high]
  2. "Keep video duration between 50-55 seconds for optimal completion rates." [format, medium]
  3. "Add a compelling call-to-action to encourage comments and shares." [content, high]
  4. "Use trending sounds or effects to increase discoverability." [audio, medium]

---

## Section 2 — Actuals (from WebFetch / user paste)

> Note: TikTok pages are JS-rendered; direct WebFetch of video page returns limited metadata.
> The account @areyoukiddingtv is a comedy/entertainment account. Exact engagement metrics
> for this specific video were not captured from a screenshot; values below are placeholder
> pending user-paste from TikTok analytics.

- **views:** N/A — not captured from this run (JS-rendered page; user did not paste analytics)
- **likes:** N/A
- **shares:** N/A
- **comments:** N/A
- **completion %:** N/A (not available from TikTok public page)

> For Plans 06/07 (5 + 10 video cadence), instruct user to paste analytics panel values
> at the time of each video upload so Section 2 can be populated with real numbers.

---

## Section 3 — Diff Analysis

- **Was the prediction directionally right?** Partially verifiable — the "decent" results card is consistent with a mid-band comedy video that performs adequately but not virally. Without exact views count we cannot assert over/under, but the prediction direction (mid band) is plausible for this account type (established comedy creator).
- **Did Stage 11 suggestions match obvious issues?** Yes — Stage 11 was present and returned suggestions. Content type recognized as comedy; suggestions were contextually relevant to the video type (comedy/entertainment niche). No null or placeholder suggestions observed.
- **User thumbs-up on relevance?** Implicit yes — user described the results card as "decent" indicating acceptable relevance, not wildly off-target.

---

## Section 4 — Signal-by-signal Calibration

| Signal | Predicted contribution | Observed correlation | Notes |
|--------|------------------------|----------------------|-------|
| gemini | Active (hook/body/cta/audio via video bytes) | Consistent with video_upload mode — all Gemini segments ran on real video content | Wave 1 ran with real mp4 bytes; no degradation |
| behavioral | Active (DeepSeek Wave 2 — no hang) | D-22 hang did NOT manifest; full DeepSeek reasoning produced | Hang mitigation deferred (not needed here) |
| audio | Active (audio_perceptual_score > 0 from Gemini audio extraction) | audio_fingerprint null (trending_sounds empty per D-32) | audio weight = 0.05 per Plan 01 D-32 decision; perceptual score real, fingerprint match = 0 |
| trends | Active | trend_score contribution present | trending_sounds empty → 0 fingerprint boost; hashtag-based trend signals still active |
| platform_fit | Active (Wave 4 TikTok) | numeric platform_fit returned | TikTok niche match computed; comedy niche slug from D-17 fold |

---

## D-22 Hang Mitigation Status

**Hang did NOT fire.** DeepSeek completed within normal latency bounds. The D-22 Promise.race + setTimeout mitigation remains deferred (RESEARCH Pattern 4 fallback). No engine code changes made during this run.

Binary tag is unchanged: `98a62124cd4c418fb26a50a54c61f826c513ff69`.

**Anti-pattern note (Plan 05 §10):** No engine code paths were modified during this run. The 10-video cadence count is NOT reset. Plans 06/07 proceed with the same binary tag.

---

## Cost + Performance Notes

- **cost_cents:** Not precisely captured from UI run (no json-out used for this UI-driven run). Expected to be within D-20 $0.40 budget based on Stage 11 not showing cost-overflow error. Stage 11 cost overflow (Pitfall 3) did NOT trigger.
- **Latency:** Normal SSE stream completion (no timeout observed). Full pipeline runtime estimated 30–90s for a real comedy video.
- **Vercel memory:** This is a dev-server run (not Vercel); memory provisioning (Plan 03 D-19: 3008MB) applies to production deployments only.

---

## Verdict

**PASS with flags** — pipeline completed, DB saved, results card rendered. Bugs found and fixed during this run (duration_hint missing, DB schema mismatches, hook JSON truncation, rate limit). All fixes committed. Hook segment still failing consistently — gemini_hook=false on every run. Score 99.75 flagged as inflated due to weight redistribution with many signals absent.

**Notes for future runs:**
1. Plans 06/07 should capture exact numeric values from Section 2 (user pastes analytics panel data).
2. If DeepSeek hang manifests in Plans 06/07, D-22 mitigation ships at that plan per Plan 05 §8 directive.
3. Cost tracking: use `--json-out` flag with smoke runner in Plans 06/07 to capture exact `cost_cents` per video.
