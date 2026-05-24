# Phase 9: Platform Algo Fit + Self-Critique + Counterfactuals — Research

**Researched:** 2026-05-20
**Domain:** V3 (DeepSeek) prompt engineering on a multi-signal prediction pipeline; aggregator extension; Gemini Pro hook-segment prompt extension for watermark detection
**Confidence:** HIGH on architecture + wiring (full code precedent from Phases 5/6/7/8). MEDIUM on prompt content distillation (creator-intelligence.md is the source of truth; planner picks which excerpts go where).

## Summary

Phase 9 is three coupled additive stages on a pipeline that already supports them: a new `platform_fit` V3 call between Wave 3 and the aggregator, the self-critique V3 call filling the existing `stage10-critique.ts` stub, and the counterfactuals V3 call filling the existing `stage11-counterfactuals.ts` stub. Plus a small extension to the Phase 5 Gemini hook-segment prompt + schema to emit a `watermark_detected` boolean, which feeds the platform-fit prompt as a constraint.

No new infrastructure. Three new V3 (DeepSeek) calls reuse the established Phase 7 wave3 / Phase 4 niche-detector pattern: stable system prompt + volatile user message + Zod-validated JSON output + graceful-degradation (null result → signal_availability flag false → aggregator soft-handles). The platform-fit signal joins `SCORE_WEIGHTS` at 0.05 base weight following Phase 8's exact precedent (D-03b); `selectWeights` already normalizes whatever raw weights sum to.

The system-prompt portions of all three calls live in distilled, byte-stable excerpts from `.planning/research/creator-intelligence.md` — every per-call context (creator profile, persona aggregate, hook decomposition, prior PredictionResult) flows through the USER message to preserve DeepSeek input cache prefix bytes. Every output value cites a creator framework or a numerical rule by name (per D-21 — "be specific enough the creator knows exactly what to change").

**Primary recommendation:** Lock the platform-fit Zod schema + `SignalAvailability.platform_fit?` + `PredictionResult.platform_fit?: PlatformFitResult[]` + `PredictionResult.critique?` + `PredictionResult.counterfactuals?` in a single interface-first plan (Phase 8 Plan 02 precedent). Then ship four implementation plans in parallel: (1) Gemini hook-segment watermark flag extension, (2) `wave4/platform-fit.ts` V3 call + aggregator wiring, (3) `stage10-critique.ts` fill, (4) `stage11-counterfactuals.ts` fill. A fifth plan covers tests + REQUIREMENTS.md traceability.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Platform-fit V3 inference (TikTok/IG/YT scoring) | Backend / Engine — `src/lib/engine/wave4/platform-fit.ts` | DeepSeek API (V3 model) | Pure server-side reasoning over post-Wave-3 pipeline output; no client-side fit logic exists or is justified |
| Watermark detection (Gemini hook segment) | Backend / Engine — `src/lib/engine/gemini/hook-segment.ts` | Gemini 3 Pro API | Vision task on frame 1; reuses the existing Pro hook-segment call to keep it free (D-04 user note: "won't happen much but still good to have") |
| Aggregator signal integration (platform-fit weight) | Backend / Engine — `src/lib/engine/aggregator.ts` | — | `SCORE_WEIGHTS` + `selectWeights` is the single source for signal math; Phase 8 retrieval is the direct precedent |
| Self-critique V3 inference | Backend / Engine — `src/lib/engine/stage10-critique.ts` | DeepSeek API (V3 model) | Reads finalized PredictionResult post-aggregation; pure server reasoning |
| Counterfactual V3 inference | Backend / Engine — `src/lib/engine/stage11-counterfactuals.ts` | DeepSeek API (V3 model) | Reads finalized PredictionResult + hook decomposition timestamps; pure server reasoning |
| PredictionResult schema extension (3 new optional fields) | Backend / Engine — `src/lib/engine/types.ts` | — | Single source-of-truth import; additive `?:` fields per Phase 7 D-20 / Phase 8 wiring precedent |
| SSE event emission for new stages | Backend / Engine — events.ts callback | M2 viz (consumer) | Pipeline stage events are already plumbed; new stages call `emitStageStart`/`emitStageEnd` |
| UI rendering of platform-fit / critique / counterfactuals | OUT OF SCOPE (M2 Intelligence Surface) | — | Phase 9 ships data only; M2 designs the result-card surfaces |

## Project Constraints (from CLAUDE.md)

- **Stack lock:** Next.js 15, TypeScript strict, Tailwind v4, Supabase. Phase 9 stays inside `src/lib/engine/` and does not touch UI.
- **File organization:** No new files outside `/src` / `/tests` / `/docs` / `/config` / `/scripts`. Plans should place test files under `src/lib/engine/__tests__/` per existing convention (e.g., `aggregator.test.ts`, `wave3.test.ts`), NOT root.
- **No proactive docs:** Do not create new README/markdown files unless explicitly part of a plan deliverable. RESEARCH.md is the exception (planning artifact).
- **Read before edit:** Every existing file edit must be preceded by a Read tool call (planner instructs executors).
- **No secrets:** `DEEPSEEK_API_KEY` already exists in the project env; no new keys needed. Do not log API keys in stage events.
- **File size ceiling:** Keep files under 500 lines. `wave4/platform-fit.ts` will run ~250-350 lines (prompt + Zod + call + parsing); `stage10-critique.ts` and `stage11-counterfactuals.ts` will similarly stay under 500. If a file is approaching the limit, split prompts into a sibling `*-prompts.ts` per Phase 7's wave3/ layout.
- **Always run tests after code changes:** Each plan's `<how-to-verify>` must invoke `pnpm vitest run` (or scoped equivalent). The 203+ existing tests must stay green (BENCH-05 constraint).

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01**: Platform-fit AI-scored via V3 (`deepseek-chat`), not rule-based. Lives in new `src/lib/engine/wave4/platform-fit.ts`.
- **D-02**: One V3 call, all targeted platforms together (creator targets 1-3 platforms via Card 0).
- **D-03**: `PlatformFitResult` shape: `{ platform: "tiktok" | "ig_reels" | "yt_shorts", fit_score: 0-100, rationale: string, watermark_penalty: boolean }`. Only Card 0 platforms scored; empty Card 0 defaults to TikTok only.
- **D-04**: Watermark detection extends Phase 5 Gemini hook-segment prompt (hook frame is where watermarks appear). ANY platform watermark detected lowers fit score on ALL OTHER targeted platforms.
- **D-05**: Platforms supported: TikTok, IG Reels, YT Shorts only.
- **D-06**: Creator-tier-aware scoring. V3 receives `creatorContext.follower_tier` and uses it in per-platform reasoning (TikTok favors nano-creators).
- **D-07**: Platform-fit feeds aggregator as new signal at initial weight ~0.05; Phase 10 calibrates.
- **D-08**: Pipeline placement = after Wave 3, before aggregator.
- **D-09**: Self-critique V3 receives full `PredictionResult` including Card 6 wins/flops.
- **D-10**: Inconsistencies lower `confidence` only — NEVER `overall_score`.
- **D-11**: Max confidence adjustment = -20 percentage points (hard cap). Example: 0.85 → floor 0.65.
- **D-12**: `CritiqueResult.flags` are human-readable strings, not code labels (M2 renders verbatim).
- **D-13**: 4 locked consistency checks: (1) gemini_score vs behavioral_score divergence > 30 pts, (2) overall_score high (>70) but top factors negative or vice versa, (3) Card 6 historical match (prediction matches creator's known flop/win pattern), (4) HIGH confidence but multiple signals missing.
- **D-14**: Counterfactuals always generate — not conditional on score.
- **D-15**: Exactly 3 suggestions, ranked by estimated impact (highest first). Not 1-3, not 5.
- **D-16**: Hyper-specific with concrete actions; reference actual numbers, timestamps, signal values.
- **D-17**: Anchor counterfactuals to Phase 5 timestamps when available. When `signal_availability.gemini_hook = false`, V3 infers from available context.
- **D-18**: Anti-virality warning threshold: `overall_score < 30 AND confidence > 70%`. Add "LIKELY_FLOP" warning to `PredictionResult.warnings[]` — no new field. Warning names the top 2 dragging factors.
- **D-19**: `creator-intelligence.md` distilled per prompt (three separate excerpts), not full doc injection. Platform-fit gets ~400 tokens; critique ~500; counterfactuals ~600.
- **D-20**: System prompts stable / cache-eligible. Distilled excerpts in SYSTEM prompt; per-video data in USER message. Target ~95% input cache hit rate after warmup.
- **D-21**: Precision + actionability are primary value driver. JSON schema + prompt instruction enforce specificity (timestamps, score numbers, named frameworks).

### Claude's Discretion

- Initial aggregator weight for platform-fit signal: planner proposes (~0.05 per Phase 8 precedent). Existing weights redistribute proportionally (the `selectWeights` normalizer handles this — no manual reweighting needed).
- Exact Zod schema for `PlatformFitResult[]` — planner defines, following Phase 7/8 field addition patterns (`?:` optional to preserve compile against existing consumers).
- Error handling for platform-fit V3 call: follow `gracefulDegrade` pattern → null result + `signal_availability.platform_fit = false` → weight redistributes.
- Stage event emission: follow Phase 6/7/8 `stage_start` / `stage_end` event pattern from `events.ts`.

### Deferred Ideas (OUT OF SCOPE)

- Additional platforms (Pinterest, LinkedIn, Facebook Reels, Snapchat Spotlight) — user said "just the 3 for now"
- Per-platform counterfactuals (different suggestions for TikTok vs IG) — complexity not warranted yet
- UI rendering of platform-fit scores, critique text, counterfactuals — M2 (Intelligence Surface)
- Aggregator weight calibration for platform-fit — Phase 10 owns this
- Cross-platform repurposing analysis — already in PROJECT.md out-of-scope list

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ALGO-01 | TikTok algorithm fit signal — completion >> shares > saves > comments > likes | TikTok rubric in `creator-intelligence.md` §Platform Algorithm-Fit Scoring Prompts ("TikTok rubric"): length 10-20s, info density, hook ≤2s, burned-in text, cuts every 3-4s, one key takeaway. Platform-fit V3 system prompt distills this rubric verbatim. |
| ALGO-02 | IG Reels fit — sends-to-DM > comments > shares > saves + original audio bonus + watermark penalty | IG Reels rubric: visually storyable on mute, subtitles every second, 3-hook stack, shareable / tag-a-friend moment, ≤60s 9:16. Watermark penalty enforced via D-04 cross-platform rule. |
| ALGO-03 | YouTube Shorts fit — watch time + subscribes > replays > likes | YT Shorts rubric: length ~34s, story-driven (But/Therefore), peak in middle, foreshadow within 3s, mechanism (3-things/countdown). |
| ALGO-04 | Per-platform fit score computed and returned (one score per Card 0 platform) | `PlatformFitResult[]` filtered to Card 0 selections; pipeline reads `creatorContext.target_platforms` (already populated in Phase 2). Empty Card 0 → defaults to `["tiktok"]`. |
| ALGO-05 | Creator-tier-aware adjustment | `creatorContext.follower_count` → `getFollowerTier()` from `src/lib/engine/corpus/follower-tier.ts` (nano/micro/mid/large/mega). V3 receives tier in user message as scoring constraint. |
| ALGO-06 | Watermark detection on uploaded video (Gemini prompt extension, ~free) | Phase 5 hook-segment prompt + Zod schema gains `watermark_detected: { tiktok: bool, ig: bool, yt: bool }`. Hook frame is where watermarks appear. |
| CRITIQUE-01 | Self-critique V3 call on aggregator output | Fills `stage10-critique.ts` no-op. V3 receives full `PredictionResult` post-aggregation. |
| CRITIQUE-02 | Cross-references Card 6 wins/flops | Pull `creatorContext.past_wins` + `past_flops` (counts only — Phase 2 D-T-02-01 prompt-injection mitigation keeps URLs out of prompts) into the user message for critique check #3 ("Card 6 historical match"). |
| CRITIQUE-03 | Critique adjusts `confidence` field downward when internally inconsistent | `CritiqueResult.confidence_adjustment` ∈ [-0.20, 0]. Hard cap enforced in TS (clamp), not relied on from model. New confidence = `max(0, confidence + confidence_adjustment)`. |
| COUNTER-01 | Counterfactual V3 call ("what if hook moved to 0:02") | Fills `stage11-counterfactuals.ts` no-op. Exactly 3 ranked suggestions per D-15. |
| COUNTER-02 | Tied to timestamped suggestions + retention curve drop points | Use Phase 5 hook decomposition timestamps + Phase 7 `persona_simulation_results[].scroll_past_second` median as drop points. |
| COUNTER-03 | Returned in prediction result, available to all tiers (no premium gate) | New optional `counterfactuals?: CounterfactualResult` field on `PredictionResult`. Always runs (D-14). |
| COUNTER-04 | Anti-virality "likely flop" warning when score < 30 AND confidence > 70% | Added inside `stage11-counterfactuals.ts` (since it has access to the full PredictionResult). Appends string to `result.warnings[]` (existing field) — no schema change. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `openai` (npm SDK) | already-installed (Phase 7 `wave3.ts`) | DeepSeek V3 chat client (via OpenAI-compatible baseURL `https://api.deepseek.com`) | Project-wide standard for V3 calls — `wave3.ts`, `wave0/niche-detector.ts`, `deepseek.ts` all use this client. No new dep. [VERIFIED: src/lib/engine/wave3.ts:2,46-53] |
| `zod` | already-installed (used throughout types.ts) | Output JSON validation for all three V3 calls | Project-wide standard — every LLM boundary in this engine uses Zod safeParse. [VERIFIED: src/lib/engine/types.ts:1] |
| `@google/genai` | already-installed (Phase 5 hook-segment) | Watermark detection — extension of the existing Gemini Pro hook call's `responseSchema` (no new call, no new cost) | The hook-segment call already does multi-modal vision of frame 1; adding 3 booleans to its schema is free. [VERIFIED: src/lib/engine/gemini/hook-segment.ts:23] |
| `@sentry/nextjs` | already-installed | Error capture on V3 failure paths | Existing pattern in `deepseek.ts`, `wave3.ts`, all gemini segments. [VERIFIED: src/lib/engine/wave3.ts:1] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@/lib/logger` (project module) | n/a | Structured logging per call | Always — every V3 call logs cost + cache telemetry per Phase 7 pattern. [VERIFIED: src/lib/engine/wave3.ts:3] |
| `events.ts` (project module) | n/a | `emitStageStart` / `emitStageEnd` for SSE consumers | Three new stages: `platform_fit` (wave 3 or "post"), `stage_10_critique` ("post"), `stage_11_counterfactuals` ("post"). Phase 3 D-01 stage granularity contract. [VERIFIED: src/lib/engine/events.ts] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `deepseek-v4-flash` (default) for all three V3 calls | `deepseek-reasoner` for critique only | Critique benefits from chain-of-thought but reasoner is ~3x cost. Defer to `deepseek-v4-flash` for budget compliance; revisit if Phase 10 eval shows critique misses contradictions. [ASSUMED] |
| Run platform-fit IN Wave 3 (parallel with personas) | Stays sequentially after Wave 3 per D-08 | Parallelism would shave ~1s; D-08 locks "needs persona data to reason about fit" — Wave 3 results feed the prompt. Sequential is mandatory. |
| New `Wave 4` orchestrator name | Place file at `wave4/platform-fit.ts` but call it from inline pipeline code | D-08 doesn't mandate a Wave 4 wrapper. A single inline `await runPlatformFit(...)` between Wave 3 and `aggregateScores()` is sufficient. The `wave4/` directory name is a Claude-discretion organizational choice — could equally be `platform-fit/` (no wave). Recommend `wave4/platform-fit.ts` per CONTEXT D-01 mention. |

**Installation:**

```bash
# No new packages. Verify existing:
npm ls openai zod @google/genai @sentry/nextjs
```

**Version verification:** Skipped — all packages already locked in `package.json` and exercised by Phases 5-8.

## Architecture Patterns

### System Architecture Diagram

```
                       ┌─────────────────────────────────┐
                       │  runPredictionPipeline()        │
                       │  (pipeline.ts)                  │
                       └─────────────────────────────────┘
                                       │
                  ┌────────────────────┼─────────────────────┐
                  │                    │                     │
                  ▼                    ▼                     ▼
       ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
       │ Wave 1 parallel  │  │ Wave 2 parallel  │  │ Wave 3 sequential│
       │  · gemini-hook   │→ │  · deepseek-     │→ │  · 10 personas   │
       │    (NEW:         │  │    reasoning     │  │    (parallel V3) │
       │    +watermark)   │  │  · trends        │  │                  │
       │  · audio fp      │  │                  │  │                  │
       │  · creator ctx   │  │                  │  │                  │
       │  · rules         │  │                  │  │                  │
       │  · retrieval     │  │                  │  │                  │
       └──────────────────┘  └──────────────────┘  └──────────────────┘
                                                            │
                                                            ▼
                                              ┌─────────────────────────┐
                                              │  NEW: runPlatformFit()  │
                                              │  wave4/platform-fit.ts  │
                                              │  V3 deepseek-chat       │
                                              │  reads:                 │
                                              │   · creatorContext      │
                                              │     (target_platforms,  │
                                              │      follower_tier,     │
                                              │      Card 6 counts)     │
                                              │   · gemini hook+body+cta│
                                              │   · personaAggregate    │
                                              │   · hook_decomposition  │
                                              │   · retrievalResult     │
                                              │   · WATERMARK FLAGS     │
                                              │  emits: stage_start/end │
                                              │  out: PlatformFitResult[]│
                                              └─────────────────────────┘
                                                            │
                                                            ▼
                                              ┌─────────────────────────┐
                                              │  aggregateScores()      │
                                              │  (aggregator.ts)        │
                                              │  · SCORE_WEIGHTS gets   │
                                              │    platform_fit: 0.05   │
                                              │  · SignalAvailability   │
                                              │    +platform_fit        │
                                              │  · platform_fit_score   │
                                              │    folded into          │
                                              │    overall_score        │
                                              │  · selectWeights        │
                                              │    normalizes (no       │
                                              │    manual rebalance)    │
                                              └─────────────────────────┘
                                                            │
                                                            ▼
                                              ┌─────────────────────────┐
                                              │  Stage 10: critique     │
                                              │  stage10-critique.ts    │
                                              │  V3 deepseek-chat       │
                                              │  reads: full Prediction │
                                              │    Result + Card 6      │
                                              │  4 locked consistency   │
                                              │  checks (D-13)          │
                                              │  out: CritiqueResult    │
                                              │  side-effect:           │
                                              │    confidence -= adj    │
                                              │    (capped at -0.20)    │
                                              └─────────────────────────┘
                                                            │
                                                            ▼
                                              ┌─────────────────────────┐
                                              │  Stage 11: counter-     │
                                              │  factuals               │
                                              │  stage11-counter        │
                                              │   factuals.ts           │
                                              │  V3 deepseek-chat       │
                                              │  reads: full Prediction │
                                              │    Result + hook decomp │
                                              │    timestamps + persona │
                                              │    drop-off seconds     │
                                              │  out: exactly 3 ranked  │
                                              │    suggestions          │
                                              │  side-effect (D-18):    │
                                              │    if score<30 AND      │
                                              │    confidence>0.70 →    │
                                              │    push LIKELY_FLOP     │
                                              │    string to warnings[] │
                                              └─────────────────────────┘
                                                            │
                                                            ▼
                                            Final PredictionResult returned
                                            (gains: platform_fit?,
                                             critique?, counterfactuals?,
                                             possibly LIKELY_FLOP warning)
```

### Recommended Project Structure

```
src/lib/engine/
├── wave4/
│   ├── platform-fit.ts         # NEW — runPlatformFit() V3 orchestration
│   ├── platform-fit-prompts.ts # NEW — STABLE_SYSTEM_PROMPT + buildPlatformFitUserMessage()
│   ├── platform-fit-schemas.ts # NEW — Zod schema for PlatformFitResult[]
│   └── __tests__/
│       └── platform-fit.test.ts
├── stage10-critique.ts          # FILL — drop the no-op, ship real V3 call
├── stage10-critique-prompts.ts  # NEW — STABLE_SYSTEM_PROMPT for critique
├── stage10-critique-schemas.ts  # NEW — Zod schema for CritiqueResult JSON output
├── stage11-counterfactuals.ts   # FILL — drop the no-op, ship real V3 call
├── stage11-counterfactuals-prompts.ts   # NEW
├── stage11-counterfactuals-schemas.ts   # NEW
├── gemini/
│   ├── hook-segment.ts         # EXTEND — add watermark booleans to schema + prompt
│   └── schemas.ts              # EXTEND — HookSegmentZodSchema + HOOK_SEGMENT_GEMINI_SCHEMA gain watermark
├── aggregator.ts               # EXTEND — SCORE_WEIGHTS gains platform_fit: 0.05; selectWeights normalizes
├── pipeline.ts                 # EXTEND — call runPlatformFit between Wave 3 and aggregateScores
└── types.ts                    # EXTEND — PlatformFitResult, SignalAvailability.platform_fit?, PredictionResult.platform_fit/critique/counterfactuals optional fields
```

### Pattern 1: Stable System Prompt + Volatile User Message (DeepSeek input cache)

**What:** Every V3 call uses a 2-message structure: a byte-identical system prompt that loads the prompt into the model + cache, and a per-request user message with the dynamic context. DeepSeek's automatic input cache keys on the system prefix bytes; cache-hit pricing is ~50x cheaper than cache-miss.

**When to use:** All three new V3 calls (platform-fit, critique, counterfactuals) — exact same constraints as Phase 7 personas (D-04, D-17) and Phase 3 reasoning (D-20).

**Example:**

```typescript
// Source: src/lib/engine/wave3.ts:54-123 (PATTERN — STABLE_SYSTEM_PROMPT layout)
//         src/lib/engine/deepseek.ts:54-123 (PATTERN — STABLE_SYSTEM_PROMPT)

// platform-fit-prompts.ts
const STABLE_SYSTEM_PROMPT = `You are a TikTok / Instagram Reels / YouTube Shorts platform algorithm fit scorer trained on the explicit rules of Jenny Hoyos, Ava Yuergens, and Alex Hormozi.

[~400-token distilled excerpt from creator-intelligence.md, byte-identical across calls:
 - Platform Algorithm Insights section (Jenny + Ava + Hormozi platform rules)
 - Numerical Rules table rows 1-10 (hook stack, reading level, optimal length, retention thresholds)
 - Cross-Creator Consensus items 5 (audio-off), 8 (niche), 10 (volume)
 - Creator-tier rules: TikTok algorithmically favors nano-creators]

## Scoring Methodology
For each requested platform, score fit_score 0-100 using the platform-specific rubric.
Then return rationale (2-4 sentences, must cite a creator framework or numerical rule by name).
If watermark_penalty=true, lower the fit_score by 10-20 points and explain in rationale.

## Output JSON Schema
{ "platforms": [ { "platform": "tiktok"|"ig_reels"|"yt_shorts", "fit_score": 0-100, "rationale": "string", "watermark_penalty": boolean } ] }

Return ONLY this JSON object. Never use vague language ("could be better"). Always reference a specific rule, score, or timestamp.`;

export function buildPlatformFitUserMessage(ctx: PlatformFitContext): string {
  // Per-call volatile content — never mutate STABLE_SYSTEM_PROMPT.
  // Includes: target platforms, follower_tier, gemini factor scores, persona aggregate,
  // hook decomposition, retrieval evidence (top 3 outcomes), watermark flags from Gemini.
  // 600-1200 user tokens per call.
}
```

**Reference verbatim copy-paste targets:**
- `src/lib/engine/deepseek.ts:54-123` — STABLE_SYSTEM_PROMPT layout
- `src/lib/engine/wave3.ts:30-31` — `process.env.DEEPSEEK_PERSONA_MODEL ?? "deepseek-v4-flash"` env override pattern
- `src/lib/engine/wave3.ts:166-220` — V3 call + Zod parse + cost telemetry + Sentry tags

### Pattern 2: Aggregator Signal Extension (Phase 8 precedent — exact replication)

**What:** Adding a new weight-bearing signal to `aggregator.ts`. The `selectWeights` function normalizes whatever raw weights sum to, so the math is forgiving — just add the new key.

**When to use:** Wiring `platform_fit` into the aggregator at initial weight 0.05.

**Example:**

```typescript
// Source: src/lib/engine/aggregator.ts:50-69 (SCORE_WEIGHTS + SCORE_WEIGHT_KEYS pattern)
// Phase 8 D-03b precedent — retrieval: 0.05 was added the exact same way.

export const SCORE_WEIGHTS = {
  behavioral: 0.35,
  gemini: 0.25,
  ml: 0.15,
  rules: 0.15,
  trends: 0.10,
  audio: 0.07,        // Phase 6
  retrieval: 0.05,    // Phase 8
  platform_fit: 0.05, // Phase 9 — Phase 10 calibrates
} as const;

// Add to SCORE_WEIGHT_KEYS tuple:
export const SCORE_WEIGHT_KEYS = [
  "behavioral", "gemini", "ml", "rules", "trends", "audio", "retrieval", "platform_fit",
] as const;

// SignalAvailability extension (types.ts):
//   platform_fit?: boolean;  // Optional for back-compat with pre-Phase-9 callsites

// selectWeights() — no manual changes needed. The back-compat pattern at lines 172-176
// (audioInInput / retrievalInInput hasOwnProperty check) generalizes; just add a third
// `platformFitInInput` check.

// aggregateScores() — pluck platform_fit_score (mean of platforms[].fit_score),
// scale to 0-100, multiply by weights.platform_fit, add to raw_overall_score sum.
```

**Reference verbatim copy-paste targets:**
- `src/lib/engine/aggregator.ts:172-218` — back-compat hasOwnProperty pattern for new optional signals
- `src/lib/engine/aggregator.ts:790-812` — `raw_overall_score` weighted-sum extension (just append a new term)
- `src/lib/engine/aggregator.ts:676-717` — `availability: SignalAvailability` construction site

### Pattern 3: Graceful Degradation on V3 Failure

**What:** No phase 9 stage may throw. Failure → null result → `SignalAvailability.platform_fit = false` → `selectWeights` redistributes the 0.05 share to surviving signals.

**When to use:** Every external call (V3, Gemini extension).

**Example:**

```typescript
// Source: src/lib/engine/wave3.ts:83-107 + 260-289 (graceful Wave 3 outcome)
//         src/lib/engine/stage10-critique.ts (Phase 3 no-op contract: NEVER THROWS)

export async function runPlatformFit(
  pipelineResult: PipelineResult,
  onEvent?: StageEventCallback,
): Promise<PlatformFitResult[] | null> {
  const startTs = emitStageStart(onEvent, "platform_fit", "post");
  let costCents = 0;
  try {
    if (isCircuitOpen()) {
      emitStageEnd(onEvent, "platform_fit", "post", startTs, { cost_cents: 0, ok: false, warning: "circuit_open" });
      return null;
    }
    // ... V3 call, Zod parse ...
    emitStageEnd(onEvent, "platform_fit", "post", startTs, { cost_cents: +costCents.toFixed(6), ok: true });
    return results;
  } catch (err) {
    Sentry.captureException(err, { tags: { stage: "platform_fit" } });
    emitStageEnd(onEvent, "platform_fit", "post", startTs, { cost_cents: +costCents.toFixed(6), ok: false, warning: String(err) });
    return null;
  }
}
```

**Reference verbatim copy-paste targets:**
- `src/lib/engine/wave3.ts:94-107` — circuit-breaker fast-fail pattern
- `src/lib/engine/wave3.ts:221-256` — try/catch + Sentry + emitStageEnd in finally
- `src/lib/engine/stage10-critique.ts:11-22` — current no-op return + event emit contract

### Pattern 4: Gemini Hook Segment Watermark Extension (no new call)

**What:** Add three new booleans (`watermark_tiktok`, `watermark_ig`, `watermark_yt`) to the existing Hook-segment Gemini Pro responseSchema + Zod schema. The hook frame (frame 1) is exactly where watermarks appear; the call is already running and already pays for the input-token frame analysis.

**When to use:** Always — Phase 5 hook segment is the cheapest detection point. Adds zero new Gemini calls.

**Example:**

```typescript
// Source: src/lib/engine/gemini/schemas.ts:49-62 + 146-204

// schemas.ts — Zod extension
export const HookDecompositionZodSchema = z.object({
  visual_stop_power: ScoreSchema,
  audio_hook_quality: ScoreSchema,
  text_overlay_score: ScoreSchema,
  first_words_speech_score: ScoreSchema,
  weakest_modality: z.enum([...]),
  visual_audio_coherence: ScoreSchema,
  cognitive_load: ScoreSchema,
  // NEW Phase 9:
  watermark_detected: z.object({
    tiktok: z.boolean(),
    ig: z.boolean(),
    yt: z.boolean(),
  }).optional(),  // optional for back-compat with pre-Phase-9 cached results
});

// schemas.ts — Gemini literal extension (mirror Zod additions; per Pitfall #7 hand-write both)
// Add to HOOK_SEGMENT_GEMINI_SCHEMA.properties.hook_decomposition.properties.watermark_detected

// prompts.ts — buildHookSystemPrompt addition
// Add to "The 4 Sub-Modality Scores" section:
// "## Watermark Detection
// Examine the hook frame for platform-export watermarks:
// - TikTok: '@username' bottom-right with TikTok logo or 'TikTok' text
// - Instagram: Instagram Reels logo bottom-left or '@username' on coloured gradient
// - YouTube Shorts: Shorts logo + '@channel' bottom
// Return watermark_detected.{tiktok|ig|yt} as boolean.
// Set false unless visible chrome from that platform's export."
```

**Reference verbatim copy-paste targets:**
- `src/lib/engine/gemini/schemas.ts:49-62` — HookDecompositionZodSchema
- `src/lib/engine/gemini/schemas.ts:174-203` — HOOK_SEGMENT_GEMINI_SCHEMA Gemini literal
- `src/lib/engine/gemini/prompts.ts:30-67` — buildHookSystemPrompt extension point

### Anti-Patterns to Avoid

- **Putting per-call dynamic data in STABLE_SYSTEM_PROMPT.** Kills DeepSeek input cache hit rate (D-20). Calibration percentiles, creator profile fields, video content all belong in the USER message. (Phase 7 D-04 + Phase 3 RESEARCH Pitfall 3 — verified pattern.)
- **Hard-coding the confidence cap inside the model prompt.** D-11 says -20 percentage points max. Enforce in TS (`Math.max(currentConf - 0.20, currentConf + critiqueResult.confidence_adjustment)`), NOT by asking V3 to behave. V3 will violate it ~10% of the time. [VERIFIED: pattern from existing aggregator.ts confidence floor enforcement at lines 305-307, 846-848]
- **Asking V3 to output the LIKELY_FLOP warning string.** It's a TS-side derivation: `if (overall_score < 30 && confidence > 0.7) warnings.push(buildLikelyFlopString(top2NegativeFactors))`. Deterministic. The model just needs to emit the counterfactual suggestions; the warning is generated from existing values.
- **Mutating `PredictionResult.overall_score` in critique.** D-10 lock — critique adjusts confidence ONLY. The aggregator computed the score with all signals; critique answers "should we trust it" not "is it wrong."
- **Allowing V3 to return >3 or <3 counterfactual suggestions.** D-15 lock. Zod schema: `z.array(suggestionSchema).length(3)`. If V3 returns 5, Zod rejects, retry attempt does the prompt-injection "Your previous response had wrong count, return EXACTLY 3" addendum (mirrors wave3.ts:530-532 single-retry pattern).
- **Trying to share state between the three new V3 calls.** Each runs independently with its own STABLE prefix. The platform-fit call result IS available to critique via PredictionResult.platform_fit, but the critique prompt should not re-quote platform-fit rationales (token bloat). It should reference them by score.
- **Embedding URLs from `past_wins` / `past_flops` in any prompt.** Phase 2 T-02-01 prompt-injection mitigation. Use counts only (`past_wins.length`, `past_flops.length`). The pattern of wins/flops vs current prediction is what matters — not the URLs.
- **Generating watermark detection as a separate Gemini call.** Same call (hook segment) covers it. Adding a Body or CTA call for watermark detection wastes ~$0.005-0.01 per analysis.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-platform fit scoring as a regex/rule formula | A `computeTikTokFit(features): number` formula | The V3 prompt with the locked rubric. D-01: AI-scored, not rule-based. The value is contextual ("hook is strong but no loop") not formulaic. |
| Confidence label categorization | New `criticalConfidenceLabel(num)` function | The existing `confidence_label` ladder in `aggregator.ts:305-307` (HIGH ≥0.7, MEDIUM ≥0.4, LOW). The critique adjusts the numeric value; existing ladder recomputes the label. |
| New `signal_availability` provenance flag for `platform_fit_watermark` | Adding a separate watermark-bearing key | The watermark is a Gemini hook-segment derivative; it inherits `signal_availability.gemini_hook` for provenance. Adding a separate flag would inflate the JSONB schema. |
| Custom anti-virality detection algorithm | A new "viralityClassifier" | Deterministic threshold check: `overall_score < 30 && confidence > 0.7`. D-18 lock. Append string to existing `warnings[]`. |
| New DeepSeek client | New `DeepSeekClient` class | Reuse the existing `getClient()` factory pattern from `deepseek.ts:243-253` and `wave3.ts:45-53`. Same `baseURL: "https://api.deepseek.com"`, same `DEEPSEEK_API_KEY` env. |
| Custom Zod-to-Gemini schema converter | A `zodToGemini(schema)` codegen | Hand-write both schemas (Phase 5 Pitfall #7). `zod-to-json-schema` emits incompatible keywords (`$schema`, `additionalProperties`, `$ref`). Verified by Phase 5 — accept the duplication. |
| New stage event type for `LIKELY_FLOP` | A new discriminated-union variant | The existing `pipeline_warning` stage event covers it: `onEvent?.({ type: "pipeline_warning", stage: "stage_11_counterfactuals", message: "LIKELY_FLOP: ..." })`. |
| Custom counterfactual ranking algorithm | A `sortByImpact(suggestions): suggestion[]` heuristic | V3 returns them already ranked per D-15 ("ranked by estimated impact, highest first"). The Zod schema enforces order via array position; no client-side sort. |

**Key insight:** Phase 9 is the *last* phase that needs to convince the planner Phase 10 will calibrate the weight. Phase 10 *does* exist, and `selectWeights` already has the normalization machinery (lines 211-218 of aggregator.ts) to absorb any base-weight change without manual rebalancing. Don't try to "rebalance" the SCORE_WEIGHTS manually — just add `platform_fit: 0.05` and the normalizer handles the rest.

## Runtime State Inventory

Not applicable — this is a greenfield additive phase. No renames, no migrations, no datastore state changes. The only persistence-adjacent change is widening the `PredictionResult` JSONB shape on the existing `analysis_results.signal_availability` and `analysis_results` row (existing columns; no migration). Phase 3's missing-key default-to-false rule covers backwards compatibility for the new `platform_fit` SignalAvailability key.

**Nothing found in category:** None — verified by phase scope review against the Step 2.5 categories (stored data / live service config / OS-registered state / secrets-env / build artifacts).

## Environment Availability

Not applicable for Phase 9 — all dependencies are libraries already installed and exercised by Phases 5-8. The only external services touched are DeepSeek (3 new calls; `DEEPSEEK_API_KEY` already configured) and Gemini Pro (extending an existing call; `GEMINI_API_KEY` already configured). No new infra, no new env vars except optionally `DEEPSEEK_PLATFORM_FIT_MODEL` / `DEEPSEEK_CRITIQUE_MODEL` / `DEEPSEEK_COUNTERFACTUAL_MODEL` (planner discretion, default `deepseek-v4-flash` per Phase 7 precedent).

**Step 2.6: SKIPPED for code/config-only changes.**

## Common Pitfalls

### Pitfall 1: V3 returns wrong count of counterfactuals

**What goes wrong:** D-15 locks exactly 3 suggestions. V3 ignores the "exactly 3" instruction ~5-10% of the time, returning 2, 4, or 5. If Zod schema uses `.length(3)`, the safeParse fails. If it uses `.min(1).max(5)`, the consumer (M2 UI) sees inconsistent counts.

**Why it happens:** "Exactly N" is a token-budget directive the model treats as a soft suggestion. Model output is generative; counts are emergent from token decisions.

**How to avoid:** Use `.length(3)` Zod schema. On safeParse failure, send a single corrective retry (mirror `deepseek.ts:530-532`). If retry also fails, return null (graceful degradation). The Phase 5 hook-segment pattern (`HOOK_MAX_RETRIES = 1` for Zod failures) is the established model.

**Warning signs:** `pipeline_warning` events with `stage: "stage_11_counterfactuals"` and message containing "validation failed" or "array length".

### Pitfall 2: Watermark detection false-positives on UGC text overlays

**What goes wrong:** Gemini Pro mistakes a creator's stylized "@username" text overlay (decorative, brand-personal) for a TikTok watermark. Lowers IG + YT fit scores incorrectly.

**Why it happens:** Vision models conflate platform-chrome watermarks with creator branding. TikTok export watermark has specific layout (bottom-right with TikTok logo) but a creator's own "@username" handle is similar.

**How to avoid:** In the watermark prompt section, explicitly include negative examples: "DO NOT mark as watermark: creator-added branding, personal username overlays without platform logo, decorative text. ONLY mark true when the platform's logo OR a visible export chrome (e.g., 'TikTok' wordmark) is present." Verify in test fixtures (use 2-3 watermarked + 2-3 non-watermarked samples).

**Warning signs:** Cross-platform fit_score deltas of 10-20 points in test runs where the input is known to be a clean upload.

### Pitfall 3: Critique confidence_adjustment exceeds -0.20 cap

**What goes wrong:** D-11 caps at -0.20. V3 returns `-0.35` because it found two consistency violations. If consumed naively, confidence drops by 35 pp instead of 20.

**Why it happens:** Locking V3 to a hard range requires deterministic clipping on the consumer side, not on the model side.

**How to avoid:** Clamp in TypeScript: `const adjustment = Math.max(-0.20, Math.min(0, critiqueResult.confidence_adjustment))`. Apply ONLY after the safeParse. Document in the consuming code that any value outside [-0.20, 0] is silently clamped (don't log warning — it's expected behavior).

**Warning signs:** Critique tests fail when input critique JSON has `confidence_adjustment: -0.30` and the expected final confidence reflects only a -0.20 drop.

### Pitfall 4: STABLE_SYSTEM_PROMPT changes break input cache

**What goes wrong:** A planner edits the system prompt to "improve clarity" (e.g., add a comma, capitalize a word). DeepSeek's automatic input cache hashes the system prefix bytes. Any edit invalidates the cache for ALL active sessions. Cost jumps ~50x for the next ~1000 calls until the new prompt warms up.

**Why it happens:** Cache keys on byte-identical prefix. Even whitespace changes invalidate. This is the Phase 7 RESEARCH Pitfall 3 — already documented.

**How to avoid:** Treat the STABLE_SYSTEM_PROMPT string as a versioned artifact. Document the byte-equivalence rule in a JSDoc above the constant. Add a Vitest snapshot test that pin-tests the SHA-256 of the prompt (`expect(sha256(STABLE_SYSTEM_PROMPT)).toBe("...")`) — any prompt edit forces an intentional snapshot update + cache-warming acknowledgement.

**Warning signs:** Cost telemetry showing `cache_hit_rate` dropping from ~0.9 to ~0.0 across multiple stages within the same day.

### Pitfall 5: Platform-fit prompt runs on platforms NOT in Card 0

**What goes wrong:** V3 returns fit scores for all three platforms (TikTok + IG + YT) even when the creator selected only TikTok in Card 0. PredictionResult.platform_fit has 3 entries instead of 1.

**Why it happens:** Generative ambiguity. The system prompt instructs "score the requested platforms" but if the user message lists all three (in any context), the model often scores all three.

**How to avoid:** Build the user message with explicit "ONLY score: tiktok" instruction when Card 0 has one platform. Zod schema: `z.array(...).min(1).max(3)`. Optionally filter post-parse: `results.filter(r => targetPlatforms.includes(r.platform))`.

**Warning signs:** Test fixture with `target_platforms: ["tiktok"]` returns `platform_fit.length === 3`.

### Pitfall 6: Counterfactual timestamps reference impossible video moments

**What goes wrong:** V3 suggests "Move the hook to 0:08" but the video is 6 seconds long. Or suggests "Recover the 0:02 retention drop" when the hook decomp signal is unavailable (`signal_availability.gemini_hook = false`).

**Why it happens:** D-17 explicitly handles the unavailable case but V3 hallucinates timestamps to comply with the "be hyper-specific" instruction (D-16).

**How to avoid:** Inject `payload.duration_hint` into the user message and explicitly instruct: "Only reference timestamps in [0, ${duration_hint}]. When hook decomposition is unavailable (signal_availability.gemini_hook = false), use general phrasing without seconds." Add a Zod refinement on suggestion text: a regex match for `\d+:\d{2}` extracts ranges; refinement validates they're inside [0, duration].

**Warning signs:** Counterfactual test fixtures with mock 6-second video receiving suggestion text mentioning "0:10" or "0:15".

### Pitfall 7: LIKELY_FLOP warning fires on legitimately-uncertain predictions

**What goes wrong:** D-18 says fire when `overall_score < 30 AND confidence > 0.70`. But after the critique drops confidence (D-11 max -0.20), a prediction at confidence 0.85 could end at 0.65 — JUST below the LIKELY_FLOP threshold. If you read the pre-critique confidence, the warning fires; if you read the post-critique value, it doesn't. The order matters.

**Why it happens:** Stage ordering. Counterfactuals run AFTER critique adjusts confidence.

**How to avoid:** Lock the LIKELY_FLOP check inside `stage11-counterfactuals.ts` reading the POST-critique confidence value (the final, clamped confidence). Document this ordering invariant inline. Pipeline order: aggregator → critique → counterfactuals (with LIKELY_FLOP derivation), so by the time stage 11 runs, the critique has already adjusted confidence on the PredictionResult.

**Warning signs:** Predictions with `overall_score = 28, confidence = 0.85` (pre-critique) showing LIKELY_FLOP in the final result even when critique drops confidence below 0.70.

## Code Examples

### Platform-Fit V3 Call (with cache-aware cost telemetry)

```typescript
// Source pattern: src/lib/engine/wave3.ts:162-220 (V3 call + Zod + cost)

// wave4/platform-fit.ts
import OpenAI from "openai";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { emitStageStart, emitStageEnd, type StageEventCallback } from "../events";
import { isCircuitOpen } from "../deepseek";
import type { PipelineResult } from "../pipeline";
import { PlatformFitResultSchema, type PlatformFitResult } from "./platform-fit-schemas";
import { STABLE_PLATFORM_FIT_SYSTEM_PROMPT, buildPlatformFitUserMessage } from "./platform-fit-prompts";

const MODEL = process.env.DEEPSEEK_PLATFORM_FIT_MODEL ?? "deepseek-v4-flash";
const TIMEOUT_MS = 15_000;
const CACHE_HIT_PRICE = 0.0028 / 1_000_000;
const CACHE_MISS_PRICE = 0.14 / 1_000_000;
const OUTPUT_PRICE = 0.28 / 1_000_000;

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY");
    client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
  }
  return client;
}

const ResponseSchema = z.object({
  platforms: z.array(PlatformFitResultSchema).min(1).max(3),
});

export async function runPlatformFit(
  pipelineResult: PipelineResult,
  onEvent?: StageEventCallback,
): Promise<{ results: PlatformFitResult[]; cost_cents: number } | null> {
  const start = emitStageStart(onEvent, "platform_fit", "post");
  if (isCircuitOpen()) {
    emitStageEnd(onEvent, "platform_fit", "post", start, { cost_cents: 0, ok: false, warning: "circuit_open" });
    return null;
  }
  const targetPlatforms =
    pipelineResult.creatorContext.target_platforms?.length
      ? (pipelineResult.creatorContext.target_platforms as Array<"tiktok" | "ig_reels" | "yt_shorts">)
      : (["tiktok"] as const);

  const ai = getClient();
  let attempt = 0;
  let costCents = 0;
  let lastError: Error | null = null;

  while (attempt <= 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const userMessage = buildPlatformFitUserMessage(pipelineResult, targetPlatforms, attempt > 0);
      const response = await ai.chat.completions.create(
        {
          model: MODEL,
          messages: [
            { role: "system", content: STABLE_PLATFORM_FIT_SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
          response_format: { type: "json_object" },
        },
        { signal: controller.signal },
      );
      clearTimeout(timer);

      const usage = response.usage as unknown as {
        prompt_tokens?: number;
        prompt_cache_hit_tokens?: number;
        prompt_cache_miss_tokens?: number;
        completion_tokens?: number;
      };
      const cacheHit = usage?.prompt_cache_hit_tokens ?? 0;
      const cacheMiss = usage?.prompt_cache_miss_tokens ?? 0;
      const completion = usage?.completion_tokens ?? 0;
      const hasBreakdown = cacheHit > 0 || cacheMiss > 0;
      const inputCost = hasBreakdown
        ? cacheHit * CACHE_HIT_PRICE + cacheMiss * CACHE_MISS_PRICE
        : (usage?.prompt_tokens ?? 0) * CACHE_MISS_PRICE;
      costCents += (inputCost + completion * OUTPUT_PRICE) * 100;

      const text = response.choices[0]?.message?.content ?? "{}";
      const parsed = ResponseSchema.safeParse(JSON.parse(text));
      if (!parsed.success) {
        lastError = new Error(`Zod validation failed: ${parsed.error.message}`);
        if (attempt === 0) { attempt++; continue; }
        throw lastError;
      }
      // Filter to the requested platforms (Pitfall 5 defense)
      const results = parsed.data.platforms.filter((p) =>
        (targetPlatforms as readonly string[]).includes(p.platform),
      );
      emitStageEnd(onEvent, "platform_fit", "post", start, { cost_cents: +costCents.toFixed(6), ok: true });
      return { results, cost_cents: costCents };
    } catch (err) {
      clearTimeout(timer);
      lastError = err instanceof Error ? err : new Error(String(err));
      attempt++;
      if (attempt > 1) break;
    }
  }
  Sentry.captureException(lastError, { tags: { stage: "platform_fit" } });
  emitStageEnd(onEvent, "platform_fit", "post", start, {
    cost_cents: +costCents.toFixed(6), ok: false, warning: lastError?.message,
  });
  return null;
}
```

### Critique Confidence Clamping (Pitfall 3 defense)

```typescript
// Source pattern: src/lib/engine/aggregator.ts:305-309 (confidence floor enforcement)

export function applyCritiqueAdjustment(
  currentConfidence: number,
  critique: CritiqueResult,
): number {
  // D-11: hard cap at -0.20 percentage points.
  // Clamp on the consumer side; never trust the model output range.
  const adjustment = Math.max(-0.20, Math.min(0, critique.confidence_adjustment));
  const next = Math.max(0, Math.min(1, currentConfidence + adjustment));
  return next;
}
```

### Anti-Virality Warning Derivation

```typescript
// Source pattern: src/lib/engine/aggregator.ts:855-880 (warning push pattern)

export function maybeAppendLikelyFlopWarning(
  result: PredictionResult,  // mutates warnings[] in place
): void {
  if (result.overall_score >= 30 || result.confidence <= 0.7) return;
  const top2Negative = [...result.factors]
    .filter((f) => f.score <= 5)
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .map((f) => `${f.name} (${f.score}/10)`);
  if (top2Negative.length === 0) {
    result.warnings.push(
      `LIKELY_FLOP: High-confidence prediction that this video will underperform (score ${result.overall_score}/100, confidence ${(result.confidence * 100).toFixed(0)}%).`,
    );
    return;
  }
  result.warnings.push(
    `LIKELY_FLOP: High-confidence prediction that this video will underperform (score ${result.overall_score}/100, confidence ${(result.confidence * 100).toFixed(0)}%). Primary drag: ${top2Negative.join(", ")}.`,
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hard-coded rule formula for platform fit | V3 contextual scoring with cited frameworks | Phase 9 D-01 | "TikTok favors X" reasoning becomes platform- + creator-tier-specific |
| `deepseek-reasoner` for all V3 calls | `deepseek-v4-flash` (non-thinking) for parallel-friendly structured calls | Phase 7 PERSONA-09 | 3-5x cheaper, ~2x faster; thinking-mode reserved for the main deepseek_reasoning Wave 2 call |
| `audioResult: null` no-op + `stage10/11` no-op stubs | Real signal modules behind same wire interface | Phases 6/9 (additive replacement) | Existing tests pass; new signals populate previously-null fields |
| Manual weight rebalancing on SCORE_WEIGHTS edits | `selectWeights` normalizes whatever raw weights sum to | Phase 6 D-G1 + Phase 8 D-03b precedent | Phase 9 can append `platform_fit: 0.05` without touching any existing weight values |
| Phase 5 hook segment returns 7-field decomposition | Hook segment returns 8-field decomposition (adds `watermark_detected: { tiktok, ig, yt }`) | Phase 9 D-04 (extension) | One new optional schema field; cached predictions degrade gracefully (missing key → all false) |

**Deprecated/outdated:**

- Static rule-based platform scoring (rejected by D-01 — contextual reasoning wins).
- The Phase 3 placeholder semantics of `runStage10Critique` and `runStage11Counterfactuals` returning `null` (Phase 9 fills with real V3 calls).
- The Phase 5 `HookDecompositionZodSchema` without watermark fields (extended by Phase 9).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | DeepSeek V3 (`deepseek-v4-flash`) handles JSON-only outputs reliably for 3-platform, 4-check, 3-counterfactual schemas with single-retry success rate ≥ 95% | Pitfall 1, Pattern 3 | If success rate is lower, plans need to add a second retry attempt or fallback to a synthesized null result more often. Phase 7 wave3 single-retry has worked at scale, but Phase 9 schemas are larger (especially counterfactuals with prose suggestions). [ASSUMED — Phase 10 corpus eval will validate] |
| A2 | DeepSeek input cache provides ~50× discount when the system prompt is byte-identical and cache prefix matches | Pattern 1, Pitfall 4 | If cache discount is smaller in practice, per-call cost rises ~3-5×. Phase 7 RESEARCH MEDIUM-confidence assumption — same assumption inherited. Verify against `api-docs.deepseek.com/quick_start/pricing` at deploy time. [ASSUMED] |
| A3 | Gemini Pro can reliably detect platform-export watermarks on the hook frame with low false-positive rate | Pattern 4, Pitfall 2 | If false-positive rate exceeds ~10%, the cross-platform penalty fires incorrectly. Mitigation: explicit negative-example prompting + test fixtures. [ASSUMED — needs 5-10 fixture validation in Phase 9 testing plan] |
| A4 | Phase 5 `HookDecompositionZodSchema` `.optional()` extension is back-compat with persisted JSONB rows (missing keys default to undefined) | Pattern 4 | If existing cached rows hit a Zod parse boundary with `.optional()`-marked watermark field, parse should still succeed (optional = missing OK). [VERIFIED by analogy to Phase 6 D-G1 `audio?: boolean` extension pattern at types.ts:260; same precedent applies here] |
| A5 | The 4 locked critique checks (D-13) can all be expressed in a single V3 system prompt with reasonable cache-hit potential | Pattern 1, Pitfall 4 | If the system prompt grows beyond ~2K tokens, cache-hit becomes marginal (longer prefixes are more likely to be partially-invalidated). [ASSUMED — D-19 says 500-token grounding, well within budget] |
| A6 | `creator-intelligence.md` distilled excerpts of 400/500/600 tokens preserve enough framework specificity for V3 to cite frameworks by name in outputs (Hormozi, Jenny, Ava) | Pattern 1, D-19 in CONTEXT | If distillation drops too much creator framework material, V3 will hallucinate generic "best practices" instead of citing named frameworks (violates D-21 specificity rule). Mitigation: include Numerical Rules table rows + Cross-Creator Consensus items as the highest-density payload. [ASSUMED — planner picks final excerpts during planning phase] |
| A7 | Counterfactual quality is the dominant value driver for user perception, NOT platform-fit or critique | D-21 emphasis | If platform-fit quality matters more, prompt-engineering budget should rebalance. User CONTEXT D-21 explicitly highlights counterfactual specificity. [ASSUMED — confirmed by user note in CONTEXT specifics section] |

**If this table is empty:** It isn't — Phase 9 has 7 explicit assumptions that planner / discuss-phase should validate.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (project standard — `pnpm vitest run`) |
| Config file | `vitest.config.ts` at repo root |
| Quick run command | `pnpm vitest run --reporter=verbose src/lib/engine/wave4/__tests__/platform-fit.test.ts` (after creation) |
| Full suite command | `pnpm vitest run` (covers all 203+ existing + new Phase 9 tests) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ALGO-01..03 | Per-platform fit V3 call produces 0-100 score + rationale citing creator framework | unit (mock V3) | `pnpm vitest run platform-fit` | ❌ Wave 0 |
| ALGO-04 | Only Card 0 platforms are scored; empty Card 0 → TikTok only | unit | `pnpm vitest run platform-fit` | ❌ Wave 0 |
| ALGO-05 | Creator tier (nano/micro/mid/large/mega) flows into V3 user message; output reflects tier in rationale | unit (snapshot user message) | `pnpm vitest run platform-fit-prompts` | ❌ Wave 0 |
| ALGO-06 | Gemini hook segment Zod schema accepts `watermark_detected` and returns booleans | unit | `pnpm vitest run gemini-schemas` | ✅ extends existing `gemini-schemas.test.ts` |
| ALGO-06 (cross-platform) | Watermark on platform X lowers fit score on all OTHER targeted platforms | integration | `pnpm vitest run platform-fit-watermark` | ❌ Wave 0 |
| CRITIQUE-01 | `stage10-critique.ts` returns CritiqueResult (non-null) when V3 succeeds | unit (mock V3) | `pnpm vitest run critique` | ❌ Wave 0 |
| CRITIQUE-02 | Card 6 wins/flops counts are present in critique user message; URLs NEVER present | unit (snapshot) + assertion | `pnpm vitest run critique-prompts` | ❌ Wave 0 |
| CRITIQUE-03 | confidence_adjustment is clamped to [-0.20, 0]; final confidence = max(0, prev + adj) | unit | `pnpm vitest run critique-clamp` | ❌ Wave 0 |
| CRITIQUE-13 (4 consistency checks) | Each of the 4 checks (signal agreement, score-vs-factors, Card 6 match, over-confidence) is exercised by a fixture | unit (4 fixtures) | `pnpm vitest run critique-checks` | ❌ Wave 0 |
| COUNTER-01 | `stage11-counterfactuals.ts` returns exactly 3 ranked suggestions | unit (mock V3) | `pnpm vitest run counterfactuals` | ❌ Wave 0 |
| COUNTER-02 | Suggestions reference hook decomp timestamps when available; degrade gracefully when `signal_availability.gemini_hook=false` | unit (2 fixtures) | `pnpm vitest run counterfactuals` | ❌ Wave 0 |
| COUNTER-03 | Always runs (no premium gate); both score<50 and score>80 fixtures produce 3 suggestions | unit | `pnpm vitest run counterfactuals` | ❌ Wave 0 |
| COUNTER-04 | LIKELY_FLOP appended to warnings[] iff `score<30 AND confidence>0.70` (post-critique values) | unit (4 boundary fixtures: 29/0.71, 30/0.71, 29/0.69, 30/0.69) | `pnpm vitest run likely-flop` | ❌ Wave 0 |
| AGG-extension | platform_fit signal participates in `selectWeights`; available=false redistributes | unit | `pnpm vitest run aggregator-platform-fit` | ❌ Wave 0 (extends `aggregator.test.ts`) |
| Pipeline integration | runPlatformFit invoked AFTER Wave 3, BEFORE aggregateScores; stage events emit | integration | `pnpm vitest run pipeline` (existing test) | ✅ extend `pipeline.test.ts` |
| BENCH-05 | All 203+ existing tests still pass after Phase 9 changes | regression | `pnpm vitest run` | ✅ all existing |

### Sampling Rate

- **Per task commit:** `pnpm vitest run src/lib/engine/wave4/ src/lib/engine/__tests__/stage10*.test.ts src/lib/engine/__tests__/stage11*.test.ts src/lib/engine/__tests__/aggregator.test.ts`
- **Per wave merge:** `pnpm vitest run` (full suite)
- **Phase gate:** Full suite green AND BENCH-05 regression check before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `src/lib/engine/wave4/__tests__/platform-fit.test.ts` — covers ALGO-01..06
- [ ] `src/lib/engine/wave4/__tests__/platform-fit-prompts.test.ts` — covers user-message construction (snapshot)
- [ ] `src/lib/engine/__tests__/stage10-critique.test.ts` — covers CRITIQUE-01..03 + 4 consistency check fixtures (CRITIQUE-13)
- [ ] `src/lib/engine/__tests__/stage11-counterfactuals.test.ts` — covers COUNTER-01..04
- [ ] `src/lib/engine/__tests__/aggregator-platform-fit.test.ts` — covers AGG-extension for the new signal (or extend existing `aggregator.test.ts`)
- [ ] Extend `src/lib/engine/__tests__/gemini-schemas.test.ts` — adds watermark Zod schema assertions
- [ ] Extend `src/lib/engine/__tests__/pipeline.test.ts` — adds runPlatformFit invocation order + stage event assertions
- [ ] Test fixtures: 4-6 mock PredictionResult JSONs for critique fixtures (each exercising one consistency check); 2-3 PredictionResults for LIKELY_FLOP boundary tests; mock Gemini hook results with/without watermark booleans

*(No new framework install needed — Vitest already covers all of this. Reuse `src/lib/engine/__tests__/factories.ts` for shared fixtures.)*

## Security Domain

Phase 9 inherits the project-wide ASVS posture; the new prompts and responses introduce one new threat surface (prompt injection via creator-supplied content) but no new auth/access-control / cryptography concerns.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth surface; uses existing Supabase service client + DeepSeek API key (server-only) |
| V3 Session Management | no | n/a |
| V4 Access Control | no | RLS on `analysis_results` is unchanged; Phase 9 writes additive JSONB fields to existing rows under existing RLS |
| V5 Input Validation | yes | Zod schemas (`PlatformFitResultSchema`, `CritiqueResultSchema`, `CounterfactualResultSchema`) validate every V3 output. Inputs from `creatorContext` already validated upstream in Phase 2. `past_wins` / `past_flops` URLs are NEVER sent to LLMs (Phase 2 T-02-01) — counts only, enforced in prompt-builder. |
| V6 Cryptography | no | n/a |
| V14 (config) | partial | `DEEPSEEK_API_KEY` already secret-managed; new optional `DEEPSEEK_PLATFORM_FIT_MODEL` / `DEEPSEEK_CRITIQUE_MODEL` / `DEEPSEEK_COUNTERFACTUAL_MODEL` env vars are non-secret model name overrides |

### Known Threat Patterns for the Phase 9 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via creator caption / Card 6 URLs | Tampering (Information Disclosure) | Strip-and-count URLs before injecting (`past_wins.length`, never `past_wins.url`); treat creator-supplied free text (caption, pain_points) as untrusted — pass through Zod string max(N) sanitization at prompt-construction boundary; do NOT use string interpolation for control text (always pass via template literal with documented escape strategy). Phase 2 T-02-01 precedent. |
| Model output exfiltration via reflective rationale | Information Disclosure | All V3 outputs are JSON-schema-validated; free-text `rationale` / `flags` / `suggestions` fields are bounded by Zod `.max(N)` length limits. They are NEVER eval'd, NEVER passed back as code, and are presented in UI as plain text (not HTML — UI layer handles escaping). |
| Cost-amplification attack (large input padding) | Denial of Service | Stage-level cost soft/hard caps (mirror Phase 5 hook-segment `HOOK_COST_SOFT_CAP_CENTS = 1.6` / `HOOK_COST_HARD_CAP_CENTS = 2.0`). Per-call AbortController timeout `PER_CALL_TIMEOUT_MS = 15_000`. Single retry on Zod failure; no exponential backoff. |
| Cached prompt-bytes poisoning | Tampering | STABLE_SYSTEM_PROMPT lives in source code, not external storage. Cache-prefix bytes are immutable once deployed. Snapshot pin-test (Pitfall 4 mitigation) ensures unintended changes break CI rather than silently invalidate cache. |
| Watermark detection bypass via adversarial overlays | Tampering | Out of scope — watermark detection is best-effort and Phase 9 D-04 user note explicitly accepts this ("won't happen much"). Cross-platform penalty magnitude is small (10-20 points) so adversarial cost is low. |
| LLM emitting LIKELY_FLOP false-positives | Misclassification / DoS | LIKELY_FLOP is NOT model-generated. It's a deterministic TS check on (score, confidence). Model cannot trigger this warning. Pitfall 7 documents the ordering invariant. |

## Sources

### Primary (HIGH confidence)

- `src/lib/engine/wave3.ts` — Phase 7 implementation; the platform-fit V3 call should clone this orchestration pattern (lines 83-298)
- `src/lib/engine/deepseek.ts` — Phase 3 implementation; STABLE_SYSTEM_PROMPT pattern (lines 54-123); cache-aware pricing (lines 38-42); circuit breaker (lines 256-309)
- `src/lib/engine/aggregator.ts` — Phase 8 SCORE_WEIGHTS extension precedent (lines 50-69); `selectWeights` normalization (lines 146-252); SignalAvailability extension precedent (lines 676-717)
- `src/lib/engine/pipeline.ts` — Stage orchestration; Phase 8's `runBenchmarkRetrieval` integration (lines 609-650) is the direct precedent for adding `runPlatformFit` between Wave 3 and aggregate
- `src/lib/engine/stage10-critique.ts` + `stage11-counterfactuals.ts` — Phase 3 no-op stubs to fill
- `src/lib/engine/types.ts` — `CritiqueResult`, `CounterfactualResult`, `SignalAvailability`, `PredictionResult` shapes already defined for Phase 9
- `src/lib/engine/gemini/schemas.ts` — HookDecompositionZodSchema + HOOK_SEGMENT_GEMINI_SCHEMA (Phase 5) — extension point for watermark detection
- `src/lib/engine/gemini/prompts.ts` — `buildHookSystemPrompt` (lines 25-67); watermark detection instruction extends this prompt
- `src/lib/engine/corpus/follower-tier.ts` — `getFollowerTier()` mapping for ALGO-05 creator-tier-aware adjustment
- `src/lib/engine/creator.ts` — CreatorContext shape (lines 11-46) including `target_platforms`, `past_wins`, `past_flops`, `niche_primary` (Phase 2 D-19)
- `.planning/research/creator-intelligence.md` — source of truth for V3 prompt content (5,195 words; 40 numerical rules; 14+ named frameworks; 11 Cross-Creator Consensus items; 6 platform-specific rules per TikTok/IG/YT)
- `.planning/phases/07-multi-persona-simulation/07-CONTEXT.md` D-04 (stable system prompt + variable user message for DeepSeek cache), D-07 (per-metric aggregation), D-09 (JSON output shape)
- `.planning/phases/08-benchmark-retrieval/08-CONTEXT.md` D-03b (new signal initial weight redistribution; weights normalize via `selectWeights`); D-10 (`SignalAvailability.retrieval?` optional extension); D-04 (hierarchical relaxation example for how Phase 9 should think about graceful degradation)
- `.planning/phases/05-video-segmentation-hook-decomposition/05-CONTEXT.md` D-03 (hook window 0-5s); D-14 (gemini_hook stage event); hook decomp timestamp format

### Secondary (MEDIUM confidence)

- DeepSeek pricing (`api-docs.deepseek.com/quick_start/pricing`) — verified via Phase 3 + Phase 7 inheritance; A2 in Assumptions Log flags need to re-verify at deploy
- Gemini 3 Pro multi-modal vision capability for frame-1 watermark detection — A3 in Assumptions Log; needs fixture validation in Phase 9 testing

### Tertiary (LOW confidence)

- Specific cache-hit-rate target of ~95% after warmup — Phase 7 PROJECT.md statement; not measured in Phase 9 yet

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries already in use; no new dependencies
- Architecture: HIGH — three direct precedents (Phase 6 audio, Phase 7 wave3, Phase 8 retrieval) for new-signal addition pattern
- Pitfalls: MEDIUM-HIGH — Pitfalls 1-7 are derived from Phase 3/5/7 RESEARCH documents and known LLM output behaviors; Pitfall 2 (watermark false-positive) is genuinely unverified
- Prompt distillation: MEDIUM — depends on planner's selection of which `creator-intelligence.md` excerpts go in each system prompt; D-19 specifies the rough word budgets and section names, but the exact wording is Claude's discretion within those bounds

**Research date:** 2026-05-20
**Valid until:** ~30 days for the architecture + pitfalls; ~7 days for the cache-hit-rate / model-pricing assumptions (A1, A2)

---

*Phase: 09-platform-algo-fit-self-critique-counterfactuals*
*Research complete: 2026-05-20*
