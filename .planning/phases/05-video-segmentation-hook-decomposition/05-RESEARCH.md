# Phase 5: Video Segmentation + Hook Decomposition — Research

**Researched:** 2026-05-18
**Domain:** Multi-modal structured video extraction via `@google/genai` SDK; `Promise.allSettled` orchestration of three parallel scoped Gemini calls against one Files API upload.
**Confidence:** HIGH overall (HIGH on SDK + codebase patterns; HIGH on model availability via Vertex AI docs + Google AI Studio pricing; MEDIUM on hook-decomposition rubric calibration since the rubric is Virtuna's opinion, not a global standard).

---

## Summary

Phase 5 is **three parallel scoped `generateContent` calls** against a single Files API upload, **not** a new framework or a new pipeline. The existing single-call `analyzeVideoWithGemini` at `src/lib/engine/gemini.ts:409–545` is the canonical pattern; Phase 4 already proved the `videoMetadata: { startOffset: "0s", endOffset: "5s" }` shape works in `src/lib/engine/wave0/content-type-detector.ts:158`. Phase 5 splits one call into three, fans them out via `Promise.allSettled`, merges null-safe per-segment results into a widened `GeminiVideoAnalysis`, and deletes the Files API upload **after** all three settle. The AI-SPEC at `05-AI-SPEC.md` is the implementation contract — this RESEARCH supplies (a) verified SDK details, (b) verified model names + pricing as of 2026-05-18, (c) verified test mock pattern, and (d) the small set of corrections the AI-SPEC needs vs. the live API.

The three corrections the planner MUST honor:

1. **Model names are NOT bare aliases.** `gemini-3-pro` and `gemini-3-flash` do not resolve on the Gemini Developer API as of 2026-05-18. The Phase 4 codebase already uses `gemini-3-flash-preview` (`wave0/content-type-detector.ts:14` — *"bare alias invalid as of 2026-05-18"*). For Phase 5: **hook segment uses `gemini-3.1-pro-preview`** (Gemini 3 Pro was deprecated 2026-03-09 and its alias now redirects to `gemini-3.1-pro-preview` at identical pricing); **body + CTA use `gemini-3-flash-preview`**. The "always GA, never preview" rule from CONTEXT.md `<specifics>` is **factually unsatisfiable** for the hook tier as of 2026-05-18 — both `gemini-3-pro-preview` (deprecated) and `gemini-3.1-pro-preview` (still preview) are the only Pro options. Planner picks: use `gemini-3.1-pro-preview` and document the constraint, OR fall back to `gemini-3-flash-preview` for hook too (and accept the rubric-quality risk). See **§ Model Selection (verified)** below.

2. **Gemini SDK is at v2.4.0 on npm; project has v1.41.0.** No SDK upgrade is required for Phase 5 — the v2 release ships breaking changes only in the Interactions API, not in `generateContent` / `videoMetadata`. Phase 5 keeps `^1.41.0` and ships with the existing SDK; the v2 upgrade is a separate concern. See **§ Standard Stack** below.

3. **`SignalAvailability` already widened in Phase 4 — Phase 5 ADDS keys, doesn't redefine.** `src/lib/engine/types.ts:198–206` shows the current shape includes `content_type` and `niche` keys. Phase 5 adds `gemini_hook`, `gemini_body`, `gemini_cta`. The `gemini` key remains and is computed as `gemini_hook || gemini_body || gemini_cta` in the merge function.

**Primary recommendation:** Mirror the proven Phase 4 `content-type-detector.ts` shape three times — one helper per segment — inside a new `src/lib/engine/gemini/segmented.ts` orchestrator. Reuse the test mock pattern from `__tests__/wave0-content-type.test.ts`. Do NOT introduce any framework (LangChain, LangGraph, ADK) — the AI-SPEC framework decision is correct, and the existing 549 passing tests prove the pattern.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Hook → Gemini 3 Pro; Body + CTA → Gemini 3 Flash. All GA, all env-overridable.**
Hook gets Pro because the 6-dimension decomposition is reasoning-heavy and most user-differentiated. Body and CTA are description/scoring tasks Flash handles well at ~3-6× cheaper. Routed through `GEMINI_HOOK_MODEL` / `GEMINI_BODY_MODEL` / `GEMINI_CTA_MODEL` env vars.

> **Research correction**: As of 2026-05-18, **no GA Gemini 3 Pro exists on the Gemini Developer API** — `gemini-3-pro-preview` was deprecated 2026-03-09 (alias now redirects to `gemini-3.1-pro-preview`, which is also preview). `gemini-3-flash-preview` is preview, not GA. **Only `gemini-3.1-flash-lite` is GA in the Gemini 3 family.** Honoring "always GA, never preview" literally would require dropping to `gemini-3.1-flash-lite` on all three segments — abandoning the Pro tier entirely. Recommend planner surface this contradiction to user before locking model defaults; see **§ Model Selection (verified)**.

- **D-02:** SEGMENT-06 satisfied by D-01's three env vars (env-var-with-default pattern matches `gemini.ts:17` idiom).
- **D-03:** Hook window = 0-5s (matches Phase 4 Wave 0 window). Body = 5s → end-3s. CTA = last 3s.
- **D-04:** HOOK-02 `audio_hook_quality` derived from Gemini Pro hook call's multi-modal analysis. Phase 6's standalone audio stage may supersede later.
- **D-05:** CTA segment returns presence-aware shape: `{ cta_present: boolean, strength: number|null, type: string|null, rationale: string }`.
- **D-06:** Aggregator applies CTA penalty only for content types that conventionally require one: tutorial=-0.5, b_roll=-0.3, others neutral.
- **D-07:** User-facing copy when no CTA: `rationale="No call-to-action detected — typical for [content_type] content"`.
- **D-08:** 1-of-3 failure → ship partial result + warning (`Promise.allSettled`). Segment null + `SignalAvailability.gemini_<segment>=false`.
- **D-09:** All 3 fail → emit `gemini_video_unavailable` warning + return null `GeminiVideoAnalysis`. Pipeline continues with other Wave 1 signals.
- **D-10:** Single Files API upload shared across the 3 calls. Cleanup AFTER all three settle.
- **D-11:** New module `src/lib/engine/gemini/segmented.ts` exports `analyzeVideoSegmented(buffer, mimeType, opts)`. Existing `analyzeVideoWithGemini` stays callable for eval harness corpus replay (Phase 12 cleanup).
- **D-12:** Aggregator changes additive. `SignalAvailability` adds `gemini_hook` / `gemini_body` / `gemini_cta`. Existing `gemini` = `gemini_hook || gemini_body || gemini_cta`.
- **D-13:** `GeminiVideoAnalysis` widens with `hook_decomposition: HookDecomposition | null` and `cta_segment: CtaSegmentResult | null`. Existing `video_signals` shape preserved.
- **D-14:** Per-segment events emitted under `wave: 1`: `gemini_hook`, `gemini_body`, `gemini_cta`. Replaces today's single `gemini_video_analysis` event.
- **D-15:** Wave 0 niche + `content_type` flow into all 3 segment prompts.

### Claude's Discretion

- **File organization:** `segmented.ts` orchestrator + helpers `hook-segment.ts` / `body-segment.ts` / `cta-segment.ts`, OR one combined `segmented.ts`. Planner picks based on file-size threshold (CLAUDE.md 500-line rule).
- **Prompt templates per segment:** three new prompt builders. Researcher locks wording; planner integrates.
- **Zod schemas:** three new schemas added to `src/lib/engine/gemini/schemas.ts` (or inline).
- **Merge function:** how 3 segment results combine into `GeminiVideoAnalysis`.
- **Short-video handling (≤10s):** recommendation = option (a) skip body call, mark `gemini_body=false` (cleanest; D-08 handles).
- **Promise.allSettled vs Promise.all + try/catch:** both work. `allSettled` is cleaner for D-08.
- **Cost accounting:** verify whether `calculateCost(promptTokens, candidateTokens)` needs extension to take `(model, promptTokens, candidateTokens)`. **Research: YES, it needs extension** — Gemini 3 Pro and Flash have different price tables; current function hard-codes Flash pricing. See **§ Code Examples → Per-model cost helper**.
- **Test surface:** Vitest per-segment + merge + short-video skip + partial-failure + CTA presence + aggregator CTA penalty + niche injection. 80% coverage threshold per `vitest.config.ts`.
- **Eval harness opt-in:** segmented only for v3 baseline; Phase 12 may add A/B comparison.
- **Sentry tags:** per-segment `tags: { stage: "gemini_hook" | "gemini_body" | "gemini_cta" }`.
- **Files API delete timing:** outer `finally` after `Promise.allSettled`, never inside per-segment helpers.

### Deferred Ideas (OUT OF SCOPE)

- Gemini 3.1 Pro upgrade for hook segment (currently preview, deferred until GA).
- Gemini 3.2 Flash adoption (leaked but not officially released).
- Gemini context caching for hook prompt prefix (deferred; current ~1.3¢ already in budget).
- Per-segment Sentry breadcrumbs ↔ Phase 10 ML audit.
- Real audio analysis stage replacing Gemini-derived `audio_hook_quality` (Phase 6).
- Watermark detection (ALGO-06 — Phase 9).
- A/B segmented vs un-segmented eval comparison (Phase 12).
- Hook decomposition surfaced in result-card UI (M2 milestone).
- Mixed-content soft-handling for body segment (Phase 10).
- Promote frequent `other` content types to first-class.
- Cross-modal coherence as standalone signal (Phase 10).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **SEGMENT-01** | Gemini 2.5 Pro analysis of hook segment (0-3s) via `videoMetadata: { startOffset, endOffset }` | CONTEXT D-01 upgrades target to Gemini 3 Pro tier; D-03 widens window to 0-5s. RESEARCH confirms `videoMetadata` is canonical Phase 4 pattern (`wave0/content-type-detector.ts:158`). **Model name needs correction**: use `gemini-3.1-pro-preview` per § Model Selection. |
| **SEGMENT-02** | Gemini 2.5 Flash analysis of body segment (3s → end-3s) via `videoMetadata` | CONTEXT D-01 upgrades to Gemini 3 Flash tier; D-03 shifts window to 5s → end-3s. Verified model name: `gemini-3-flash-preview` (already used by Phase 4 Wave 0). |
| **SEGMENT-03** | Gemini 2.5 Flash analysis of CTA segment (last 3s) via `videoMetadata` | CONTEXT D-01 upgrades to Gemini 3 Flash tier; window unchanged. Same model name correction as SEGMENT-02. |
| **SEGMENT-04** | Parallel execution of 3 segments (single Gemini Files upload reused) | RESEARCH § Architecture Patterns → `Promise.allSettled` over single upload. AI-SPEC §3 entry-point pattern. **Critical**: file delete MUST live in outer `finally` after `Promise.allSettled`, not inside per-segment helpers (Pitfall #1). |
| **SEGMENT-05** | Segment results merged into single Gemini analysis output (timestamps preserved) | RESEARCH § Code Examples → `mergeSegments` null-safe pattern; CONTEXT D-13 widens `GeminiVideoAnalysis` shape. |
| **SEGMENT-06** | Model selection per segment configurable via env | CONTEXT D-02 satisfied by three env vars: `GEMINI_HOOK_MODEL`, `GEMINI_BODY_MODEL`, `GEMINI_CTA_MODEL`. RESEARCH § Code Examples → env-var-with-default pattern at `gemini.ts:17` + `wave0/content-type-detector.ts:14`. |
| **HOOK-01** | Visual stop power score (0-10, from Pro hook segment) | AI-SPEC §1b row 1; RESEARCH § Architecture Patterns → `HookDecompositionZod`. Pro tier per CONTEXT D-01. |
| **HOOK-02** | Audio hook quality score (0-10, first 2s audio analysis) | CONTEXT D-04: derived from Gemini Pro hook call's multi-modal video analysis (audio bundled in Files API upload). Phase 6 may supersede with standalone audio stage. **Note**: AI-SPEC + CONTEXT widen window from 2s → 5s (D-03). |
| **HOOK-03** | Text overlay readability + impact score (0-10) | AI-SPEC §1b row 3; rubric distinguishes brand-watermark from content text (Failure Mode #2). |
| **HOOK-04** | First-words / speech hook score (0-10, transcription-based) | AI-SPEC §1b row 4; relies on Gemini multi-modal transcription within the 0-5s window. |
| **HOOK-05** | Weakest hook modality identified (one of visual/audio/text/speech) | AI-SPEC §1b row 7 (`weakest_modality`); presence-aware (must not name absent modalities — Failure Mode #3). Zod enum: `["visual_stop_power", "audio_hook_quality", "text_overlay_score", "first_words_speech_score"]`. |
| **HOOK-06** | Visual-audio coherence score — mood match across modalities (0-10) | AI-SPEC §1b row 5; cross-modal scoring within the same hook segment Pro call. |
| **HOOK-07** | Cognitive load score — information density per second (0-10, higher = more load = lower retention) | AI-SPEC §1b row 6 — **POLARITY INVERTED** (higher = WORSE). Schema scale stays 0-10; prompt MUST explicitly state polarity to both labelers and judges. Eval D8 includes a perturbation-pair test. |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

These are non-negotiable repository rules. Plans must comply:

- **Files under 500 lines.** A combined `segmented.ts` containing orchestrator + three helpers + merge + schemas + prompts will breach this. Recommend split-by-file layout (the AI-SPEC §3 default).
- **NEVER save to root folder.** All new modules go under `/src/lib/engine/gemini/`. All tests go under `/src/lib/engine/__tests__/`.
- **Always read a file before editing it.** Applies to `types.ts`, `aggregator.ts`, `pipeline.ts` widenings.
- **NEVER commit secrets.** `GEMINI_API_KEY` reads from `process.env` only; no checked-in fallbacks. (Existing pattern at `gemini.ts:83-84` is correct.)
- **Always run tests after code changes.** Phase 5 ships with new test files; planner must include a `pnpm test src/lib/engine/__tests__/gemini-segmented*.test.ts` step in each plan's verification block.
- **Always verify build succeeds before committing.** `pnpm build` is a verification gate; types must compile.
- **Prefer editing existing file to creating new one** — but Phase 5's new orchestrator + helpers ARE necessary additions (additive-only milestone constraint). The widened `GeminiVideoAnalysis` is edited in `types.ts` rather than duplicated.
- **TypeScript over JavaScript.** All new files `.ts`.
- **Use functional components / async-await over callbacks.** Phase 5 has no UI; all async is `Promise.allSettled` + `await`.
- **80% Vitest coverage on `src/lib/engine/**/*.ts`** (per `vitest.config.ts`). New segmented module must hit this.
- **Raycast design language** — UI rule, does not apply to Phase 5 (no UI surface).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Single Files API upload + poll-to-ACTIVE | API / Backend (`segmented.ts` orchestrator) | — | Network I/O + state machine belongs in the orchestrator, not in the per-segment helpers (Pitfall #2: never fan out before file is ACTIVE). |
| Three parallel `generateContent` calls scoped by `videoMetadata` | API / Backend (per-segment helpers `hook-segment.ts` / `body-segment.ts` / `cta-segment.ts`) | — | Each helper owns its own model, prompt, schema, AbortController, Sentry tag, cost calc. Sibling helpers do NOT share state. |
| Zod validation at LLM boundary | API / Backend (inside each segment helper, immediately after `generateContent` resolves) | — | The Phase 4 / Phase 1 discipline: Zod parse is the *first* line after the SDK call returns. Catches schema-valid-but-semantically-invalid responses. |
| `Promise.allSettled` partial-failure merge | API / Backend (`segmented.ts` `mergeSegments` function) | — | Null-safe construction of widened `GeminiVideoAnalysis`; emits `pipeline_warning` per failed segment. |
| Files API delete (after all 3 settle) | API / Backend (outer `finally` in `analyzeVideoSegmented`) | — | Pitfall #1 — delete must NOT live in any segment helper. |
| Wave 1 swap (`analyzeVideoWithGemini` → `analyzeVideoSegmented`) | API / Backend (`pipeline.ts`) | — | Single call site change in Wave 1; legacy export preserved for eval harness (D-11). |
| Aggregator CTA-penalty branch (D-06) | API / Backend (`aggregator.ts` `aggregateScores`) | — | Reads `wave0Result.content_type.type` × `geminiAnalysis.cta_segment.cta_present`; pure function. |
| SignalAvailability extension (D-12) | API / Backend (`types.ts` + `aggregator.ts`) | Database (Phase 3 persistence path) | New keys `gemini_hook` / `gemini_body` / `gemini_cta` persist to `analysis_results.signal_availability` JSONB via existing Phase 3 wiring. No new DB code in Phase 5. |
| Per-segment events (D-14) | API / Backend (orchestrator + helpers emit via `emitStageEnd`) | Frontend Server (SSE relay via `/api/analyze`) | Phase 3 D-01/D-02 already routes stage events through SSE; Phase 5 just emits three pairs instead of one. |
| Eval harness corpus replay | API / Backend (`src/lib/engine/corpus/eval-harness.ts`) | — | Phase 5 extends existing harness; no new tooling. Legacy `analyzeVideoWithGemini` preserved for A/B comparison (D-11 + AI-SPEC D19/D20). |

**Why this matters:** Every capability above sits in the Backend tier. There is **no Browser/Client tier work in Phase 5** — the result-card UI surfacing hook decomposition is M2 (Intelligence Surface) milestone work. The only frontend-server touch is the SSE relay in `/api/analyze`, which is already wired in Phase 3 D-02 (Phase 5 just emits three events instead of one; the relay code does not change).

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@google/genai` | `^1.41.0` (current in `package.json`; latest on npm is `2.4.0`) | Gemini SDK — Files API upload, `generateContent` with `videoMetadata`, `responseSchema` structured output, AbortController support. | Already in stack; v2 breaking changes are in Interactions API only, not `generateContent` per Google's release notes. No upgrade required for Phase 5. |
| `zod` | `^4.3.6` (latest on npm `4.4.3` — minor only) | Schema validation at LLM boundary. Catches schema-valid-but-semantically-invalid responses. | Already in stack; existing pattern at `gemini.ts:108-115` (`parseGeminiVideoResponse`). |
| `@sentry/nextjs` | `^10.39.0` | Per-stage error capture with `tags: { stage }`. | Already in stack; existing pattern at `gemini.ts:523-525`. |
| `vitest` | (workspace dev dep) | Unit + integration tests; 80% coverage threshold per `vitest.config.ts`. | Already configured; project policy. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@/lib/logger` (in-house) | n/a | `createLogger({ module: "..." })` per-stage structured logs. | Every segment helper logs under `engine.gemini.hook` / `engine.gemini.body` / `engine.gemini.cta` (or one module name + `stage` field). |
| `src/lib/engine/events.ts` (Phase 3) | n/a | `emitStageStart` / `emitStageEnd` helpers. | Each segment emits one start/end pair under `wave: 1` per D-14. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct `@google/genai` + Zod | LangChain (TS) | Adds heavy abstraction; obscures per-segment AbortController/Sentry/cost accounting. Anti-Pattern #1 from AI-SPEC framework matrix. **Ruled out.** |
| Direct `@google/genai` + Zod | LangGraph (TS) | Graph-based stateful workflow — overkill for 3 stateless parallel extraction calls. **Ruled out.** |
| Direct `@google/genai` + Zod | LlamaIndex / RAG framework | Phase 5 has no retrieval; pure multi-modal extraction. **Ruled out.** |
| Direct `@google/genai` + Zod | Google ADK | Python + Java only as of 2026-05-18 — fails TS hard constraint. **Ruled out.** |
| `@google/genai ^1.41.0` | `@google/genai ^2.4.0` | v2 breaking changes are in Interactions API only; `generateContent` / `videoMetadata` unchanged per Google release notes. **Defer upgrade** to a separate phase to avoid mixing concerns; Phase 5 ships on v1.41. `[CITED: github.com/googleapis/js-genai/releases]` |
| `gemini-3.1-pro-preview` for hook | `gemini-3-flash-preview` for hook | Drops Pro tier reasoning quality; cost savings ~1¢ per call but the 6-score decomposition rubric is the load-bearing user value. Recommend Pro tier despite "preview" status. |

### Installation

No installation action — all packages already in `package.json`. Verify with:

```bash
pnpm why @google/genai   # → 1.41.0
pnpm why zod             # → 4.3.6
pnpm why @sentry/nextjs  # → 10.39.0
```

### Version Verification

**Verified 2026-05-18 against npm registry:**

- `@google/genai`: installed `^1.41.0`, latest `2.4.0` (2026-05 release). Phase 5 uses installed version. `[VERIFIED: npm view @google/genai version → 2.4.0; package.json shows ^1.41.0]`
- `zod`: installed `^4.3.6`, latest `4.4.3`. No upgrade needed. `[VERIFIED: npm view zod version → 4.4.3]`
- `@sentry/nextjs`: installed `^10.39.0`. No upgrade needed for Phase 5. `[VERIFIED: package.json line]`

## Architecture Patterns

### System Architecture Diagram

```
                       ┌───────────────────────────────────────┐
                       │ pipeline.ts (Wave 1, existing)        │
                       │ swap one call site:                   │
                       │ analyzeVideoWithGemini →              │
                       │ analyzeVideoSegmented                 │
                       └────────────────┬──────────────────────┘
                                        │ (buffer, mimeType, { niche, contentType,
                                        │   creatorContext, onStageEvent, calibration })
                                        ▼
        ┌────────────────────────────────────────────────────────────────┐
        │ gemini/segmented.ts → analyzeVideoSegmented (NEW orchestrator) │
        │                                                                │
        │ 1. Size cap check (50MB)                                       │
        │ 2. ai.files.upload(blob)            ← ONE upload               │
        │ 3. Poll ai.files.get until state===ACTIVE  (or FAILED→throw)   │
        │ 4. fan-out via Promise.allSettled:                             │
        └──────────────┬───────────────┬───────────────┬─────────────────┘
                       │               │               │
                       ▼               ▼               ▼
              ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
              │ hook-segment│ │ body-segment│ │ cta-segment │
              │  .ts        │ │  .ts        │ │  .ts        │
              │             │ │             │ │             │
              │ Model:      │ │ Model:      │ │ Model:      │
              │ 3.1-pro-pv  │ │ 3-flash-pv  │ │ 3-flash-pv  │
              │             │ │             │ │             │
              │ Window:     │ │ Window:     │ │ Window:     │
              │ 0s → 5s     │ │ 5s → end-3s │ │ end-3s →end │
              │             │ │             │ │             │
              │ Prompt:     │ │ Prompt:     │ │ Prompt:     │
              │ 5 factors + │ │ 4 video-    │ │ presence +  │
              │ 6 decomp    │ │ signals     │ │ strength +  │
              │ scores      │ │             │ │ type        │
              │             │ │             │ │             │
              │ Schema:     │ │ Schema:     │ │ Schema:     │
              │ HookSegment │ │ BodySegment │ │ CtaSegment  │
              │             │ │             │ │             │
              │ ↓ AbortCtl  │ │ ↓ AbortCtl  │ │ ↓ AbortCtl  │
              │ ↓ Sentry    │ │ ↓ Sentry    │ │ ↓ Sentry    │
              │ ↓ Zod parse │ │ ↓ Zod parse │ │ ↓ Zod parse │
              │ ↓ cost calc │ │ ↓ cost calc │ │ ↓ cost calc │
              │ ↓ emit Stop │ │ ↓ emit Stop │ │ ↓ emit Stop │
              └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
                     │               │               │
                     └───────────────┼───────────────┘
                                     ▼
                ┌──────────────────────────────────────────┐
                │ mergeSegments(hook, body, cta, opts)     │
                │                                          │
                │ - all 3 fail → emit gemini_video_         │
                │   unavailable warning + return null      │
                │ - 1–2 fail → emit per-segment warning(s) │
                │   + null-fill failed-segment fields      │
                │ - all 3 succeed → full widened           │
                │   GeminiVideoAnalysis                    │
                │                                          │
                │ Returns: { analysis, cost_cents,         │
                │   signalAvailability: {                  │
                │     gemini_hook, gemini_body, gemini_cta │
                │   } }                                    │
                └──────────────────┬───────────────────────┘
                                   │
                       outer finally: ai.files.delete()  (best-effort)
                                   │
                                   ▼
                ┌──────────────────────────────────────────┐
                │ pipeline.ts → aggregator.ts (existing)   │
                │                                          │
                │ - reads geminiAnalysis.hook_decomposition│
                │   (new — may be null)                    │
                │ - reads geminiAnalysis.cta_segment       │
                │   (new — may be null)                    │
                │ - applies CTA penalty branch keyed on    │
                │   wave0Result.content_type.type (D-06)   │
                │ - sets SignalAvailability.gemini =       │
                │   gemini_hook || gemini_body ||          │
                │   gemini_cta                             │
                └──────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/lib/engine/
├── gemini.ts                       # existing — text + LEGACY single-call video (preserved per D-11)
├── gemini/
│   ├── segmented.ts                # NEW — analyzeVideoSegmented orchestrator
│   ├── hook-segment.ts             # NEW — Gemini 3.1 Pro on 0-5s window
│   ├── body-segment.ts             # NEW — Gemini 3 Flash on 5s→end-3s window
│   ├── cta-segment.ts              # NEW — Gemini 3 Flash on last-3s window
│   ├── schemas.ts                  # NEW — Zod + Gemini responseSchema literals (per-segment)
│   ├── prompts.ts                  # NEW — buildHookPrompt / buildBodyPrompt / buildCtaPrompt
│   └── cost.ts                     # NEW — calculateCost(model, usageMetadata) per-model
├── types.ts                        # EXTENDED — widened GeminiVideoAnalysis + new sub-types
├── aggregator.ts                   # EXTENDED — SignalAvailability keys + CTA-penalty branch
├── pipeline.ts                     # EXTENDED — Wave 1 swap + per-segment events
└── __tests__/
    └── gemini-segmented.test.ts    # NEW — unit + integration tests (mock pattern from wave0-content-type.test.ts)
```

Planner may flatten the three helpers back into `segmented.ts` only if total file stays under 500 lines (CLAUDE.md hard rule). Given the prompts + schemas + cost helper, the split layout is the safer default.

### Pattern 1: Single upload → fan-out

**What:** One `ai.files.upload`, poll to `ACTIVE`, then `Promise.allSettled` over three `generateContent` calls each referencing the same `fileUri` with a different `videoMetadata` window.

**When to use:** Whenever multiple LLM analyses on different time windows of the same video are needed. Cheaper than three uploads (one upload pays the processing latency once, one rate-limit hit, one bandwidth charge).

**Example:**

```typescript
// Source: AI-SPEC §3 entry-point pattern + wave0/content-type-detector.ts:155-168
// Verified against @google/genai 1.41.0 in this repo.
import { GoogleGenAI, FileState } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Upload once
const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
const uploaded = await ai.files.upload({ file: blob, config: { mimeType } });
if (!uploaded.name) throw new Error("No file name returned");

// Poll until ACTIVE (matches existing while-loop at gemini.ts:444-455)
let fileState = uploaded.state;
let fileUri = uploaded.uri;
while (fileState === "PROCESSING") {
  if (Date.now() - pollStart > POLL_TIMEOUT_MS) throw new Error("timed out");
  await new Promise((r) => setTimeout(r, 500));
  const info = await ai.files.get({ name: uploaded.name });
  fileState = info.state;
  fileUri = info.uri;
}
if (fileState === "FAILED" || !fileUri) throw new Error(`Upload failed: ${fileState}`);

// Fan-out: three parallel scoped calls on the SAME fileUri
const [hook, body, cta] = await Promise.allSettled([
  runHookSegment(ai, fileUri, mimeType, opts),
  runBodySegment(ai, fileUri, mimeType, opts),
  runCtaSegment(ai, fileUri, mimeType, opts),
]);

// merge ... see Pattern 3
```

### Pattern 2: `videoMetadata` per-segment scoping

**What:** Inside the `parts[]` array of `generateContent`, the `videoMetadata` field is a **sibling of `fileData` within the same Part object** (not a top-level config, not a separate Part). `startOffset` / `endOffset` are strings with `"s"` unit literal (e.g. `"5s"`).

**When to use:** Every time you want one Gemini call to analyze only a sub-window of an uploaded video without re-uploading.

**Example:**

```typescript
// Source: VERIFIED in this repo at wave0/content-type-detector.ts:150-168 (Phase 4).
// CITED: ai.google.dev/gemini-api/docs/video-understanding.
const response = await ai.models.generateContent({
  model: HOOK_MODEL,
  contents: [
    {
      role: "user",
      parts: [
        { text: hookPrompt },
        {
          // CRITICAL: videoMetadata is a SIBLING of fileData in the SAME Part.
          fileData: { fileUri, mimeType },
          videoMetadata: { startOffset: "0s", endOffset: "5s" },
        },
      ],
    },
  ],
  config: {
    responseMimeType: "application/json",
    responseSchema: HOOK_SEGMENT_GEMINI_SCHEMA,
    abortSignal: controller.signal,
    maxOutputTokens: 1500,
  },
});
```

**Format rules** (Pitfall #4 — must enforce in test):
- `startOffset` / `endOffset` are STRINGS with a trailing `"s"`. Always build via `` `${seconds}s` `` template literal.
- Do NOT use numbers (`5`), unitless strings (`"5"`), ISO 8601 (`"PT5S"`), or timecodes (`"00:00:05"`). All silently disable scoping in some SDK versions.
- Unit-test with a value > 9 to catch zero-padding bugs.
- Default `fps` is 1 (one frame per second sampled). Phase 5 does not need to tune this — the 1 fps default at ~258 tokens/frame is right-sized for short-form video.

### Pattern 3: Null-safe partial-failure merge

**What:** `Promise.allSettled` returns `PromiseSettledResult<T>[]` — each element is either `{ status: "fulfilled", value }` or `{ status: "rejected", reason }`. The merge function must consume this shape and produce a partial-but-valid `GeminiVideoAnalysis` even when one or two segments failed.

**When to use:** Every time the system contract is "ship the best partial answer rather than fail wholesale" (CONTEXT D-08 / D-09).

**Example:**

```typescript
// Source: AI-SPEC §4 mergeSegments pattern, extended for D-13 schema widening.
function mergeSegments(
  hook: PromiseSettledResult<SegmentResult<HookSegmentResult>>,
  body: PromiseSettledResult<SegmentResult<BodySegmentResult>>,
  cta:  PromiseSettledResult<SegmentResult<CtaSegmentResult>>,
  opts: SegmentedAnalysisOptions,
): MergedResult {
  const hookOk = hook.status === "fulfilled" && hook.value.ok;
  const bodyOk = body.status === "fulfilled" && body.value.ok;
  const ctaOk  = cta.status  === "fulfilled" && cta.value.ok;

  // D-09: all 3 fail → null analysis + warning, pipeline continues
  if (!hookOk && !bodyOk && !ctaOk) {
    opts.onStageEvent?.({
      type: "pipeline_warning",
      message: "All Gemini segments failed — video signal unavailable.",
      stage: "gemini_video_unavailable",
    });
    return {
      analysis: null,
      cost_cents: 0,
      signalAvailability: { gemini_hook: false, gemini_body: false, gemini_cta: false },
    };
  }

  // D-08: per-segment warning for each failure
  for (const [name, ok] of [["hook", hookOk], ["body", bodyOk], ["cta", ctaOk]] as const) {
    if (!ok) opts.onStageEvent?.({
      type: "pipeline_warning",
      message: `Gemini ${name} analysis unavailable — score uses other segments.`,
      stage: `gemini_${name}`,
    });
  }

  // Hook owns 5 factors + hook_decomposition; body fills 3 of 4 video_signals;
  // CTA fills cta_segment; hook_visual_impact passthrough from hook.visual_stop_power.
  return {
    analysis: {
      factors: hookOk ? hook.value.analysis.factors : DEFAULT_NULL_FACTORS,
      overall_impression: hookOk ? hook.value.analysis.overall_impression : "",
      content_summary: hookOk ? hook.value.analysis.content_summary : "",
      video_signals: {
        visual_production_quality: bodyOk ? body.value.analysis.video_signals.visual_production_quality : null,
        hook_visual_impact:        hookOk ? hook.value.analysis.hook_decomposition.visual_stop_power : null,
        pacing_score:              bodyOk ? body.value.analysis.video_signals.pacing_score : null,
        transition_quality:        bodyOk ? body.value.analysis.video_signals.transition_quality : null,
      },
      hook_decomposition: hookOk ? hook.value.analysis.hook_decomposition : null,
      cta_segment:        ctaOk  ? cta.value.analysis  : null,
    },
    cost_cents:
      (hookOk ? hook.value.cost_cents : 0) +
      (bodyOk ? body.value.cost_cents : 0) +
      (ctaOk  ? cta.value.cost_cents  : 0),
    signalAvailability: { gemini_hook: hookOk, gemini_body: bodyOk, gemini_cta: ctaOk },
  };
}
```

**Critical**: every nullable field on `GeminiVideoAnalysis` (added in D-13) needs the type signature `T | null` to compile under TypeScript strict mode. The existing `video_signals` interior fields move from `number` to `number | null` — this is a schema widening that ripples into `FeatureVector` (`types.ts:7-47`) and any aggregator code reading those fields. Plan must include a type-narrowing audit of every consumer.

### Anti-Patterns to Avoid

- **`for...of + await` instead of `Promise.allSettled`**: serializes the three calls, blows the wave latency budget (~45s instead of ~15s), defeats segmentation. Vitest must assert wall-clock latency ≤ max(hook, body, cta) + 200ms — a serial implementation fails this assertion.
- **Shared `AbortController` across the three calls**: one segment timing out kills the other two mid-flight. Use three separate `AbortController` instances per AI-SPEC §4b Pitfall #5.
- **File delete inside per-segment helper**: the first helper to settle deletes the file while the other two are mid-request → 404 / PERMISSION_DENIED on the survivors (AI-SPEC §3 Pitfall #1).
- **`Promise.all` instead of `Promise.allSettled`**: rejects whole tuple on first error; surviving in-flight calls continue running on the server and are billed even though their results are discarded.
- **Single source-of-truth schema via `zod-to-json-schema`**: that converter emits unsupported keywords (`$schema`, `additionalProperties`, `$ref`) that Gemini rejects with 400 INVALID_ARGUMENT. Hand-write Gemini `responseSchema` and Zod schema separately; unit-test they stay in sync (AI-SPEC §4b "How Gemini integrates").
- **`oneOf` / discriminated union in CTA schema**: Gemini's `responseSchema` dialect does NOT support `oneOf`. Express presence-aware CTA as `cta_present: boolean` + `nullable: true` on `strength` and `type`. Cross-field invariant lives in Zod `.refine`, not in the Gemini schema (Pitfall #7).
- **Asserting `response.text` is defined**: even with `responseMimeType: "application/json"`, the field can be `undefined` (safety filter, refusal, max_output_tokens hit). Always default with `response.text ?? ""` and let Zod produce the actionable error.
- **Few-shot examples in the hook prompt**: inflates token cost ~30% on the most expensive segment, embeds labeler bias invisibly. Refine the rubric language instead.
- **Inverting `cognitive_load` polarity**: the score is **higher = worse**, opposite of every other 0-10 score in the system. The prompt MUST explicitly state this; the eval D8 perturbation pair test catches inversions.
- **Naming an absent modality as `weakest_modality`** (Failure Mode #3): the schema's `rationale` field must explicitly call out absent modalities; `weakest_modality` must be conditional on presence. Prompt rule: *"If a modality is genuinely absent from the hook, score it at 0 and mention this in the rationale; do not name it as weakest_modality."*

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Video frame extraction / segmentation | ffmpeg pipeline that pre-clips the video into three sub-files | Native `videoMetadata: { startOffset, endOffset }` on a single Files API upload | Phase 5 STATE.md milestone-start decision: "Video segmentation via native Gemini `videoMetadata` (no ffmpeg)." One upload = one rate-limit hit; one bandwidth charge; one processing wait. |
| Structured JSON extraction from LLM | Regex / manual parser over `response.text` | `responseMimeType: "application/json"` + `responseSchema` + Zod parse | Decoder constraint eliminates ~95% of "extra prose around JSON" failures; Zod catches the rest. |
| Cross-field invariants in JSON schema | Multiple schemas + try-each-shape parser | `responseSchema` for shape + Zod `.refine(...)` for invariants | Gemini's OpenAPI-3 subset doesn't support `oneOf`; Zod expresses invariants client-side. CTA presence-aware shape is the canonical example. |
| Per-segment failure isolation | Try/catch wrapper around `Promise.all` that rescues + retries | `Promise.allSettled` | `allSettled` is the standard primitive for "return all three statuses regardless of individual failure"; that's exactly the D-08 contract. |
| Parallel HTTP cancellation | Manual timer + `fetch.abort()` plumbing | `AbortController` + `config.abortSignal` in the SDK | The SDK already supports this; pattern at `gemini.ts:468-469`. Three controllers per fan-out, not one. |
| Token-cost calculation | Hard-coded per-call constants | `calculateCost(model, usageMetadata)` reading `usageMetadata.promptTokenCount` + `candidatesTokenCount` | Existing helper at `gemini.ts:142-149` MUST be extended to take `model` — Pro and Flash have different price tables. Without this extension, Phase 5 under-counts hook cost by ~13×. |
| Per-stage observability | Custom OpenTelemetry collector / Phoenix / Langfuse | Existing `emitStageStart` / `emitStageEnd` (Phase 3 D-01) + Sentry tags + structured logs | AI-SPEC §5 "Eval Tooling" rationale: project already has tracing; Phoenix's RAG-focused metrics don't apply; additive-only constraint forbids parallel observability stack. |
| Eval framework | Custom corpus-replay tooling | Existing `src/lib/engine/corpus/eval-harness.ts` + `pnpm eval` (Phase 1) | Phase 5 widens what each row carries (6 hook scores + cta_segment + per-segment availability flags); the harness itself doesn't change. |

**Key insight:** Phase 5 is a textbook *"the platform already has the primitive — split one call into three calls of the same shape"* refactor. Every "should we build X?" question for Phase 5 has the same answer: **no, use the existing platform primitive**. The hand-rolled trap here is the prompt rubric itself — that IS Virtuna's opinion, and rolling it from scratch (vs. pulling a generic "score this video" template) is the load-bearing user value. Researcher locks wording (AI-SPEC §1b rubric), planner integrates.

## Runtime State Inventory

**Phase 5 is NOT a rename / refactor / migration phase.** It is a new-capability addition (additive-only milestone constraint). No string renames, no DB schema migrations beyond JSONB column widening (which is forward-compatible — Phase 3 D-07 `SignalAvailability` is keyed at the type level, not at the DB schema level). Skipping this section's standard table per the agent's spec.

However, two adjacent items are worth flagging because they LOOK like runtime state but aren't:

- **`analysis_results.signal_availability` JSONB**: existing column from Phase 3 migration. The shape stored is whatever `SignalAvailability` TypeScript type currently says. Adding `gemini_hook` / `gemini_body` / `gemini_cta` keys is a **forward-compatible JSONB extension** — old rows have no such keys, new rows do. Aggregator must `?? false` on missing keys when reading historical rows. **No data migration; planner adds the `?? false` fallback in `aggregator.ts`.**
- **`cachedCalibration` module singleton** at `gemini.ts:79`: in-memory cache of the JSON calibration file. Phase 5 reuses it (three segment helpers share the same warmed cache). No invalidation needed; the file is read-only and updated only on engine version bump (Phase 3 D-rule).

## Common Pitfalls

### Pitfall 1: Files API delete fires before all 3 calls finish

**What goes wrong:** If the delete sits inside any per-segment helper's `finally`, the first helper to settle deletes the file while the other two are still calling against `fileUri`. Surviving calls return 404 NOT_FOUND or 403 PERMISSION_DENIED.

**Why it happens:** Copy-pasting the existing `finally` pattern from `gemini.ts:532-541` into each segment helper without thinking. The existing pattern is correct for ONE call; it inverts when there are three.

**How to avoid:** The `try { ... } finally { ai.files.delete(...) }` MUST be in `analyzeVideoSegmented` at the orchestrator level, around the `await Promise.allSettled([...])`. Never inside the helpers.

**Warning signs:** Test that fails intermittently because two helpers happen to complete in the same microtask. Sentry breadcrumbs showing 404 on `gemini_body` immediately after `gemini_hook` succeeded.

### Pitfall 2: Firing `generateContent` before file is ACTIVE

**What goes wrong:** A naive `Promise.all([upload, hookCall, bodyCall, ctaCall])` races the file-processing step; calls fail with FILE_STATE_UNSPECIFIED or 400.

**Why it happens:** Conflating "upload returned" with "file is ready." Upload returns when the bytes are sent; the file is in `PROCESSING` until Gemini's pipeline ingests it.

**How to avoid:** Always `await` the `state === "ACTIVE"` poll loop BEFORE the three-way fan-out starts. The existing while-loop at `gemini.ts:444-455` is correct; reuse it verbatim in the orchestrator.

**Warning signs:** Sporadic 400 INVALID_ARGUMENT in production from one segment, never all three; smaller videos pass (process faster) while bigger ones fail (race window wider).

### Pitfall 3: `videoMetadata` placed outside the same Part

**What goes wrong:** Putting `videoMetadata` at top-level config or as a sibling of `parts[]` results in silent full-video analysis instead of the intended window.

**Why it happens:** SDK type definitions tolerate a videoMetadata-only Part; the API ignores videoMetadata unless it's on the same Part as the fileData/inlineData.

**How to avoid:** Strict template: `{ parts: [{ text }, { fileData: {...}, videoMetadata: { startOffset, endOffset } }] }`. Always put `videoMetadata` as a sibling key of `fileData` within the same Part object.

**Warning signs:** Token usage on a "5-second hook" call looks suspiciously like 30-second token usage. Test fixture with known mid-video content showing up in a hook-segment rationale.

### Pitfall 4: Wrong format for `startOffset` / `endOffset`

**What goes wrong:** Numbers (`5`), unitless strings (`"5"`), ISO 8601 (`"PT5S"`), and timecodes (`"00:00:05"`) all silently disable scoping in some SDK versions — the call analyzes the full video and the bill is high.

**Why it happens:** Camelcase + string-with-unit is unusual; developers default to "I'll send a number."

**How to avoid:** Always construct via `` `${seconds}s` `` template literal. Add a Vitest assertion that the helper emits `startOffset: "0s"`, `endOffset: "5s"`. Unit-test with a value > 9 (e.g. `"22s"`) to catch zero-padding bugs.

**Warning signs:** Hook segment cost ~5¢ instead of ~1.3¢ on a 30s video — that's the cost shape of "Pro analyzed the whole video" instead of "Pro analyzed only the hook."

### Pitfall 5: Shared `AbortController` across the fan-out

**What goes wrong:** If one segment times out and aborts the shared controller, the other two are killed mid-flight even though they had budget.

**Why it happens:** Refactoring "let me factor out the controller" without realizing it's load-bearing per-call state.

**How to avoid:** Three controllers, three `setTimeout`s, three `clearTimeout`s in three `finally` blocks. Don't factor them out.

**Warning signs:** All three segments cancel together; latency p95 spikes when any one segment hits a slow Gemini response.

### Pitfall 6: AbortSignal does not stop server-side billing

**What goes wrong:** Treating timeouts as cost-zero events; cost dashboards under-report by the abort rate × per-call cost.

**Why it happens:** Intuition that "I cancelled it, so I shouldn't be billed" — but Google's docs are explicit: *"AbortSignal is a client-only operation."*

**How to avoid:** In the per-segment failure branch, capture the `usageMetadata` if available before returning. If unavailable (abort fired before response), record a `fallback_cost_cents` estimate based on configured `maxOutputTokens` ceiling.

### Pitfall 7: Discriminated unions / `oneOf` in CTA schema

**What goes wrong:** Trying to express CTA as `{cta_present: true, strength: number, type: ...} | {cta_present: false, strength: null, type: null}` via `oneOf` → Gemini returns 400 INVALID_ARGUMENT.

**Why it happens:** Gemini's `responseSchema` is an OpenAPI-3 *subset*, no `oneOf` / no recursive `$ref`.

**How to avoid:** Single OBJECT with `cta_present: boolean` discriminator + `nullable: true` on `strength` and `type`. Cross-field invariant lives in Zod `.refine`. Use `propertyOrdering: ["cta_present", "strength", "type", "rationale"]` so the model emits `cta_present` first — empirically improves the null-when-absent rate.

### Pitfall 8: Asserting on `response.text` after `responseSchema`

**What goes wrong:** Even with structured-output mode, `response.text` can be `undefined` (safety filter, refusal, max_output_tokens too low).

**Why it happens:** SDK docs claim `response.text` is "guaranteed valid JSON when responseSchema is set" — true when the model actually responds. False when it refuses.

**How to avoid:** `const cleaned = stripFences(response.text ?? "");` then `JSON.parse(cleaned)` then Zod parse. Let Zod produce the actionable error.

### Pitfall 9: `calculateCost` uses Flash pricing for Pro calls

**What goes wrong:** Existing `calculateCost(promptTokens, candidateTokens)` at `gemini.ts:142-149` hard-codes Flash pricing (`$0.15/M input, $0.60/M output`). The Pro hook call has 13× the per-output-token cost ($12.00/M vs $0.60/M for ≤200K context). If Phase 5 reuses the existing helper without extension, hook cost is under-counted by ~13×.

**Why it happens:** Existing helper was written for a single-model world.

**How to avoid:** Extend signature to `calculateCost(model: string, usageMetadata: UsageMetadata)` with a per-model price table:

```typescript
// New helper in src/lib/engine/gemini/cost.ts
const PRICING: Record<string, { input: number; output: number }> = {
  "gemini-3.1-pro-preview":  { input: 2.00 / 1_000_000,  output: 12.00 / 1_000_000 },
  "gemini-3-pro-preview":    { input: 2.00 / 1_000_000,  output: 12.00 / 1_000_000 }, // alias redirects to 3.1
  "gemini-3-flash-preview":  { input: 0.50 / 1_000_000,  output:  3.00 / 1_000_000 },
  "gemini-3.1-flash-lite":   { input: 0.25 / 1_000_000,  output:  1.50 / 1_000_000 },
  "gemini-2.5-flash":        { input: 0.15 / 1_000_000,  output:  0.60 / 1_000_000 }, // legacy
};
```

**Warning signs:** Cost dashboard shows total per-video cost ~0.4¢ when it should be ~2.0¢. BENCH-03 budget appears wildly under-utilized.

### Pitfall 10: Existing `analyzeVideoWithGemini` test surface

**What goes wrong:** Phase 5 widens `GeminiVideoAnalysis` (D-13). Existing tests that build a fixture `GeminiVideoAnalysis` via `makeGeminiAnalysis()` factory (`src/lib/engine/__tests__/factories.ts`) will fail to typecheck if the new fields are required vs. optional.

**Why it happens:** TypeScript strict mode + required fields on a widened interface.

**How to avoid:** Make `hook_decomposition` and `cta_segment` **optional + nullable** in `GeminiVideoAnalysisSchema` (Zod `.optional().nullable()` or `.nullable().default(null)`). Existing tests building a fixture without those fields still pass. New tests for the segmented path explicitly set them.

**Warning signs:** `pnpm build` fails with "Property 'hook_decomposition' is missing in type" on existing test factories.

## Code Examples

Verified patterns from project codebase and official Gemini docs:

### Single upload + fan-out orchestrator

```typescript
// src/lib/engine/gemini/segmented.ts
// Sources:
//   - AI-SPEC §3 entry-point pattern
//   - gemini.ts:425-455 (upload + poll)
//   - wave0/content-type-detector.ts:150-168 (videoMetadata pattern)
import { GoogleGenAI } from "@google/genai";
import * as Sentry from "@sentry/nextjs";
import { runHookSegment } from "./hook-segment";
import { runBodySegment } from "./body-segment";
import { runCtaSegment } from "./cta-segment";
import { mergeSegments } from "./merge";
import type { GeminiVideoAnalysis, SegmentedAnalysisOptions, SignalAvailability } from "../types";

const VIDEO_MAX_SIZE_BYTES = 50 * 1024 * 1024;
const VIDEO_POLL_INTERVAL_MS = 500;
const VIDEO_POLL_TIMEOUT_MS = 60_000;

export async function analyzeVideoSegmented(
  videoBuffer: Buffer,
  mimeType: string,
  opts: SegmentedAnalysisOptions,
): Promise<{
  analysis: GeminiVideoAnalysis | null;
  cost_cents: number;
  signalAvailability: Pick<SignalAvailability, "gemini_hook" | "gemini_body" | "gemini_cta">;
}> {
  if (videoBuffer.byteLength > VIDEO_MAX_SIZE_BYTES) {
    throw new Error("Video exceeds 50MB cap.");
  }

  const ai = getClient();   // reuse gemini.ts:81 singleton
  let uploadedFileName: string | undefined;

  try {
    const blob = new Blob([new Uint8Array(videoBuffer)], { type: mimeType });
    const uploaded = await ai.files.upload({ file: blob, config: { mimeType } });
    if (!uploaded.name) throw new Error("No file name returned");
    uploadedFileName = uploaded.name;

    // Poll until ACTIVE
    let fileState = uploaded.state;
    let fileUri = uploaded.uri;
    const pollStart = Date.now();
    while (fileState === "PROCESSING") {
      if (Date.now() - pollStart > VIDEO_POLL_TIMEOUT_MS) {
        throw new Error("Files API processing timed out after 60s.");
      }
      await new Promise((r) => setTimeout(r, VIDEO_POLL_INTERVAL_MS));
      const info = await ai.files.get({ name: uploaded.name });
      fileState = info.state;
      fileUri = info.uri;
    }
    if (fileState === "FAILED" || !fileUri) {
      throw new Error(`Files API processing failed (state=${fileState})`);
    }

    // Fan-out: three parallel scoped calls on the SAME fileUri
    const [hookSettled, bodySettled, ctaSettled] = await Promise.allSettled([
      runHookSegment(ai, fileUri, mimeType, opts),
      runBodySegment(ai, fileUri, mimeType, opts),
      runCtaSegment(ai, fileUri, mimeType, opts),
    ]);

    return mergeSegments(hookSettled, bodySettled, ctaSettled, opts);
  } finally {
    // Delete AFTER all three settle — never inside per-segment helpers.
    if (uploadedFileName) {
      try {
        await ai.files.delete({ name: uploadedFileName });
      } catch {
        // Best-effort — file expires server-side anyway
      }
    }
  }
}
```

### Per-segment helper (hook example)

```typescript
// src/lib/engine/gemini/hook-segment.ts
// Source: AI-SPEC §4 runBodySegment pattern, adapted for hook.
import { GoogleGenAI } from "@google/genai";
import * as Sentry from "@sentry/nextjs";
import { performance } from "node:perf_hooks";
import { HookSegmentZodSchema, HOOK_SEGMENT_GEMINI_SCHEMA } from "./schemas";
import { buildHookPrompt } from "./prompts";
import { calculateCost } from "./cost";
import { stripFences } from "../gemini";   // reuse existing helper
import { emitStageStart, emitStageEnd } from "../events";

const SEGMENT_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TOKENS = 1500;

export async function runHookSegment(
  ai: GoogleGenAI,
  fileUri: string,
  mimeType: string,
  opts: SegmentedAnalysisOptions,
): Promise<SegmentResult<HookSegmentResult>> {
  const t0 = performance.now();
  const model = process.env.GEMINI_HOOK_MODEL ?? "gemini-3.1-pro-preview";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEGMENT_TIMEOUT_MS);

  emitStageStart(opts.onStageEvent, "gemini_hook", 1, t0);

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { text: buildHookPrompt(opts.calibration, opts) },
            {
              fileData: { fileUri, mimeType },
              videoMetadata: { startOffset: "0s", endOffset: "5s" },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: HOOK_SEGMENT_GEMINI_SCHEMA,
        abortSignal: controller.signal,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      },
    });

    // Zod-at-boundary — NEVER trust raw response.text
    const analysis = HookSegmentZodSchema.parse(
      JSON.parse(stripFences(response.text ?? "")),
    );
    const cost_cents = calculateCost(model, response.usageMetadata);
    const duration_ms = Math.round(performance.now() - t0);

    emitStageEnd(opts.onStageEvent, "gemini_hook", 1, t0, {
      cost_cents: +cost_cents.toFixed(4),
      ok: true,
    });

    if (cost_cents > 1.6) {
      // Soft cap per AI-SPEC §4b cost table — log warning, do not fail
      log.warn("Hook segment cost exceeds soft cap", { model, cost_cents });
    }

    return { ok: true, analysis, cost_cents, model };
  } catch (error) {
    Sentry.captureException(error, { tags: { stage: "gemini_hook", model } });
    emitStageEnd(opts.onStageEvent, "gemini_hook", 1, t0, {
      cost_cents: 0,
      ok: false,
      warning: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error };
  } finally {
    clearTimeout(timeout);
  }
}
```

### Zod + Gemini schemas (per segment)

```typescript
// src/lib/engine/gemini/schemas.ts
// Source: AI-SPEC §4b Zod schemas, adapted to match types.ts conventions.
import { z } from "zod";
import { Type } from "@google/genai";

const ScoreSchema = z.number().min(0).max(10);

export const HookDecompositionZodSchema = z.object({
  visual_stop_power: ScoreSchema,
  audio_hook_quality: ScoreSchema,
  text_overlay_score: ScoreSchema,
  first_words_speech_score: ScoreSchema,
  weakest_modality: z.enum([
    "visual_stop_power",
    "audio_hook_quality",
    "text_overlay_score",
    "first_words_speech_score",
  ]),
  visual_audio_coherence: ScoreSchema,
  cognitive_load: ScoreSchema, // higher = WORSE — polarity inverted vs other scores
});

export const HookSegmentZodSchema = z.object({
  factors: z.array(z.object({
    name: z.enum([
      "Scroll-Stop Power",
      "Completion Pull",
      "Rewatch Potential",
      "Share Trigger",
      "Emotional Charge",
    ]),
    score: ScoreSchema,
    rationale: z.string().min(1).max(500),
    improvement_tip: z.string().min(1).max(500),
  })).length(5),
  overall_impression: z.string().min(1).max(800),
  content_summary: z.string().min(1).max(800),
  hook_decomposition: HookDecompositionZodSchema,
});

export const BodySegmentZodSchema = z.object({
  video_signals: z.object({
    visual_production_quality: ScoreSchema,
    pacing_score: ScoreSchema,
    transition_quality: ScoreSchema,
  }),
  body_summary: z.string().min(1).max(800),
});

// CTA presence-aware: no discriminated union — nullable + .refine instead.
export const CtaSegmentZodSchema = z.object({
  cta_present: z.boolean(),
  strength: ScoreSchema.nullable(),
  type: z.enum([
    "follow", "comment", "link_in_bio", "watch_next", "engage_question", "other",
  ]).nullable(),
  rationale: z.string().min(1).max(400),
}).refine(
  (v) => v.cta_present
    ? v.strength !== null && v.type !== null
    : v.strength === null && v.type === null,
  { message: "When cta_present=true, strength and type must be non-null; when false, both must be null." },
);

export type HookSegmentResult = z.infer<typeof HookSegmentZodSchema>;
export type BodySegmentResult = z.infer<typeof BodySegmentZodSchema>;
export type CtaSegmentResult  = z.infer<typeof CtaSegmentZodSchema>;
export type HookDecomposition = z.infer<typeof HookDecompositionZodSchema>;

// Gemini responseSchema literals — hand-written to mirror Zod above.
// NOTE: Gemini schema dialect = OpenAPI 3 subset; no oneOf, no $ref, no $schema.
export const HOOK_SEGMENT_GEMINI_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    factors: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          score: { type: Type.NUMBER },
          rationale: { type: Type.STRING },
          improvement_tip: { type: Type.STRING },
        },
        required: ["name", "score", "rationale", "improvement_tip"],
      },
    },
    overall_impression: { type: Type.STRING },
    content_summary: { type: Type.STRING },
    hook_decomposition: {
      type: Type.OBJECT,
      properties: {
        visual_stop_power: { type: Type.NUMBER },
        audio_hook_quality: { type: Type.NUMBER },
        text_overlay_score: { type: Type.NUMBER },
        first_words_speech_score: { type: Type.NUMBER },
        weakest_modality: { type: Type.STRING },
        visual_audio_coherence: { type: Type.NUMBER },
        cognitive_load: { type: Type.NUMBER },
      },
      required: [
        "visual_stop_power", "audio_hook_quality", "text_overlay_score",
        "first_words_speech_score", "weakest_modality",
        "visual_audio_coherence", "cognitive_load",
      ],
    },
  },
  required: ["factors", "overall_impression", "content_summary", "hook_decomposition"],
};

export const CTA_SEGMENT_GEMINI_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    cta_present: { type: Type.BOOLEAN },
    strength: { type: Type.NUMBER, nullable: true },
    type: { type: Type.STRING, nullable: true, enum: [
      "follow", "comment", "link_in_bio", "watch_next", "engage_question", "other",
    ] },
    rationale: { type: Type.STRING },
  },
  required: ["cta_present", "strength", "type", "rationale"],
  // Encourage model to emit cta_present FIRST so null-when-absent rate goes up.
  propertyOrdering: ["cta_present", "strength", "type", "rationale"],
};

export const BODY_SEGMENT_GEMINI_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    video_signals: {
      type: Type.OBJECT,
      properties: {
        visual_production_quality: { type: Type.NUMBER },
        pacing_score: { type: Type.NUMBER },
        transition_quality: { type: Type.NUMBER },
      },
      required: ["visual_production_quality", "pacing_score", "transition_quality"],
    },
    body_summary: { type: Type.STRING },
  },
  required: ["video_signals", "body_summary"],
};
```

### Per-model cost helper

```typescript
// src/lib/engine/gemini/cost.ts
// Source: extends gemini.ts:142-149 with per-model pricing.
// CITED: ai.google.dev/gemini-api/docs/pricing as of 2026-05-18.
const PRICING: Record<string, { input: number; output: number }> = {
  // Per-token rates ($/token)
  "gemini-3.1-pro-preview":  { input: 2.00 / 1_000_000,  output: 12.00 / 1_000_000 },
  "gemini-3-pro-preview":    { input: 2.00 / 1_000_000,  output: 12.00 / 1_000_000 },
  "gemini-3-flash-preview":  { input: 0.50 / 1_000_000,  output:  3.00 / 1_000_000 },
  "gemini-3.1-flash-lite":   { input: 0.25 / 1_000_000,  output:  1.50 / 1_000_000 },
  "gemini-2.5-flash":        { input: 0.15 / 1_000_000,  output:  0.60 / 1_000_000 },
};

const FALLBACK_INPUT_TOKENS = 2000;
const FALLBACK_OUTPUT_TOKENS = 800;

export function calculateCost(
  model: string,
  usageMetadata: { promptTokenCount?: number; candidatesTokenCount?: number } | undefined,
): number {
  const rates = PRICING[model] ?? PRICING["gemini-3-flash-preview"]!; // safe default
  const input = usageMetadata?.promptTokenCount ?? FALLBACK_INPUT_TOKENS;
  const output = usageMetadata?.candidatesTokenCount ?? FALLBACK_OUTPUT_TOKENS;
  return (input * rates.input + output * rates.output) * 100; // cents
}
```

### Vitest mock pattern (verified against Phase 4 tests)

```typescript
// src/lib/engine/__tests__/gemini-segmented.test.ts
// Source: VERIFIED pattern from wave0-content-type.test.ts:23-34 (Phase 4).
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

const mockGenerate = vi.fn();
const mockFileUpload = vi.fn();
const mockFileGet = vi.fn();
const mockFileDelete = vi.fn();
vi.mock("@google/genai", () => {
  const MockGoogleGenAI = vi.fn(function (this: Record<string, unknown>) {
    this.models = { generateContent: mockGenerate };
    this.files = { upload: mockFileUpload, get: mockFileGet, delete: mockFileDelete };
  });
  return {
    GoogleGenAI: MockGoogleGenAI,
    Type: { OBJECT: "OBJECT", STRING: "STRING", NUMBER: "NUMBER", BOOLEAN: "BOOLEAN", ARRAY: "ARRAY" },
  };
});

process.env.GEMINI_API_KEY = "test-key";
process.env.GEMINI_HOOK_MODEL = "gemini-3.1-pro-preview";
process.env.GEMINI_BODY_MODEL = "gemini-3-flash-preview";
process.env.GEMINI_CTA_MODEL  = "gemini-3-flash-preview";

import { analyzeVideoSegmented } from "../gemini/segmented";

describe("analyzeVideoSegmented", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFileUpload.mockResolvedValue({ name: "files/abc", state: "ACTIVE", uri: "gs://abc" });
    mockFileGet.mockResolvedValue({ name: "files/abc", state: "ACTIVE", uri: "gs://abc" });
  });

  it("calls generateContent three times with distinct videoMetadata windows", async () => {
    // Sequence the three responses in fan-out order
    mockGenerate
      .mockResolvedValueOnce({ text: JSON.stringify(VALID_HOOK_FIXTURE), usageMetadata: HOOK_USAGE })
      .mockResolvedValueOnce({ text: JSON.stringify(VALID_BODY_FIXTURE), usageMetadata: BODY_USAGE })
      .mockResolvedValueOnce({ text: JSON.stringify(VALID_CTA_FIXTURE),  usageMetadata: CTA_USAGE });

    const result = await analyzeVideoSegmented(
      Buffer.from(new Uint8Array(8)),
      "video/mp4",
      { niche: "beauty", contentType: "tutorial", duration: 30, calibration: STUB_CAL,
        onStageEvent: vi.fn() },
    );

    expect(mockGenerate).toHaveBeenCalledTimes(3);
    // Assert distinct videoMetadata windows on each of the three calls
    const calls = mockGenerate.mock.calls;
    expect(calls[0][0].contents[0].parts[1].videoMetadata).toEqual({ startOffset: "0s", endOffset: "5s" });
    expect(calls[1][0].contents[0].parts[1].videoMetadata).toEqual({ startOffset: "5s", endOffset: "27s" });
    expect(calls[2][0].contents[0].parts[1].videoMetadata).toEqual({ startOffset: "27s", endOffset: "30s" });
    expect(result.signalAvailability).toEqual({ gemini_hook: true, gemini_body: true, gemini_cta: true });
  });

  it("deletes the Files API upload exactly once after all 3 settle (D-10)", async () => {
    mockGenerate.mockResolvedValue({ text: JSON.stringify(VALID_HOOK_FIXTURE), usageMetadata: HOOK_USAGE });
    await analyzeVideoSegmented(Buffer.from(new Uint8Array(8)), "video/mp4", STUB_OPTS);
    expect(mockFileDelete).toHaveBeenCalledTimes(1);
    expect(mockFileDelete).toHaveBeenCalledWith({ name: "files/abc" });
  });

  // ...partial-failure table-driven tests (HHF, HFH, HFF, FHH, FHF, FFH, FFF)
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ffmpeg pre-clip → 3 separate uploads | Native `videoMetadata` on one upload | Gemini 2.0 introduced `videoMetadata` field; codified across 2.5 / 3 series | One upload pays processing latency once; one rate-limit hit; one bandwidth charge. Saves ~6-30s per analysis. Already in use at `wave0/content-type-detector.ts:158`. |
| `Promise.all` + try/catch | `Promise.allSettled` | ES2020 native; widely adopted post-2021 | Per-segment failure isolation without bespoke wrapper code. |
| Manual JSON parsing of LLM output | `responseMimeType: "application/json"` + `responseSchema` + Zod | Gemini 1.5 introduced structured outputs; Phase 4 already uses this | ~95% of "extra prose around JSON" failures eliminated at the decoder; Zod catches the rest. |
| `oneOf` / discriminated union in JSON schema | `nullable: true` + Zod `.refine` cross-field invariant | Gemini's OpenAPI-3 subset has always lacked `oneOf` | Cleanest way to express presence-aware CTA shape. |
| Hand-rolled timeout loop | `AbortController` + `config.abortSignal` | `@google/genai` 0.x+ | Per-call cooperative cancellation; standard primitive. |
| Single-model cost calc | Per-model price table | Required when mixing Pro + Flash within one stage | Avoids the ~13× under-count failure mode (Pitfall #9). |
| Phoenix / Langfuse / Arize observability | Existing Sentry + `emitStageEnd` per-stage events | Phase 3 D-01 established the pattern | Additive-only milestone constraint; no new tracing platform; the existing stack covers per-stage cost + latency + success without re-implementation. |

**Deprecated/outdated:**

- `gemini-3-pro-preview` model name — **deprecated 2026-03-09**, alias now redirects to `gemini-3.1-pro-preview`. AI-SPEC default `gemini-3-pro` does not resolve. Use `gemini-3.1-pro-preview`. `[VERIFIED: github.blog/changelog/2026-03-26-gemini-3-pro-deprecated]`
- Bare `gemini-3-flash` alias — **invalid as of 2026-05-18** per Phase 4 codebase comment (`wave0/content-type-detector.ts:14`). Use `gemini-3-flash-preview`. `[VERIFIED: codebase grep + Phase 4 RESEARCH carry-forward]`
- `@google/genai 1.x` — superseded by `2.x` (v2.4.0 latest as of 2026-05-18) but only Interactions API has breaking changes; `generateContent` is unchanged. Phase 5 stays on 1.41; upgrade is a separate phase. `[VERIFIED: npm view; cited release notes]`
- `gemini-2.5-flash` / `gemini-2.5-pro` — still operational but superseded by 3-series for new development. Phase 4 already migrated Wave 0 to `gemini-3-flash-preview`. `[CITED: ai.google.dev/gemini-api/docs/changelog]`

## Model Selection (verified)

**This subsection corrects the AI-SPEC model defaults against the live Gemini Developer API as of 2026-05-18.**

| Tier | AI-SPEC default | Verified status (2026-05-18) | Recommended planner action |
|------|------------------|------------------------------|----------------------------|
| Hook | `gemini-3-pro` | **Deprecated 2026-03-09.** Alias redirects to `gemini-3.1-pro-preview`. No GA Pro exists in the 3-series. | Set `GEMINI_HOOK_MODEL` default to `"gemini-3.1-pro-preview"`. Document the "preview" constraint inline. |
| Body | `gemini-3-flash` | **Bare alias invalid.** API model name is `gemini-3-flash-preview`. | Set `GEMINI_BODY_MODEL` default to `"gemini-3-flash-preview"`. Matches Phase 4 Wave 0 (`content-type-detector.ts:14`). |
| CTA | `gemini-3-flash` | Same as Body. | Set `GEMINI_CTA_MODEL` default to `"gemini-3-flash-preview"`. |

**Pricing as of 2026-05-18** (verified against `ai.google.dev/gemini-api/docs/pricing` and Vertex AI docs):

| Model | Input ($/M tokens) | Output ($/M tokens) | Context size for these rates | Status |
|-------|---------------------|----------------------|------------------------------|--------|
| `gemini-3.1-pro-preview` | $2.00 (≤200K) / $4.00 (>200K) | $12.00 (≤200K) / $18.00 (>200K) | tiered | preview |
| `gemini-3-flash-preview` | $0.50 (text/image/video) / $1.00 (audio) | $3.00 | flat | preview |
| `gemini-3.1-flash-lite` | $0.25 (text/image/video) / $0.50 (audio) | $1.50 | flat | **GA** |
| `gemini-2.5-flash` (legacy) | $0.15 | $0.60 | flat | GA (deprecated for new dev) |

`[CITED: ai.google.dev/gemini-api/docs/pricing — fetched 2026-05-18]`
`[CITED: cloud.google.com/blog/products/ai-machine-learning/gemini-3-1-flash-lite-is-now-generally-available]`
`[CITED: github.com/openclaw/openclaw/issues/38312 — model alias migration notes]`

**Cost re-projection** at corrected models (matches AI-SPEC §4 cost table; AI-SPEC numbers were correct, only the model name strings were wrong):

| Segment | Model | Cost per 30s video |
|---------|-------|--------------------|
| Hook | `gemini-3.1-pro-preview` | ~1.3¢ |
| Body | `gemini-3-flash-preview` | ~0.5¢ |
| CTA | `gemini-3-flash-preview` | ~0.2¢ |
| **Total** | | **~2.0¢** (well under $0.075 milestone cap) |

**Contradiction with CONTEXT.md `<specifics>`:**

The user's "always GA, never preview" rule is **literally unsatisfiable for the Pro tier as of 2026-05-18**. The choice is:

1. **Use `gemini-3.1-pro-preview` despite preview status** (planner recommendation). Pro tier reasoning quality is load-bearing for the 6-score hook decomposition; dropping to Flash on hook risks rubric quality and the headline `weakest_modality` user trust. Note: pricing is the same as the deprecated `gemini-3-pro-preview`, so there is no cost upside to delaying.
2. **Drop to `gemini-3.1-flash-lite` (the only GA option) on all three segments.** Saves ~1¢ per video but abandons the Pro-tier reasoning the user explicitly chose in D-01.
3. **Hold Phase 5 until Gemini 3.1 Pro reaches GA.** Roadmap impact unknown — Google has signaled GA "later in 2026" but no firm date.

**Planner action:** Surface this contradiction to the user during planning (not during execution). The user voiced concern about preview-vs-GA up-front; respecting that voice means asking before locking, not silently picking the preview model. If the user authorizes option (1), update CONTEXT.md `<specifics>` to acknowledge the "preview hook tier" exception.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The current `cachedCalibration` singleton at `gemini.ts:79` is process-wide and the three segment helpers share its warm cache, NOT three separate cold reads. | Standard Stack / Code Examples | If wrong, three disk reads on every fan-out → +tens of ms latency per Vercel cold start. Low impact; verifiable by running a Vitest test that mocks `node:fs` and asserts only one `readFile` call across three concurrent helpers. `[ASSUMED]` |
| A2 | The Phase 4 `videoMetadata: { startOffset: "0s", endOffset: "5s" }` pattern actually constrains Gemini attention to that window — the cost-shape evidence is consistent with it, but I haven't seen a published behavioral test (HAVEN benchmark, arXiv 2503.19622, is the closest grounded evidence). | Architecture Patterns | If wrong, the entire segmentation premise (one upload, three scoped views) collapses to "three identical full-video analyses." Eval D16 (temporal-grounding hallucination rate) is the planned mitigation; AI-SPEC G7+F9 catch it in flywheel. `[ASSUMED]` |
| A3 | Existing `analyzeVideoWithGemini` consumer at `pipeline.ts` will accept a swap to `analyzeVideoSegmented` without further changes than the call-site rename. | Architecture Patterns | If wrong (e.g., pipeline.ts does something with `cost_cents` or the response shape that breaks under the merged result), the swap is more invasive than a one-liner. Verifiable in Step 1 of execution by reading pipeline.ts Wave 1 block. `[ASSUMED]` |
| A4 | The Gemini Developer API (free / paid tiers) and the Vertex AI variant share identical `videoMetadata` semantics for `@google/genai`. | Architecture Patterns | If wrong, code that works in dev (Developer API) may not work in production (if production routes via Vertex). Project currently uses Developer API via `GEMINI_API_KEY` env var, so the risk is theoretical for Phase 5 but worth flagging for Phase 10 / Phase 12. `[ASSUMED]` |
| A5 | The widening of `GeminiVideoAnalysis` (D-13) does not break the existing `FeatureVector` derivation in `aggregator.ts`. The current `FeatureVector` reads `video_signals.*` as `number` (line 16-19 of types.ts shows `number \| null`), so adding nullable hook_decomposition/cta_segment is additive. | Architecture Patterns | If wrong, every consumer of `FeatureVector` needs a defensive null-check. Verifiable by tsc compile pass. `[ASSUMED]` |
| A6 | Gemini 3.1 Pro Preview's behavior on multi-modal hook decomposition (6 scores + weakest_modality + coherence + cognitive load) is good enough to meet the rubric calibration target (LLM-judge ↔ human Spearman ≥ 0.7 per sub-modality, AI-SPEC D5). | Validation Architecture | If wrong, the 30-video labeled reference set will surface the gap during eval phase calibration; planner has the affordance to drop to Flash on hook segment (option 2 above) if Pro quality is below target. `[ASSUMED]` |
| A7 | The `cognitive_load` polarity (HIGHER = WORSE) can be reliably conveyed to Gemini via prompt language alone — the model will not invert it. | Common Pitfalls | If wrong, eval D8's perturbation pair test (one with 1 overlay/cut, one with 4) catches it immediately and the prompt gets rewritten. Risk is contained by the test design. `[ASSUMED]` |
| A8 | The legacy `analyzeVideoWithGemini` export is preserved as-is and remains callable from the eval harness through Phase 12 (per CONTEXT D-11). No deprecation warning during Phase 5. | User Constraints | Locked decision per CONTEXT D-11 — not really an assumption, but if the codebase has hidden coupling between the legacy function's tests and shared module-level state, the test file for the segmented path could collide. Verifiable by running `pnpm test src/lib/engine/__tests__/gemini.test.ts` alongside the new test file. `[ASSUMED]` |
| A9 | A 30-video labeled reference set (AI-SPEC §5 Reference Dataset) is achievable inside Phase 5's calendar window — i.e., 2-3 strategists + 1 CD + 1 editor + 5 niche creators are available and willing to label, OR a smaller initial set (e.g., 5-10 videos for the pilot calibration) is sufficient to bootstrap. | Validation Architecture | If labelers aren't available, the LLM-judge calibration cannot complete and the eval framework runs in code-checks-only mode (D1, D2, D3, D8, D14, D15, D16, D17 still work). The qualitative dimensions (D5, D6, D7, D9, D10, D13) become "ship-and-monitor" instead of "validate-pre-ship." `[ASSUMED]` |

**If this table contained zero rows:** all claims would have been verified. Several `[ASSUMED]` rows above are flagged for user confirmation during discuss-phase / plan-phase — especially A6 (Gemini 3.1 Pro Preview quality) and A9 (labeler availability) which are operational rather than technical.

## Open Questions (RESOLVED)

1. **Should we ship with `gemini-3.1-pro-preview` (preview, but only Pro option) or fall back to `gemini-3.1-flash-lite` (GA, but Flash quality on the hardest segment)?**
   - RESOLVED: User reviewed verified model availability evidence on 2026-05-18 and explicitly approved the preview override. The "always GA, never preview" rule from earlier CONTEXT.md `<specifics>` is suspended for Phase 5. Locked in CONTEXT.md D-01: hook=`gemini-3.1-pro-preview`, body+CTA=`gemini-3-flash-preview`. Migration to GA tracked in CONTEXT.md `<deferred>` "Gemini 3 Pro / Flash GA migration."

2. **Should Phase 5 upgrade `@google/genai` to v2.4.0?**
   - RESOLVED: No. Stay on v1.41.0 for Phase 5. v2 breaking changes are confined to Interactions API; `generateContent` + `videoMetadata` semantics are unchanged. Upgrade deferred to a separate phase (likely Phase 10 ML audit) per researcher recommendation.

3. **Should the body segment use `Promise.allSettled` per-call retry (Section 4b "1 retry on Flash") or hand off to mergeSegments on first failure?**
   - RESOLVED: In-helper retry. Implemented in Plan 02 Task 1 (`runBodySegment` / `runCtaSegment`) following the existing `analyzeWithGemini` retry loop pattern at `gemini.ts:329-392`. Hook (Pro) has 0 retries; body + CTA (Flash) have 1 corrective retry per AI-SPEC §4b.

4. **What is the body segment behavior when video duration is exactly 8s?**
   - RESOLVED: `duration ≤ 8s` skips the body segment (inclusive). Implemented in Plan 02 Task 1 via `validateBodyWindow` helper. Zero-width body window (start=5s, end=duration-3s=5s) is treated as skip; `gemini_body=false` flag set; merge fills `video_signals` with null per graceful-degradation D-08.

5. **Does the existing `pipeline.ts` Wave 1 `Promise.all` block need to become `Promise.allSettled` to handle the new `analyzeVideoSegmented` partial-result shape?**
   - RESOLVED: No change required. `analyzeVideoSegmented` returns a partial `GeminiVideoAnalysis` shape (never throws; sets per-segment `gemini_*=false` on failure) — the existing Wave 1 `Promise.all` path remains compatible because Phase 1's graceful-degradation D-rule already handles null Gemini results. Plan 03 Task 1 verifies this assumption during the Wave 1 swap.

6. **How does Files API behave on a 50MB.minus(1)-byte upload vs a 50MB upload?**
   - RESOLVED: 50MB cap is Virtuna-imposed (cost / latency / typical-content reasons), not an SDK hard limit (SDK max is 2GB). Phase 5 inherits the cap unchanged from `gemini.ts:21`. Documented as inline comment in `segmented.ts` (Plan 02 Task 3).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@google/genai` | All segment calls | ✓ | 1.41.0 (installed; latest 2.4.0) | — |
| `zod` | Schema validation at LLM boundary | ✓ | 4.3.6 (installed; latest 4.4.3) | — |
| `@sentry/nextjs` | Per-segment error capture | ✓ | 10.39.0 | — |
| `vitest` | Unit + integration tests | ✓ | (workspace dev dep) | — |
| `tsx` (via `npx`) | `pnpm eval` / `pnpm eval:phase5` | ✓ | (project dev tool) | — |
| Node.js | Runtime | ✓ | ≥20 (matches `@google/genai` engines requirement) | — |
| `GEMINI_API_KEY` env var | Gemini SDK auth | ✓ | Production secret; local `.env.local` for dev | — |
| `gemini-3.1-pro-preview` API model | Hook segment | ✓ (preview) | Available via Gemini Developer API | Drop to `gemini-3-flash-preview` if Pro is unreachable |
| `gemini-3-flash-preview` API model | Body + CTA segments | ✓ (preview) | Available via Gemini Developer API; already in use by Phase 4 Wave 0 | Drop to `gemini-3.1-flash-lite` (GA) if preview is unreachable |

**Missing dependencies with no fallback:** None — every dependency Phase 5 needs is either already installed or available via env config.

**Missing dependencies with fallback:** None — fallbacks exist for both preview model risks (drop Pro→Flash for hook; drop Flash→Flash-Lite for body/CTA).

## Validation Architecture

> Nyquist Dimension 8 — sampling theorems + property-based test invariants for video segmentation.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (configured at `vitest.config.ts`) |
| Config file | `vitest.config.ts` |
| Quick run command | `pnpm test src/lib/engine/__tests__/gemini-segmented.test.ts` |
| Full suite command | `pnpm test` |
| Coverage threshold | 80% lines / functions / branches / statements on `src/lib/engine/**/*.ts` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEGMENT-01 | Hook segment runs against `videoMetadata: { startOffset: "0s", endOffset: "5s" }` | unit (mock Gemini) | `pnpm test src/lib/engine/__tests__/gemini-segmented.test.ts -t "hook segment uses 0s-5s window"` | ❌ Wave 0 |
| SEGMENT-02 | Body segment uses `5s` → `duration-3s` window | unit (mock Gemini) | `pnpm test ... -t "body segment uses 5s to duration-3s"` | ❌ Wave 0 |
| SEGMENT-03 | CTA segment uses `duration-3s` → `duration` window | unit (mock Gemini) | `pnpm test ... -t "cta segment uses last 3s"` | ❌ Wave 0 |
| SEGMENT-04 | All 3 calls share ONE `fileUri` from ONE upload; delete fires once after all settle | unit (mock Gemini) | `pnpm test ... -t "single upload reused across segments"` | ❌ Wave 0 |
| SEGMENT-05 | Merged result populates `factors` from hook + `video_signals` from body + `cta_segment` from CTA | unit | `pnpm test ... -t "merge populates each field from correct segment"` | ❌ Wave 0 |
| SEGMENT-06 | Env-var overrides honored: `GEMINI_HOOK_MODEL`/`GEMINI_BODY_MODEL`/`GEMINI_CTA_MODEL` | unit | `pnpm test ... -t "env var overrides default models"` | ❌ Wave 0 |
| HOOK-01..04 | Each sub-modality score returned as 0-10 number | unit + Zod validate | `pnpm test ... -t "hook decomposition returns 4 sub-scores"` | ❌ Wave 0 |
| HOOK-05 | `weakest_modality` is one of the 4 enum values AND corresponds to a present modality | unit (fixture: silent hook, model claims `audio_hook_quality=0` and does NOT name it as weakest) | `pnpm test ... -t "weakest_modality respects absent modalities"` | ❌ Wave 0 |
| HOOK-06 | `visual_audio_coherence` 0-10 returned | unit | `pnpm test ... -t "visual_audio_coherence in 0-10 range"` | ❌ Wave 0 |
| HOOK-07 | `cognitive_load` polarity inverted: higher = worse. Perturbation pair (low-density vs high-density fixture) → high-density MUST get strictly higher score | property-based | `pnpm test ... -t "cognitive_load polarity test (perturbation pair)"` | ❌ Wave 0 |

### Sampling Theorems / Property-Based Invariants

These are the **sampling-theorem / property-based test invariants** that catch implementation drift over time. Each is a *property* of the segmented analyzer that should hold for ANY valid input — not just the specific fixtures shown above.

1. **Window Invariant (Nyquist boundary check):**
   For any valid video of duration `D ≥ 8s`:
   - hook window = `[0, 5]` seconds
   - body window = `[5, D-3]` seconds
   - CTA window = `[D-3, D]` seconds
   - Union = `[0, D]` (no gap, no overlap by spec; an off-by-one in any boundary fails this invariant)
   - For `D < 8s`: body window is empty → body call MUST be skipped (gemini_body=false)

2. **Single-Upload Invariant:**
   For any successful run, `mockFileUpload.mock.calls.length === 1` AND `mockFileDelete.mock.calls.length === 1`. Three uploads = bug. Zero deletes = file leak.

3. **Parallel-Latency Invariant:**
   Total wall-clock latency ≤ max(hook, body, cta) + 200ms overhead. Serial implementations fail this with ~3× latency. (This is the "Promise.allSettled vs for-await" assertion.)

4. **Per-Segment Independence Invariant (failure isolation):**
   For all 2³ = 8 failure permutations (HHH, HHF, HFH, HFF, FHH, FHF, FFH, FFF) of `Promise.allSettled` outcomes, the merged result's `signalAvailability` matches the input pattern AND `pipeline_warning` events fire exactly for the failed segments.

5. **Schema-Validity Invariant:**
   For any successful segment response, the Zod parse succeeds → return non-null analysis. For any Zod failure (schema-valid JSON but semantically invalid like score=11 or weakest_modality outside enum), the helper returns `{ ok: false }` and the merge null-fills the corresponding fields.

6. **CTA Cross-Field Invariant (Zod `.refine`):**
   `cta_present === true ⇔ strength !== null AND type !== null`. Inversely, `cta_present === false ⇔ strength === null AND type === null`. Any other combination fails Zod.

7. **Cost Polarity Invariant:**
   `cost_cents > 0` on success path; `cost_cents === 0` on failure path. Total per-video cost = sum of per-segment costs; the sum equals the value emitted by the orchestrator's final logging line.

8. **Polarity Invariant (cognitive_load):**
   On a perturbation pair where Video A has 1 text overlay + 1 cut and Video B has 4 overlays + 4 cuts in the first 5s, `cognitive_load(B) > cognitive_load(A)`. This is the load-bearing test for HOOK-07's inverted polarity.

9. **Temporal-Grounding Invariant (HAVEN-class):**
   The hook segment's `rationale` text MUST NOT reference timestamps > 5s. Regex match against `\b(?:[6-9]|[1-9]\d+)s\b`, `\bafter the (?:hook|5 seconds)\b`, `\bat the end\b`, `\blater in the video\b` returns zero matches in successful hook segments.

10. **Backward-Compatibility Invariant (D-11 + AI-SPEC):**
    Existing `analyzeVideoWithGemini` test fixtures and call shapes continue to work — running `pnpm test src/lib/engine/__tests__/gemini.test.ts` returns 100% pass after Phase 5 ships. (Phase 5 widens the analysis type; old tests must keep using the un-widened shape via optional fields.)

### Wave 0 Gaps

Test infrastructure that must exist BEFORE the segmented module can be implemented:

- [ ] `src/lib/engine/__tests__/gemini-segmented.test.ts` — covers SEGMENT-01..06 + HOOK-01..07 + all 10 sampling-theorem invariants. **NEW.**
- [ ] `src/lib/engine/__tests__/gemini-segmented-fixtures.ts` (or inline in main test) — `VALID_HOOK_FIXTURE`, `VALID_BODY_FIXTURE`, `VALID_CTA_FIXTURE`, `HOOK_USAGE`, `BODY_USAGE`, `CTA_USAGE` constants. Plus perturbation pairs for invariant #8. **NEW.**
- [ ] `src/lib/engine/__tests__/aggregator-cta-penalty.test.ts` — covers D-06 penalty matrix (tutorial=-0.5, b_roll=-0.3, others neutral) keyed on Wave 0 content_type. **NEW.**
- [ ] Extension to existing `pipeline.test.ts` — verifies Wave 1 swap from `analyzeVideoWithGemini` → `analyzeVideoSegmented`, three new stage events emitted, signal_availability merged correctly. **EXISTING file extended.**
- [ ] No framework install needed — Vitest already configured with 80% coverage threshold.

If the planner finds no test scaffolds exist, those gaps must be filled in Wave 0 before any implementation tasks. The `wave0-content-type.test.ts` is the gold standard for the mock pattern; Phase 5 mirrors it three times.

## Sources

### Primary (HIGH confidence)

- **`@google/genai` SDK on Context7 / GitHub** — `mcp__context7__get-library-docs /googleapis/js-genai`. `videoMetadata` interface verified; `FileState` enum verified; `generateContent` shape verified. `[VERIFIED via Context7 ctx7 CLI]`
- **`ai.google.dev/gemini-api/docs/pricing`** — Gemini 3 Pro / Flash / Flash-Lite pricing, model name strings, preview vs GA status. `[CITED: WebFetch 2026-05-18]`
- **`ai.google.dev/gemini-api/docs/video-understanding`** — `videoMetadata` worked example; `startOffset`/`endOffset` format. `[CITED via WebSearch]`
- **`github.com/googleapis/js-genai/releases`** — v2 breaking changes scope (Interactions API only). `[CITED via WebSearch]`
- **`github.blog/changelog/2026-03-26-gemini-3-pro-deprecated`** — Gemini 3 Pro deprecation timeline; alias redirect to 3.1 Pro. `[CITED via WebSearch]`
- **`cloud.google.com/blog/products/ai-machine-learning/gemini-3-1-flash-lite-is-now-generally-available`** — Gemini 3.1 Flash-Lite GA confirmation. `[CITED via WebSearch]`
- **Existing codebase patterns** — `src/lib/engine/gemini.ts` lines 17, 96, 200-340, 409-545 (single-call video analysis); `src/lib/engine/wave0/content-type-detector.ts` lines 150-168 (`videoMetadata` pattern); `src/lib/engine/__tests__/wave0-content-type.test.ts` lines 23-34 (Vitest mock pattern); `src/lib/engine/types.ts` lines 198-206 (`SignalAvailability` shape). `[VERIFIED via Read tool]`
- **Project `vitest.config.ts`** — 80% coverage threshold; node environment default. `[VERIFIED via Read tool]`
- **Project `package.json`** — `@google/genai ^1.41.0`, `zod ^4.3.6`, `@sentry/nextjs ^10.39.0`, `vitest` in dev deps. `[VERIFIED via Read tool]`
- **AI-SPEC §1-7 (`05-AI-SPEC.md`)** — framework decision, evaluation dimensions D1-D21, guardrails G1-G7, monitoring M1-M10. The AI-SPEC is the implementation contract; Phase 5 RESEARCH respects every locked design decision in it. `[VERIFIED via Read tool]`
- **CONTEXT.md (`05-CONTEXT.md`)** — locked decisions D-01..D-15 + Claude's discretion list + deferred ideas. `[VERIFIED via Read tool]`

### Secondary (MEDIUM confidence)

- **HAVEN arXiv 2503.19622** — multimodal video hallucination benchmark; cited in AI-SPEC failure mode #9. Used as grounding for the "temporal-grounding hallucination" invariant. `[CITED via AI-SPEC]`
- **Phase 4 RESEARCH carry-forward** — `gemini-3-flash-preview` model name correction; bare `gemini-3-flash` alias invalid. `[CITED via codebase comment at content-type-detector.ts:14]`
- **`devtk.ai/en/models/gemini-3-1-pro/`** — Gemini 3.1 Pro Preview pricing confirmation ($2.00/$12.00 per 1M tokens). `[CITED via WebSearch]`

### Tertiary (LOW confidence)

- **AI-SPEC §1b rubric calibration ingredients** — practitioner-language rubric for `visual_stop_power`, `audio_hook_quality`, etc. The Section 1b rubric is Virtuna's opinion (sourced from creator-economy blog posts, growth-coach commentary, CHI 2025 "Curious Shorts"). Domain validity is HIGH; calibration against actual creator outcomes is the open question Phase 12 answers. `[CITED via AI-SPEC §1b]`
- **CONTEXT.md "Gemini 3.1 Pro preview-only as of 2026-05-18"** — flagged as deferred. Web search shows 3.1 Pro is still preview; my reading (from Vertex docs + blog posts) is consistent with CONTEXT.md. Note: CONTEXT framed this as "preview only" — same conclusion, but I emphasized that the GA Pro option literally doesn't exist (vs. "exists but in preview"). `[CITED via WebSearch; CITED via CONTEXT]`

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — every dependency is in `package.json`, every version verified against npm registry, the SDK pattern is already in production use at `wave0/content-type-detector.ts`.
- Architecture: **HIGH** — `Promise.allSettled` + single Files API upload + `videoMetadata` per-segment scoping is a textbook pattern; AI-SPEC §3 covers it correctly; Phase 4 already proved the constituent primitives in this repo.
- Pitfalls: **HIGH** — all 10 pitfalls have either direct codebase evidence (Pitfall #9 about `calculateCost`) or AI-SPEC documentation (Pitfalls #1-#8) or Phase 4 carry-forward (Pitfall #4 about offset format).
- Model selection: **HIGH** — pricing + model names + GA status verified against Vertex AI docs + Google blog announcements as of 2026-05-18. The AI-SPEC's `gemini-3-pro` / `gemini-3-flash` defaults are factually wrong; this RESEARCH supplies the verified strings.
- Rubric calibration: **MEDIUM** — AI-SPEC §1b grounds the rubric in creator-economy sources, CHI 2025 academic work, and practitioner commentary. The 30-video labeled reference set will validate it in Phase 12; until then, treat the rubric language as Virtuna's opinion (defensible, not absolute).
- Cost estimates: **HIGH** — pricing × token estimates from AI-SPEC §4 cross-checked against Vertex AI docs; the ~2.0¢/video total is consistent across both.
- Validation invariants: **HIGH** — all 10 invariants map to either a Phase 5 success criterion or an AI-SPEC eval dimension; the Wave 0 gaps are concrete + actionable.

**Research date:** 2026-05-18
**Valid until:** 2026-06-17 (30 days for stable APIs; **7 days if Google announces Gemini 3.1 Pro GA, in which case model defaults need re-verification**)
