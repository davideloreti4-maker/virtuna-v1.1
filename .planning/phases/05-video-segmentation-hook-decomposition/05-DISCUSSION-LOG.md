# Phase 5: Video Segmentation + Hook Decomposition - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 5-Video Segmentation + Hook Decomposition
**Areas discussed:** Model tier, Hook window, No-CTA handling, Partial segment failure

---

## Model Tier — 2.5 vs Gemini 3

| Option | Description | Selected |
|--------|-------------|----------|
| Gemini 3 Pro hook + 3 Flash body/CTA | ~2.0¢/video. Pro on hook for 6-score decomposition reasoning; Flash on body/CTA modern + cheap. Env-overridable. | ✓ |
| All Gemini 3 Flash | ~1.0¢/video. Matches "modern + cheap" instinct exactly. Risk: hook decomposition less reliable on Flash. | |
| Keep locked 2.5 (Pro hook + Flash body/CTA) | ~1.0¢/video. ROADMAP spec literally. Generation behind Wave 0's tier. | |
| Gemini 3 Pro hook + 3.1 Flash-Lite body/CTA | ~1.5¢/video. 3.1 Flash-Lite GA + cheapest. Slight unknown on body/CTA quality. | |
| Use Gemini 3.1 Pro hook (preview) | Highest quality but preview = breaking-change risk. Not production-safe. | |

**User's choice:** Gemini 3 Pro hook + Gemini 3 Flash body/CTA, all GA, all env-overridable.
**Notes:** User raised "what about Gemini 3.1 pro / flash?" — surfaced that 3.1 Pro is still preview as of 2026-05-18, 3.1 Flash-Lite is GA but unproven for body/CTA reasoning, 3.2 Flash leaked but not officially released. Final decision: stick to GA models, leave swap-in path via env vars.

---

## Hook Segment Window

| Option | Description | Selected |
|--------|-------------|----------|
| 0-5s for hook segment | Matches Phase 4 Wave 0 window. More evidence for first-words / coherence. Body shifts to 5s→end-3s. Negligible cost. | ✓ |
| 0-3s for hook segment | Canonical "first 3 seconds" definition. Cleanest semantic boundary. Less evidence for slower openers. | |
| Adaptive (0-3s ≤15s / 0-5s longer) | Hybrid that protects short videos. More complex branch logic. | |

**User's choice:** 0-5s, matching Phase 4 Wave 0 window.
**Notes:** Same instinct as P4 D-01 ("more confidence for tiny extra cost"). User flowed naturally from Area 1 to Area 2 in the same message.

---

## No-CTA Handling

| Option | Description | Selected |
|--------|-------------|----------|
| B — Presence-aware (content-type-conditional) | Returns cta_present + strength. Aggregator penalizes only when content type should have a CTA (tutorial, B-roll). Comedy/vlog/talking-head neutral. | ✓ |
| C — Never penalize absent CTA | Strength contributes only if present. Simpler. Risk: tutorials/B-roll that should have CTAs don't get flagged. | |
| A — Always score 0-10 | No CTA = ~1-2/10 regardless of content type. Punishes comedy/vlog creators. | |

**User's choice:** Presence-aware, content-type-conditional.
**Notes:** Integrates with Phase 4's content-type weight matrix. Researcher's prompt design must explicitly instruct model to return `cta_present=false` when none exists.

---

## Partial Segment Failure Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| A — Ship partial with warning | Aggregator redistributes weight across successful segments. User sees result + warning. Matches Phase 1/3/4 graceful-degradation. No extra latency. | ✓ |
| B — Fall back to single-call on failure | Adds ~30s latency + ~0.5¢ cost. Loses hook decomposition. Safest "full coverage". | |
| C — Hard-fail prediction | Strict. Breaks additive-only milestone constraint. | |

**User's choice:** Ship partial with warning.
**Notes:** Follows existing graceful-degradation pattern. M2 result-card UI must be designed to display results with missing segments without looking broken.

---

## Claude's Discretion

- File organization (segmented.ts orchestrator + per-segment helpers vs inline) — planner picks
- Prompt templates per segment (hook / body / CTA) — researcher locks wording
- Zod schemas for 3 new segment response shapes — Claude's discretion
- Merge function logic (which segment owns which factor scores) — planner refines
- Short-video handling (≤8s) — recommendation: skip body call, mark `gemini_body=false`
- Promise.allSettled vs Promise.all + try/catch — planner picks
- `calculateCost` extension for per-model pricing — planner verifies
- Test surface (Vitest 80% threshold) — Claude's discretion
- Eval harness opt-in (segmented only vs A/B) — recommendation: segmented only; Phase 12 may A/B
- Sentry tags per segment — established pattern
- Files API delete timing (after Promise.allSettled) — Claude's discretion

## Deferred Ideas

- Gemini 3.1 Pro upgrade (currently preview)
- Gemini 3.2 Flash adoption (not officially announced)
- Gemini context caching for hook prompt prefix
- Per-segment cost telemetry table extension
- Real audio analysis superseding Gemini-derived audio_hook_quality — Phase 6
- Watermark detection (ALGO-06) folded into Phase 5 prompts — Phase 9
- Segmented vs un-segmented A/B eval comparison — Phase 12
- Hook decomposition result-card UI surfacing — M2
- Mixed-content soft-handling for body segment — Phase 10
- Promote frequent `other` content types to first-class (carry-forward from Phase 4)
- Cross-modal coherence as standalone aggregator signal — Phase 10
