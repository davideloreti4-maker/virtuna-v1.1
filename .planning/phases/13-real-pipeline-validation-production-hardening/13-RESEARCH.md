# Phase 13: Real Pipeline Validation + Production Hardening — Research

**Researched:** 2026-05-22
**Domain:** Multi-stage AI prediction pipeline validation (Gemini + DeepSeek video analysis); production hardening; LLM model verification; signal-grounded counterfactual prompt engineering
**Confidence:** HIGH (codebase grounding); MEDIUM (Gemini live model lineup — verified via WebSearch May 2026, but model availability is fluid week-to-week)

## Summary

Phase 13 is the milestone acceptance gate — a five-front hardening pass that proves Engine v3 works on real TikTok video uploads. Five concurrent deliverables: (1) Stage 11 rebuild (DeepSeek → Gemini 3.1 Pro, video-grounded via reused `fileUri`, always-on, adaptive per score band); (2) pipeline-wide Gemini model audit (drop `-preview` suffixes, verify live `response.model` matches request); (3) caption-less engine audit (primary user flow uploads video bytes without caption — comprehensive `AUDIT-CAPTION-LESS.md` catalogs every stage that reads `payload.content_text`); (4) pipeline cleanup (fold Wave 0 niche into Gemini, share `fileUri`, lift upload cap 50MB → 287MB, re-tune SCORE_WEIGHTS for video-mode reality); (5) 1 → 5 → 10 real video E2E validation through the UI.

The work is mostly **decision-locked** in CONTEXT.md (D-01 through D-32). Research scope is therefore narrow: verify the locked stack against live sources (Gemini model IDs, DeepSeek hang patterns), ground recommendations in actual file paths, surface pitfalls for the cross-phase code review.

**Primary recommendation:** Execute strictly per CONTEXT.md. Build the Gemini self-test script FIRST (gates all subsequent E2E work — D-21). Sequence: self-test → caption-less audit → signal-weight + Stage 11 rebuild → pipeline cleanup → 1-video smoke → 5-video → 10-video → version flip → merge. Do not pre-build DeepSeek hang mitigation (D-22) — wait for evidence.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Gemini model verification (self-test) | Backend script (`scripts/`) | — | One-off CLI utility; not a runtime path |
| Stage 11 counterfactual generation | API / Backend (engine module) | — | Pure pipeline stage; UI consumes via `result.counterfactuals` |
| `fileUri` upload + reuse | API / Backend (pipeline orchestrator) | — | Files API state lives server-side; pipeline owns the lifetime |
| Caption-less audit (read-only review) | Documentation artifact (`.planning/`) | — | Static audit — not a runtime path |
| Signal-weight re-tuning | API / Backend (`aggregator.ts`) | — | Pure config change at module top |
| E2E smoke (real TikTok URLs) | Frontend (UI upload flow) → API → Backend | DB (analysis_results) | Real user flow — exercises the upload form + SSE stream + result render |
| Post-publish metric fetch | Local CLI (Claude WebFetch) | — | One-off per video; not in pipeline |
| Validation diff report | Documentation artifact (`.planning/phases/13-.../validations/`) | — | Per-video markdown; reviewer-facing |
| Cache invalidation on version flip | API / Backend (`prediction-cache.ts`) | DB (analysis_results.engine_version) | Cache keys on `ENGINE_VERSION` — flip auto-invalidates |
| `ENGINE_VERSION` flip | Backend (`src/lib/engine/version.ts`) | — | 1-line constant change; gated by 10/10 pass |
| Code-logic review of phases 9-12 | Documentation artifact | — | Static review — not code changes per se |
| Milestone merge | Git (worktree → main) | — | Branch operation per `~/.claude/rules/gsd-worktree.md` |

## User Constraints (from CONTEXT.md)

> Copied verbatim from `13-CONTEXT.md`. Planner MUST honor these — they are locked decisions, not exploratory suggestions.

### Locked Decisions

**Stage 11 Rebuild (the value prop)**
- **D-01:** Video-grounded via Wave 1 `fileUri` reuse — Stage 11 gets a NEW Gemini call referencing the same `fileUri` Wave 1 already uploaded. Zero re-upload cost.
- **D-02:** Model = `gemini-3.1-pro` (replaces `deepseek-v4-flash`). Flagship reasoning, 2M context, ~$0.13/analysis.
- **D-03:** Full signal context in prompt — Gemini factor scores, fired rules, trend matches, persona dissent, platform fit, hook decomposition, FULL DeepSeek reasoning (no 500-char truncation), video access via `fileUri`.
- **D-04:** Skip removed. No `overall_score >= 70` short-circuit. Always runs.
- **D-05:** Adaptive shape per score band:
  - `<50` → 3 hyper-specific fixes
  - `50-70` → 2 fixes + 1 reinforcement
  - `≥70` → 1 stretch + 2-3 reinforcements
- **D-06:** Replace legacy `<SuggestionsSection>` — reads `result.counterfactuals.suggestions`. Legacy `result.suggestions[]` becomes internal-only.
- **D-07:** UI-SPEC pass already complete (`13-UI-SPEC.md` exists).

**Pipeline-Wide Gemini Model Assignment**
- **D-08:** Model split by task complexity:
  | Stage | Model |
  |---|---|
  | Wave 0 content-type + niche (folded) | `gemini-3.1-flash-lite` |
  | Wave 1 hook segment | `gemini-3.1-pro` |
  | Wave 1 body segment | `gemini-3-flash` |
  | Wave 1 CTA segment | `gemini-3-flash` |
  | Stage 11 counterfactuals | `gemini-3.1-pro` |
- **D-09:** Drop `-preview` suffix from all model IDs.
- **D-10:** Investigate Gemini silent-fallback to 2.5 (Google SDK substituting unknown IDs; `gemini/cost.ts:50-52` legacy pinning; `gemini.ts:185` calculateCost shim).

**Caption Demotion + Three-Mode Engine Contract**
- **D-11:** Caption demoted to non-signal. Engine derives from video bytes only.
- **D-12:** Three modes — `video_upload` (PRIMARY 90%+, caption ignored), `tiktok_url` (full pipeline + post-publish fetch, caption ignored), `text-only` (degraded prediction, signal chips show ✕).
- **D-13:** Comprehensive Plan 1 `AUDIT-CAPTION-LESS.md` catalogs every stage that reads `payload.content_text` / `caption` with fix-or-document verdict.

**Signal Weight Re-Tuning (Video-Mode Reality)**
- **D-14:** Rules signal disabled (weight=0). All 17 regex-tier rules in `rules.ts:138-171` operate on caption text.
- **D-15:** Retrieval signal disabled (weight=0). Caption-derived `buildSubjectText` at `retrieval/embedder.ts:116`.
- **D-16:** Re-tuned weights — `behavioral 0.40, gemini 0.35, audio 0.10, trends 0.10, platform_fit 0.05, ml 0, retrieval 0, rules 0`. Sum = 1.00.

**Pipeline Optimizations**
- **D-17:** Fold Wave 0 niche detector into Gemini Wave 0 content-type call (single Gemini call returns `{ content_type, niche }`). Removes 1 of 6 DeepSeek call sites.
- **D-18:** Share `fileUri` across stages. Currently 3 uploads per analysis (Wave 0 content-type, Wave 1 segmented, Stage 11). Upload once at pipeline entry.
- **D-19:** Lift `VIDEO_MAX_SIZE_BYTES` to 287MB (currently 50MB at `gemini.ts:40` + `gemini/segmented.ts:43`).
- **D-20:** Cost budget $0.40 per analysis.

**Infrastructure Hardening**
- **D-21:** Build `scripts/engine-self-test.ts` — hits each Gemini slot, asserts `response.model === requested.model`. Gates before any E2E.
- **D-22:** DeepSeek hang mitigation deferred to first manifestation. Focus on `deepseek-reasoner` (Wave 2). Pragmatic.
- **D-23:** Cache invalidation on `ENGINE_VERSION` flip — `prediction-cache.ts` already keys on `ENGINE_VERSION` (verified — see Code Examples below). Verify, don't rebuild.
- **D-24:** Pre-existing tests need update (caption demotion + signal weight changes will cause mass failures).

**Acceptance Gate**
- **D-25:** 1 → 5 → 10 real video cadence through the UI. Per-video diff report at `validations/video-NN.md`.
- **D-26:** Video set: user-picked, score-band stratified (3-4 low, 3-4 high, 2-3 mid; ≥3 niches).
- **D-27:** `ENGINE_VERSION` flip ONLY after 10 videos pass.
- **D-28:** User is the gate for milestone merge.

**Phase 12 Reconciliation**
- **D-29:** Archive Phase 12 as superseded. Keep `--max-rows` flag, `platt_parameters` row, 12-* artifacts. Discard `.planning/research/smoke-v3.json`. Update `12-HANDOFF.md` with closing note.

**SignalAvailability Chip Three-State**
- **D-30:** Chips distinguish ✓ available + contributed, ✕ intentionally disabled, ⚠ failed for THIS video.

**Earlier-Phase Verification (Folded Into Phase 13)**
- **D-31:** ≥1 `input_mode = "tiktok_url"` video in the 10-video cadence.
- **D-32:** `trending_sounds` DB population check (audio weight bumping 0.07 → 0.10; if sparse, bump is meaningless).

### Claude's Discretion

- Exact `engine-self-test.ts` CLI shape (single command vs subcommands per slot)
- Specific `AUDIT-CAPTION-LESS.md` structure (per-stage table vs flat findings list)
- Whether to introduce a shared `videoFileUri` field on the pipeline context or pass as function arg
- Per-band suggestion shape Zod schema details (single vs discriminated-union schema)
- Exact `WebFetch` prompt for TikTok metric extraction (will iterate per video)
- DeepSeek hang kill-path implementation when it manifests (gtimeout subprocess vs in-process timeout cascade)

### Deferred Ideas (OUT OF SCOPE)

- Re-embed corpus from video features (M2, ~$2300 + 4-6h compute)
- Rebuild rules from video transcript (M2 — all 17 regex-tier rules are caption-pattern-based)
- Retrain Platt calibration on video-mode predictions (M2 or later)
- Granular Sentry surface for model mismatch (M2)
- Caching scope for Stage 11 across users (M2)
- Pre-upload compression / video trimming UX (M2)
- Tighter cost budget once 10-video data lands (M2)
- TikTok URL flow auto-fetches actuals into UI (M2)

## Phase Requirements

> Phase 13 requirement IDs are not yet derived — ROADMAP §306 reads "to be derived during /gsd-plan-phase 13". The planner will produce the requirement table by mapping ROADMAP success criteria (SC#1-8) to plan task IDs. Research findings below are organized by ROADMAP success criterion + CONTEXT decision number so the planner can wire them directly.

## Project Constraints (from CLAUDE.md)

- **Stack:** Next.js 15, TypeScript, Tailwind v4, Supabase. Coral (#FF7F50), Raycast aesthetic.
- **Worktree:** Engine work happens on `milestone/engine-foundation` branch in `~/virtuna-engine-foundation/`. Auto-push hook enabled (`git config core.hooksPath .githooks`).
- **File organization:** `src/` for code, `tests/` for tests, `scripts/` for utilities, `.planning/` for GSD artifacts. NEVER save to root.
- **Commit format:** `type(phase): description` (e.g. `feat(13): Stage 11 rebuild with Gemini 3.1 Pro`).
- **No new .md files** unless explicitly required. The `AUDIT-CAPTION-LESS.md` + `validations/video-NN.md` files ARE explicitly required by CONTEXT D-13 + D-25.
- **Tailwind v4 + Lightning CSS quirks:** Apply `backdrop-filter` via React inline styles, not CSS classes. Very dark colors (L<0.15) compile incorrectly in `@theme` — use exact hex.
- **Test/build before commit:** `npm test` (Vitest), `npm run build`. Always verify.
- **No secrets in source.** `GEMINI_API_KEY` / `DEEPSEEK_API_KEY` read from env at runtime.

## Standard Stack

### Core (Existing — Locked by CONTEXT)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@google/genai` | already installed | Gemini SDK — `ai.files.upload()`, `ai.models.generateContent()`, polling, abort signal | Official Google SDK; pattern proven across Wave 0, Wave 1, Wave 4 [VERIFIED: codebase grep] |
| `openai` | already installed | DeepSeek via OpenAI-compatible client (`baseURL: "https://api.deepseek.com"`) | Pattern proven in deepseek.ts, niche-detector.ts, stage11-counterfactuals.ts, stage10-critique.ts, platform-fit.ts [VERIFIED: codebase grep] |
| `zod` | already installed | Boundary validation for all LLM responses | Existing pattern — `CounterfactualsResponseSchema`, `GeminiResponseSchema`, etc. |
| `vitest` | ^4.0.18 | Unit + integration test framework | Already in use; 77 test files exist [VERIFIED: codebase grep] |
| `@playwright/test` | ^1.58.0 | E2E browser tests | Already in use for `e2e/` and `extraction/` configs [VERIFIED: package.json] |
| `@sentry/nextjs` | already installed | Error capture; tag-by-stage pattern | Existing pattern at every catch block in engine modules |

### Supporting (May Be Needed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:child_process` (`execFile`/`spawn`) + `gtimeout` | built-in + system (verified available at `/opt/homebrew/bin/gtimeout`) | DeepSeek hang kill-path — outer subprocess deadline when in-process `AbortSignal.timeout` is unreliable | ONLY if D-22 trigger fires (hang first manifests in E2E). Claude's Discretion which form. |
| Existing `AbortController` + `setTimeout` race | built-in | In-process timeout — current pattern across all engine modules | Default; existing pattern at `deepseek.ts:530-553`, `gemini.ts:566-590` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Gemini 3.1 Pro for Stage 11 | DeepSeek Reasoner | Stronger CoT but unresolved hang risk — explicitly rejected in DISCUSSION-LOG.md |
| Apify TikTok scraper | Claude WebFetch | Apify reuses corpus infra but is overkill at 10-video scale. CONTEXT explicitly chose WebFetch. |
| Per-segment file upload | Shared `fileUri` (D-18) | 3 uploads vs 1; Gemini Files API 48h TTL covers reuse |

**Verified versions:**
- Node 25.2.1, npm 11.6.2 [VERIFIED: local environment]
- `gtimeout` present at `/opt/homebrew/bin/gtimeout` (GNU coreutils) — viable for outer-subprocess hang kill [VERIFIED: which]

## Architecture Patterns

### System Architecture Diagram

```
                     UI Upload (Next.js client)
                              │
                              ▼
                   POST /api/analyze (route.ts)
                              │
                ┌─────────────┴──────────────┐
                ▼                            ▼
      computeContentHash             lookupPredictionCache
                │                            │ (key: hash::ENGINE_VERSION::userId)
                │                            ▼
                │                    L1 in-memory → L2 Supabase analysis_results
                │                            │
                ▼                            ▼ (miss)
        runPredictionPipeline ◀──────────────┘
                │
                ▼
   ┌────────────────────────────────────────────┐
   │  Pipeline orchestrator (pipeline.ts)        │
   │                                             │
   │  ai.files.upload(buffer) ──► poll ACTIVE   │  ◀── D-18: single upload, share fileUri
   │             │                               │
   │             ▼                               │
   │  ┌──────────┴──────────┐                   │
   │  │  Wave 0 (folded)    │  Gemini 3.1 Flash-Lite — content_type + niche (D-17)
   │  │  Creator ctx        │  Supabase profile read
   │  └──────────┬──────────┘
   │             │
   │  ┌──────────┴──────────┐
   │  │  Wave 1 (parallel)  │  Gemini 3.1 Pro (hook) + Gemini 3 Flash (body, CTA)
   │  │  Audio fingerprint  │  pgvector match against trending_sounds (D-32 check)
   │  │  Rules (DISABLED)   │  D-14 weight=0; still runs but contributes 0
   │  │  Trends             │  Audio-fingerprint based
   │  └──────────┬──────────┘
   │             │
   │  ┌──────────┴──────────┐
   │  │  Wave 2: DeepSeek   │  deepseek-reasoner (30-60s, hang vector — D-22)
   │  │  reasoning (CoT)    │  TIMEOUT_MS=90_000; AbortController race
   │  └──────────┬──────────┘
   │             │
   │  ┌──────────┴──────────┐
   │  │  Wave 3: Personas   │  10 parallel deepseek-v4-flash calls
   │  └──────────┬──────────┘
   │             │
   │  ┌──────────┴──────────┐
   │  │  Wave 4: Platform   │  deepseek-v4-flash — TikTok/IG/YT fit scores
   │  │  fit                │
   │  └──────────┬──────────┘
   │             ▼
   │  aggregateScores() ─► applyContentTypeWeights ─► applyPlattScaling
   │             │
   │             ▼
   │  Stage 10 critique ─► applyCritiqueAdjustment (confidence)
   │             │
   │             ▼
   │  Stage 11 counterfactuals (REBUILT — D-01..D-06)
   │     - Gemini 3.1 Pro via shared fileUri
   │     - Full signal context in prompt (D-03)
   │     - Always runs (D-04)
   │     - Adaptive shape per band (D-05)
   │             │
   │             ▼
   │  maybeAppendLikelyFlopWarning
   └─────────────┬───────────────────────────────┘
                 │
                 ▼
        SSE stream stage events to client
                 │
                 ▼
        ResultsPanel ─► SuggestionsSection
                          reads result.counterfactuals.suggestions (D-06)
        SignalAvailabilityChips ─► three-state (D-30)
```

### Recommended Project Structure

No new directories — Phase 13 modifies existing files + adds two artifacts:

```
src/lib/engine/
├── version.ts                    # D-27 1-line flip
├── aggregator.ts                 # D-16 weights, D-06 wiring
├── stage11-counterfactuals.ts    # D-01..D-05 rebuild
├── stage11-counterfactuals-prompts.ts # D-03 prompt + D-05 schema rebuild
├── gemini.ts                     # D-09 -preview drop, D-10 fallback fix, D-19 287MB
├── gemini/
│   ├── cost.ts                   # D-09 -preview drop in PRICING table
│   └── segmented.ts              # D-19 287MB, D-18 fileUri reuse
├── wave0/
│   ├── content-type-detector.ts  # D-17 schema extension (fold niche)
│   └── niche-detector.ts         # DELETE after D-17 fold complete
├── rules.ts                      # D-14 no code change; weight=0 in aggregator
├── retrieval/embedder.ts         # D-15 no code change; weight=0 in aggregator
└── pipeline.ts                   # D-18 fileUri threading

src/components/app/simulation/
├── results-panel.tsx             # D-06 rewire to result.counterfactuals
├── insights-section.tsx          # SuggestionsSection rebuild per UI-SPEC
└── signal-availability-chips.tsx # D-30 three-state

src/app/api/analyze/route.ts      # D-23 verify engine_version cache key
src/lib/engine/cache/prediction-cache.ts # D-23 verify (likely already correct)

scripts/
└── engine-self-test.ts           # D-21 NEW

.planning/phases/13-real-pipeline-validation-production-hardening/
├── 13-AUDIT-CAPTION-LESS.md      # D-13 NEW
├── 13-CODE-REVIEW-PHASES-9-12.md # Cross-phase logic review artifact
└── validations/
    ├── video-01.md ... video-10.md  # D-25 NEW
```

### Pattern 1: Self-test script for live LLM model verification

**What:** A standalone Node script that probes each Gemini model slot with a minimal generateContent call and asserts `response.model === requested.model`.

**When to use:** Pre-flight check before E2E runs; CI smoke test on env changes.

**Example:**
```typescript
// Source: pattern adapted from src/lib/engine/wave0/content-type-detector.ts:147-169
// scripts/engine-self-test.ts
import { GoogleGenAI } from "@google/genai";

const SLOTS = [
  { name: "wave0",  model: process.env.GEMINI_WAVE0_MODEL ?? "gemini-3.1-flash-lite" },
  { name: "hook",   model: process.env.GEMINI_HOOK_MODEL  ?? "gemini-3.1-pro" },
  { name: "body",   model: process.env.GEMINI_BODY_MODEL  ?? "gemini-3-flash" },
  { name: "cta",    model: process.env.GEMINI_CTA_MODEL   ?? "gemini-3-flash" },
  { name: "stage11",model: process.env.GEMINI_STAGE11_MODEL ?? "gemini-3.1-pro" },
];

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

for (const slot of SLOTS) {
  const response = await ai.models.generateContent({
    model: slot.model,
    contents: [{ role: "user", parts: [{ text: "Return the JSON: {\"ok\":true}" }] }],
    config: { responseMimeType: "application/json" },
  });
  const reportedModel = (response as any).modelVersion ?? (response as any).model;
  const match = reportedModel?.startsWith(slot.model);
  console.log(`${slot.name}: requested=${slot.model} reported=${reportedModel} match=${match}`);
  if (!match) process.exit(1);
}
```

Note: The `response.modelVersion` field is the actual model the SDK billed against. If it returns `gemini-2.5-flash` while you requested `gemini-3.1-pro`, that's the silent-fallback bug from D-10.

### Pattern 2: Shared `fileUri` threading through pipeline context

**What:** Lift the `ai.files.upload()` call from per-stage (currently 3 callers) to a single pipeline-entry upload; pass `fileUri` + cleanup deferred to pipeline finally{}.

**When to use:** D-18 fileUri sharing; reduces 3 uploads/analysis to 1.

**Current call sites:**
- `wave0/content-type-detector.ts:123` — uploads + deletes per call
- `gemini.ts:515` — legacy `analyzeVideoWithGemini` upload
- `gemini/segmented.ts:102` — segmented orchestrator upload (Wave 1)

**Shape (Claude's Discretion per CONTEXT — function arg vs context field):**

```typescript
// Option A: function arg (more verbose, explicit)
async function detectContentType(
  payload: ContentPayload,
  supabase: SupabaseClient,
  videoContext?: { fileUri: string; mimeType: string },  // NEW — when present, skip upload
  onEvent?: StageEventCallback,
): Promise<Wave0ContentTypeResult | null>

// Option B: shared field on PipelineResult-feeder (centralized)
interface PipelineContext {
  videoFileUri: string | null;
  videoMimeType: string | null;
  // ... existing fields
}
```

Pipeline.ts upload at entry:
```typescript
// In runPredictionPipeline — after payload normalization, before any stage
let videoFileUri: string | null = null;
let videoMimeType: string | null = null;
let uploadedFileName: string | undefined;

if (payload.input_mode === "video_upload" && payload.video_storage_path) {
  const { data: videoBlob } = await supabase.storage.from("videos").download(payload.video_storage_path);
  const buffer = Buffer.from(await videoBlob!.arrayBuffer());
  if (buffer.byteLength > VIDEO_MAX_SIZE_BYTES) throw new Error("...");

  const ai = getClient();
  const blob = new Blob([new Uint8Array(buffer)], { type: videoMimeType });
  const uploadResult = await ai.files.upload({ file: blob, config: { mimeType: videoMimeType } });
  uploadedFileName = uploadResult.name;
  // poll to ACTIVE...
  videoFileUri = uploadResult.uri;
}

try {
  // run stages — pass videoFileUri through
} finally {
  if (uploadedFileName) {
    try { await ai.files.delete({ name: uploadedFileName }); } catch {}
  }
}
```

### Pattern 3: Signal-grounded counterfactual prompt with full context injection

**What:** Stage 11 receives a structured user message containing every signal the engine produced, plus the video itself via `fileUri`. Output is a Zod-validated discriminated union per band.

**When to use:** D-03 + D-05 implementation.

**Prompt skeleton (system prompt — STABLE for cache hits):**
```
You are a counterfactual reasoning assistant for a TikTok content analytics engine.

You receive: (1) the video itself via fileData, (2) every signal the engine extracted, (3) the engine's overall score.

Your job depends on the score band:
- band=low (<50): Return exactly 3 fixes. Each must reference a specific signal that's failing.
- band=mid (50-70): Return 2 fixes + 1 reinforcement of the strongest signal.
- band=high (>=70): Return 1 stretch optimization + 2-3 reinforcements tied to specific signals.

Each item must include:
- type: "fix" | "stretch" | "reinforcement"
- headline: ≤80 char single-line summary
- detail: 1-3 sentence explanation
- timestamp_ms: number — video timestamp anchor when applicable, 0 otherwise
- signal_anchor: which signal grounds this (e.g. "gemini.scroll_stop_power", "persona_dissent", "audio.silence_ratio")

Ground every claim in the data. Do not invent.
```

**User message (volatile — full signal context per D-03):**
```typescript
// stage11-counterfactuals-prompts.ts rebuild
function buildSignalContextUserMessage(result: PredictionResult): string {
  return `## Score
overall: ${result.overall_score}
confidence: ${result.confidence}
band: ${result.overall_score < 50 ? "low" : result.overall_score < 70 ? "mid" : "high"}

## Gemini Factor Scores
${result.factors.map(f => `- ${f.name}: ${f.score}/10 — ${f.rationale}`).join("\n")}

## Hook Decomposition (when available)
${JSON.stringify(result.hook_decomposition ?? null, null, 2)}

## Audio Signals
${JSON.stringify(result.audio_signals ?? null, null, 2)}

## Trend Matches
${result.matched_trends?.map(t => `- ${t.sound_id} velocity=${t.velocity_score}`).join("\n") ?? "(none)"}

## Persona Dissent (Wave 3)
${result.persona_simulation_results?.map(p => `- ${p.persona_id}: verdict=${p.verdict} dissent=${p.dissent ?? false}`).join("\n") ?? "(none)"}

## Platform Fit (Wave 4)
${JSON.stringify(result.platform_fit ?? null, null, 2)}

## DeepSeek Reasoning (full, untruncated — per D-03)
${result.reasoning ?? "(none)"}

## Engine's Earlier Suggestions (internal context — do NOT pass through)
${(result.suggestions ?? []).map(s => `- [${s.priority}] ${s.text}`).join("\n")}

## Instructions
Return JSON matching the schema for this score band.`;
}
```

**Discriminated union schema:**
```typescript
const SuggestionItemSchema = z.object({
  type: z.enum(["fix", "stretch", "reinforcement"]),
  headline: z.string().min(1).max(80),
  detail: z.string().min(1),
  timestamp_ms: z.number().min(0),
  signal_anchor: z.string().min(1),
});

const LowBandSchema = z.object({
  band: z.literal("low"),
  suggestions: z.array(SuggestionItemSchema.extend({ type: z.literal("fix") })).length(3),
});
const MidBandSchema = z.object({
  band: z.literal("mid"),
  suggestions: z.array(SuggestionItemSchema).length(3)
    .refine(arr => arr.filter(s => s.type === "fix").length === 2, "must have 2 fixes")
    .refine(arr => arr.filter(s => s.type === "reinforcement").length === 1, "must have 1 reinforcement"),
});
const HighBandSchema = z.object({
  band: z.literal("high"),
  suggestions: z.array(SuggestionItemSchema).min(3).max(4)
    .refine(arr => arr.filter(s => s.type === "stretch").length === 1, "must have 1 stretch")
    .refine(arr => arr.filter(s => s.type === "reinforcement").length >= 2, "must have >=2 reinforcements"),
});

export const CounterfactualsResponseSchema = z.discriminatedUnion("band", [
  LowBandSchema, MidBandSchema, HighBandSchema,
]);
```

### Pattern 4: TCP idle timeout for stuck DeepSeek connections (DEFERRED PER D-22)

**What:** Outer wall-clock guard around the fetch promise, plus optional `gtimeout` subprocess wrapper.

**When to use:** ONLY when DeepSeek hang first manifests during 1-video E2E (D-22).

**In-process pattern (preferred if reliable):**
```typescript
// Race the fetch against a wall-clock timeout independent of OpenAI SDK's internal
// AbortController — handles the case where TCP socket is alive but no data is flowing.
const WALL_CLOCK_MS = 120_000; // generous outer bound for deepseek-reasoner

const result = await Promise.race([
  ai.chat.completions.create({ ... }, { signal: controller.signal }),
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("DeepSeek wall-clock timeout exceeded")), WALL_CLOCK_MS)
  ),
]);
```

**Subprocess pattern (if in-process unreliable):**
```typescript
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);

// Wrap the DeepSeek call site in a child Node process killed externally by gtimeout
// (verified at /opt/homebrew/bin/gtimeout — GNU coreutils). When the in-process race
// can't kill the underlying TCP socket, the subprocess's SIGKILL will.
const { stdout } = await exec("gtimeout", ["-k", "10", "120", "node", "scripts/deepseek-call.mjs"]);
```

WebSearch (May 2026) note: `AbortSignal.any()` has known reliability issues — at least one combined signal may not fire (nodejs/node#57736). The Promise.race pattern above is more reliable than relying on `AbortSignal.any([abortSignal, AbortSignal.timeout(ms)])`.

### Anti-Patterns to Avoid

- **Modifying engine code paths during the 10-video cadence.** Each E2E run must be repeatable. If signal-weight or Stage 11 logic changes mid-cadence, restart the count from video 1. Tag the binary version per run in `validations/video-NN.md`.
- **Skipping the self-test before E2E (D-21).** Half the failure modes are silent — Stage 11 receives "gemini-3.1-pro" but the SDK returns 2.5 output without raising. Self-test fails loudly so you don't waste a video upload.
- **Trusting `response.model` matches request without inspection.** D-10 confirms Google SDK silently substitutes unknown IDs. The self-test MUST assert `response.modelVersion` (the actual model billed) starts with the requested model ID.
- **Removing `result.suggestions[]` array immediately.** It must become internal-only context for Stage 11 (D-06 says: feeds Stage 11 prompt as additional context, never user-visible). Removing it breaks the prompt input.
- **Re-uploading the video per stage.** D-18 explicitly removes this. Three uploads of the same buffer is bandwidth waste + Files API quota burn.
- **Hand-rolling a TikTok metric extractor before WebFetch fails.** D-25 says use Claude WebFetch first; only if blocked, ask the user for a screenshot. Don't pre-build Apify integration.
- **Treating Phase 12 artifacts as ground truth.** Phase 12 was text-mode-only with DeepSeek disabled. Its results are not predictive of real video performance. D-29 archives the artifacts but explicitly flags `platt_parameters` as "text-mode-trained, video-mode re-train pending."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Video upload to Gemini | Custom multipart upload | `ai.files.upload({ file: blob, config: { mimeType } })` | Existing pattern at 3 call sites; handles polling state machine |
| Polling for ACTIVE state | Naive `setTimeout` loop without timeout | Existing pattern at `gemini.ts:527-541` (poll + `VIDEO_POLL_TIMEOUT_MS` wall clock) | Files can stick in PROCESSING; need bounded wait |
| LLM response schema validation | Custom JSON parsers | Zod `.safeParse()` + existing `CounterfactualsResponseSchema` pattern | Existing pattern — Zod boundaries already used everywhere |
| Per-model cost calculation | Hardcoded rates inline | `calculateCost(model, usageMetadata)` from `gemini/cost.ts` | Already exists with per-model PRICING table; just needs `-preview` suffix dropped per D-09 |
| Cache key composition | Custom hashing | `cacheKey(contentHash, userId)` from `prediction-cache.ts` | Already keys on `ENGINE_VERSION` — D-23 verification, not rebuild |
| Circuit-breaker logic | Custom retry counter | `isCircuitOpen()` + `recordSuccess()`/`recordFailure()` from `deepseek.ts:741` | Existing pattern across DeepSeek call sites |
| Stage event emission | Custom telemetry | `emitStageStart` / `emitStageEnd` from `events.ts` | SSE consumer in route.ts already wired |
| Test fixtures for PredictionResult | Hand-built objects | `__tests__/factories.ts` | Existing factory pattern across all engine tests |
| TikTok URL post-publish metric extraction | Custom scraper | Claude WebFetch per D-25 | Manual pattern at 10-video scale; iterate per-video |
| `gtimeout` equivalent for deferred D-22 hang mitigation | Custom signal handler | `gtimeout` from `/opt/homebrew/bin/gtimeout` OR `Promise.race` with setTimeout | Both exist; pick the simpler one when hang first manifests |

**Key insight:** Phase 13 is overwhelmingly a *removal/verification* phase, not a build-from-scratch phase. Most of the work is: (a) configuration constant changes (D-09, D-16, D-19, D-27), (b) one full rewrite (Stage 11 — D-01..D-05), (c) two doc artifacts (caption-less audit + code review), (d) manual E2E iteration (10 videos). Resist the urge to introduce new libraries.

## Runtime State Inventory

> Phase 13 is part rebuild, part config-flip — but ENGINE_VERSION flip from `3.0.0-dev` to `3.0.0` IS a state-bearing operation. Inventory required.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | `analysis_results` Supabase table — `engine_version` column tags each prediction. Flipping ENGINE_VERSION means new predictions get `engine_version='3.0.0'`; old ones stay `3.0.0-dev`. Cache lookup at `prediction-cache.ts:78` filters by exact `engine_version` match — so version flip auto-invalidates the cache (D-23 verified). [VERIFIED: prediction-cache.ts:78] | No data migration. Verify `engine_version` column is the EXACT primary key component (it is — verified at `prediction-cache.ts:78`). No backfill needed; old rows stay queryable for historical analysis. |
| **Live service config** | `trending_sounds` Supabase table population (D-32). Audio signal weight bumps 0.07 → 0.10 — needs verification that the table has ≥N rows with non-null embedding vectors. [VERIFIED: trends.ts:51 reads from "trending_sounds" table] | Run a SELECT COUNT against `trending_sounds` before the 10-video cadence. If <50 rows or all NULL embeddings, the weight bump produces noise — flag for plan task. |
| **OS-registered state** | None. No cron jobs, no Task Scheduler, no pm2 processes registered against this engine. (`cron/scrape-trending` and `cron/calibration-audit` exist as Vercel cron routes, but they don't embed `ENGINE_VERSION` in their config.) | None. |
| **Secrets/env vars** | `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `GEMINI_HOOK_MODEL`, `GEMINI_BODY_MODEL`, `GEMINI_CTA_MODEL`, `GEMINI_WAVE0_MODEL`, `GEMINI_STAGE11_MODEL` (new for D-08 Stage 11 slot), `DEEPSEEK_COUNTERFACTUALS_MODEL` (becomes obsolete after D-01 since Stage 11 migrates to Gemini), `DEEPSEEK_NICHE_MODEL` (becomes obsolete after D-17 fold). Vercel env panel + `.env.local` for dev. [VERIFIED: grep across engine modules] | (a) Add `GEMINI_STAGE11_MODEL=gemini-3.1-pro` to Vercel env. (b) After D-09, remove `-preview` suffix from existing env vars OR re-default in code (CONTEXT D-09 says drop the suffix from model IDs — implies code-side default, no env change needed if env unset). (c) Document deprecated `DEEPSEEK_COUNTERFACTUALS_MODEL` and `DEEPSEEK_NICHE_MODEL` in a code comment so future readers know they're no-ops. |
| **Build artifacts / installed packages** | `.next/` cache for dev server (CLAUDE.md notes Tailwind v4 + Lightning CSS quirks). Pre-existing `1191 tests` per D-24 — many will fail after caption demotion + signal weight changes. | (a) `npm run build` before merge to ensure no TS errors. (b) Plan 1 includes mass test update per D-24 — not casual cleanup. (c) After D-17 fold, `wave0/niche-detector.ts` can be deleted; `__tests__/` tests of that file must be deleted alongside. |

**The canonical question (per RESEARCH protocol):** *After every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered?*

Answer: The `prediction-cache` L1 in-memory cache holds entries keyed on `3.0.0-dev` after the version flip — but L1 is process-local and dies on next Vercel deploy. The L2 Supabase cache automatically filters out non-matching `engine_version`. No cross-process state survives the flip.

## Common Pitfalls

### Pitfall 1: Silent model fallback (Gemini SDK substitutes unknown IDs)
**What goes wrong:** Code requests `gemini-3.1-pro` (preview-suffix dropped per D-09); SDK silently routes to `gemini-2.5-flash` because the ID variant isn't registered.
**Why it happens:** `@google/genai` SDK doesn't throw on unknown model IDs in some configurations. The cost-calc shim at `gemini.ts:185` pins `GEMINI_MODEL=gemini-2.5-flash` for cost calculation, which masks the fallback in telemetry.
**How to avoid:** Self-test (D-21) asserts `response.modelVersion?.startsWith(requestedModel)`. Fail loudly on mismatch.
**Warning signs:** Cost telemetry suddenly reads "gemini-2.5-flash" for a slot that should be Pro; analysis quality regresses without obvious cause; response shape diverges from schema (Flash returns different field structures than Pro).
**Source:** D-10 CONTEXT direct user observation + [VERIFIED: WebSearch May 2026 — `gemini-3-pro-preview` was deprecated on March 9, 2026, migration to `gemini-3.1-pro-preview` recommended] [CITED: cloud.google.com/blog/products/ai-machine-learning/gemini-3-1-pro-on-gemini-cli-gemini-enterprise-and-vertex-ai]

### Pitfall 2: `-preview` suffix drop assumption may be premature
**What goes wrong:** D-09 says drop `-preview` from all model IDs because "all listed models are GA as of 2026-05". WebSearch (May 2026) confirms Gemini 3.1 Flash-Lite is in PREVIEW (not GA); Gemini 3 Flash is "Pre-GA with limited support"; Gemini 3.1 Pro is in PREVIEW.
**Why it happens:** Knowledge cutoff May 2026 vs. actual model availability is fluid. CONTEXT was written 2026-05-22; WebSearch this session (also 2026-05-22) shows the models are still preview.
**How to avoid:** Run the self-test (D-21) with BOTH model ID forms — bare (`gemini-3.1-pro`) AND preview-suffixed (`gemini-3.1-pro-preview`). Whichever returns `response.modelVersion === requested` for ALL slots is the form to lock in. If bare IDs fail, keep the `-preview` suffix and update D-09 in a CONTEXT amendment.
**Warning signs:** Self-test exit code 1 on slot probes; "model not found" errors at runtime.
**Source:** [VERIFIED: WebSearch May 2026, multiple sources] [CITED: docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-1-pro] [CITED: ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite] — **flagged as ASSUMPTION A1 in Assumptions Log**

### Pitfall 3: Stage 11 prompt grows beyond context window
**What goes wrong:** D-03 packs full signal context + untruncated DeepSeek reasoning + video into the prompt. DeepSeek reasoning at `deepseek-reasoner` can exceed 4000 tokens of CoT. Gemini 3.1 Pro 2M context window is generous, but cost scales with input tokens (~$2/M input).
**Why it happens:** DeepSeek's `<think>` tokens are billed and counted as input by downstream Gemini call.
**How to avoid:** Verify per-video cost stays under $0.40 (D-20). Monitor `cost_cents` in stage events. If hitting cap, consider summarizing DeepSeek reasoning to ~2000 tokens before injecting (Claude's Discretion if needed).
**Warning signs:** Stage 11 cost exceeding $0.20/call; cost cap warnings in pipeline `cost_cents` telemetry.

### Pitfall 4: `result.suggestions[]` array becomes dual-purpose and confusing
**What goes wrong:** D-06 makes `result.suggestions[]` "internal-only" feeding Stage 11, but the type is still exposed in `PredictionResult`. New consumers may accidentally use it as user-facing.
**Why it happens:** Type system can't enforce "internal-only" without renaming or moving the field.
**How to avoid:** Rename `result.suggestions` → `result.internal_suggestions` (TypeScript-side); add a JSDoc `@internal` tag; remove SuggestionsSection's direct read (already happens via D-06 rewire).
**Warning signs:** Future PR uses `result.suggestions` in UI; ts-prune doesn't flag the field as unused.

### Pitfall 5: Caption-less audit misses non-obvious caption reads
**What goes wrong:** D-13 audit must catch every stage that reads `payload.content_text`. Some reads are buried (e.g., `pipeline.ts:596` for rules scoring; `trends.ts:45,101` for hashtag extraction; `wave3/persona-prompts.ts:83` and `wave4/platform-fit-prompts.ts:133` building user messages).
**Why it happens:** `content_text` is a popular field name; grep alone isn't enough — must also catch `payload.caption`, destructured assignments, and prompt-builder helpers.
**How to avoid:** Audit script using BOTH `grep` AND `tsc` "find references" against the `ContentPayload.content_text` field. Confirmed sites from this research:
- `deepseek.ts:467` — `${context.input.content_text}` in user message
- `gemini.ts:235` — text prompt user message
- `normalize.ts:43,46` — `contentText = input.content_text ?? ""` (the entry point)
- `pipeline.ts:596` — `scoreContentAgainstRules(payload.content_text, rules)` (rules scoring)
- `retrieval/retrieval-stage.ts:123` — `caption: payload.content_text ?? null`
- `trends.ts:45,101` — content lowercasing + hashtag regex extraction
- `wave0/prompts.ts:60` — niche-detector user message
- `wave3/persona-prompts.ts:83` — persona simulation prompt
- `wave4/platform-fit-prompts.ts:133` — `Caption: ${payload.content_text || "(no caption)"}`
[VERIFIED: grep across `/src/lib/engine/`]
**Warning signs:** Test failures in a stage you didn't audit; engine returns empty for that stage on caption-less input.

### Pitfall 6: DeepSeek hang in `deepseek-reasoner` not reproducible on demand
**What goes wrong:** D-22 defers mitigation to first manifestation, but the hang is probabilistic — TCP idle on the SSE upstream. Can't artificially reproduce without network mock.
**Why it happens:** `deepseek-reasoner` produces long CoT bursts (`<think>` tokens); intermediate quiet periods can exceed OS keepalive intervals; some intermediate TCP proxy may close the socket idle-side without notifying the client.
**How to avoid:** When the hang fires, capture the exact symptoms in `validations/video-NN.md` (which video, what stage timing showed stuck, what error eventually surfaced). Then pick implementation form (in-process Promise.race vs. gtimeout subprocess) based on whether the in-process AbortController is signaling correctly. Existing `TIMEOUT_MS=90_000` at `deepseek.ts:21` is the current bound.
**Warning signs:** Stage event emits `stage_start` but never `stage_end`; SSE stream stops at Wave 2; user-facing UI hangs at "Step 5 of 13".
**Source:** [VERIFIED: WebSearch May 2026 — multiple sources on AbortSignal reliability] [CITED: github.com/nodejs/node#57736 — AbortSignal.any() reliability issue] [CITED: medium.com/@bhagyarana80/node-timeouts-12-gaps-that-bite-hard]

### Pitfall 7: Files API 48h TTL on `fileUri` reuse
**What goes wrong:** D-01 reuses Wave 1's `fileUri` for Stage 11. Files API has a 48h TTL. Within a single pipeline invocation (~30s end-to-end), this is a non-issue. But if Stage 11 ever runs separately or async (re-analysis without re-upload), the URI may be expired.
**Why it happens:** Google Files API auto-deletes uploaded files after 48h.
**How to avoid:** Document the invariant: `fileUri` lifetime = single pipeline invocation. Outer `try { ... } finally { delete }` in `pipeline.ts` ensures cleanup even on stage failure. Don't persist `fileUri` to DB.
**Warning signs:** "File not found" 404 from Gemini on Stage 11 generateContent.

### Pitfall 8: Tests assert specific suggestion shapes that change in D-05
**What goes wrong:** Existing `stage11-counterfactuals.test.ts` enforces `exactly 3 suggestions` (the old schema). D-05 changes this to band-adaptive (3 for low, 3 for mid, 3-4 for high). All assertions break.
**Why it happens:** The Zod schema rebuild per D-05 is a breaking type change.
**How to avoid:** D-24 explicitly calls out this risk. Plan task: rewrite `stage11-counterfactuals.test.ts` from scratch for new schema. Mock the Gemini API response per band (factory pattern from `__tests__/factories.ts`).
**Warning signs:** `npm test` reports failures in stage11-counterfactuals, aggregator (which calls stage11), pipeline (integration), and any test that constructs a fake `CounterfactualResult`.

### Pitfall 9: Lifting upload cap to 287MB exposes Vercel function memory limits
**What goes wrong:** D-19 raises `VIDEO_MAX_SIZE_BYTES` 50MB → 287MB. Vercel Fluid Compute Node functions have a memory limit (default 1024MB on Pro, 3008MB max). A 287MB Buffer + `new Blob([new Uint8Array(buffer)])` allocates ~574MB peak before upload completes.
**Why it happens:** `Buffer.from(await videoBlob.arrayBuffer())` allocates the full buffer in memory. Wrapping in `new Blob([new Uint8Array(buffer)])` copies again.
**How to avoid:** Stream the upload — but `@google/genai` SDK may not support streaming. Alternative: ensure Vercel function memory is provisioned at 2048MB or 3008MB for the analyze route. Check current `vercel.json` or function config.
**Warning signs:** OOM errors on uploads >100MB; Vercel function logs show "JavaScript heap out of memory".

### Pitfall 10: Pre-emptive `niche-detector.ts` deletion breaks tests + imports
**What goes wrong:** D-17 says `wave0/niche-detector.ts` "can be deleted" after the fold. Imports from `wave0.ts` orchestrator still reference `detectNiche`. Tests in `__tests__/` reference the module.
**Why it happens:** Removal must be sequenced AFTER the fold migration is verified.
**How to avoid:** Plan task ordering: (1) extend `content-type-detector.ts` schema with niche fields, (2) migrate `wave0.ts` to read niche from extended response, (3) verify tests pass, (4) THEN delete `niche-detector.ts` + its tests. Don't conflate (1) and (4) into a single task.
**Warning signs:** TypeScript "Cannot find module" errors; test imports failing.

## Code Examples

Verified patterns from the codebase:

### Example 1: `fileUri` upload + poll-to-ACTIVE + cleanup
```typescript
// Source: src/lib/engine/gemini/segmented.ts:97-249
const ai = getClient();
let uploadedFileName: string | undefined;
try {
  const blob = new Blob([new Uint8Array(videoBuffer)], { type: mimeType });
  const uploadResult = await ai.files.upload({ file: blob, config: { mimeType } });
  if (!uploadResult.name) throw new Error("Video upload failed");
  uploadedFileName = uploadResult.name;

  let fileState = uploadResult.state;
  let fileUri = uploadResult.uri;
  const pollStart = Date.now();
  while (fileState === "PROCESSING") {
    if (Date.now() - pollStart > VIDEO_POLL_TIMEOUT_MS) throw new Error("Upload timeout");
    await new Promise((r) => setTimeout(r, VIDEO_POLL_INTERVAL_MS));
    const info = await ai.files.get({ name: uploadedFileName });
    fileState = info.state;
    fileUri = info.uri;
  }
  if (fileState !== "ACTIVE" || !fileUri) throw new Error(`Unexpected state ${fileState}`);

  // ... use fileUri in generateContent calls ...

} finally {
  if (uploadedFileName) {
    try { await ai.files.delete({ name: uploadedFileName }); } catch {}
  }
}
```

### Example 2: Cache key with `ENGINE_VERSION` component (D-23 verification)
```typescript
// Source: src/lib/engine/cache/prediction-cache.ts:20-22 + :73-82
export function cacheKey(contentHash: string, userId: string): string {
  return `${contentHash}::${ENGINE_VERSION}::${userId}`;
}

// L2 Supabase lookup filters by exact ENGINE_VERSION match:
const { data } = await supabase
  .from("analysis_results")
  .select("*")
  .eq("user_id", userId)
  .eq("content_hash", contentHash)
  .eq("engine_version", ENGINE_VERSION)  // <-- auto-invalidates on version flip
  .gt("created_at", cutoff)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();
```
**D-23 verification:** Cache layer DOES correctly invalidate on `ENGINE_VERSION` flip. No additional invalidation logic needed. Plan task = read-only verification + comment annotation.

### Example 3: Existing Zod boundary validation pattern
```typescript
// Source: src/lib/engine/stage11-counterfactuals-prompts.ts:82-92 (current schema, will be replaced)
export const CounterfactualsResponseSchema = z.object({
  suggestions: z.array(
    z.object({
      change: z.string().min(1),
      timestamp_ms: z.number().min(0),
      expected_impact: z.string().min(1),
    }),
  ).length(3),
});
```

### Example 4: `gemini/cost.ts` PRICING table (D-09 target)
```typescript
// Source: src/lib/engine/gemini/cost.ts:21-27 — CURRENT state
const PRICING: Record<string, { input: number; output: number }> = {
  "gemini-3.1-pro-preview":  { input: 2.00 / 1_000_000,  output: 12.00 / 1_000_000 },
  "gemini-3-pro-preview":    { input: 2.00 / 1_000_000,  output: 12.00 / 1_000_000 },
  "gemini-3-flash-preview":  { input: 0.50 / 1_000_000,  output:  3.00 / 1_000_000 },
  "gemini-3.1-flash-lite":   { input: 0.25 / 1_000_000,  output:  1.50 / 1_000_000 },
  "gemini-2.5-flash":        { input: 0.15 / 1_000_000,  output:  0.60 / 1_000_000 },
};

// After D-09: add bare aliases pointing to same rates
// "gemini-3.1-pro": { input: 2.00/1M, output: 12.00/1M },
// "gemini-3-flash": { input: 0.50/1M, output: 3.00/1M },
// Keep -preview entries as backwards-compat for now (don't delete).
```

### Example 5: Existing factory pattern for test PredictionResult
```typescript
// Source: src/lib/engine/__tests__/factories.ts (exists per grep)
// Pattern: makePredictionResult(overrides) returns a complete PredictionResult with sane defaults
// Plan task can extend with makeCounterfactualResult(band, suggestions) for D-05 schema
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 12 text-mode benchmark as acceptance gate | Phase 13 10-video real E2E as acceptance gate | 2026-05-22 (CONTEXT D-29) | Phase 12 artifacts archived as superseded |
| Stage 11 = DeepSeek V4 Flash, skip on score≥70 | Stage 11 = Gemini 3.1 Pro, always runs, video-grounded, adaptive per band | 2026-05-22 (CONTEXT D-01..D-06) | Existing test suite needs rewrite (D-24) |
| `gemini-3.1-pro-preview` env-var default | `gemini-3.1-pro` (drop `-preview`) | 2026-05-22 (CONTEXT D-09) | Self-test required (D-21) — see Pitfall 2 |
| Caption as primary signal | Caption demoted to non-signal; video bytes only | 2026-05-22 (CONTEXT D-11) | All 17 rules disabled, retrieval disabled |
| 50MB video upload cap | 287MB cap | 2026-05-22 (CONTEXT D-19) | Watch Vercel function memory (Pitfall 9) |
| 3 separate Gemini Files API uploads per analysis | 1 upload, shared `fileUri` | 2026-05-22 (CONTEXT D-18) | Saves bandwidth + Files API quota |
| Apify for post-publish metric fetching | Claude WebFetch | 2026-05-22 (CONTEXT D-25) | Simpler at 10-video scale |

**Deprecated/outdated:**
- `gemini-3-pro-preview` — deprecated by Google March 9, 2026; migration to `gemini-3.1-pro-preview` recommended [CITED: cloud.google.com/blog/products/ai-machine-learning/gemini-3-1-pro-on-gemini-cli-gemini-enterprise-and-vertex-ai]
- `wave0/niche-detector.ts` — deletable after D-17 fold (sequence: extend content-type-detector schema → migrate wave0.ts → delete niche-detector.ts + tests)
- `DEEPSEEK_COUNTERFACTUALS_MODEL` env var — obsolete after D-01 Stage 11 migrates to Gemini
- `DEEPSEEK_NICHE_MODEL` env var — obsolete after D-17 fold

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | All scripts + Next.js | ✓ | 25.2.1 | — |
| npm | Package install + test runs | ✓ | 11.6.2 | — |
| `gtimeout` (GNU coreutils) | DEFERRED D-22 hang kill subprocess | ✓ | `/opt/homebrew/bin/gtimeout` | `Promise.race` with setTimeout (in-process) |
| `timeout` (BSD fallback) | Same as gtimeout | ✓ | `/usr/bin/timeout` (likely macOS BSD variant) | gtimeout preferred |
| `GEMINI_API_KEY` env var | Self-test, pipeline | Must be set in `.env.local` for dev + Vercel env for prod | — | None — required |
| `DEEPSEEK_API_KEY` env var | Wave 2 reasoning, Wave 3/4 personas | Must be set | — | Existing `reasonWithGeminiFallback` at `deepseek.ts:660` |
| Supabase project + service role key | Cache lookup, profile reads, analysis_results writes, trending_sounds reads | Must be set | — | None — required |
| Playwright browsers | E2E tests (existing `e2e/` config) | Likely cached; `npx playwright install` if missing | — | None — required if running e2e suite |
| Vercel CLI (`vercel`) | Preview deploy for E2E (optional) | Unknown — needs check | — | Local `npm run dev` for E2E |
| Real TikTok video files | D-25 cadence | User-provided per CONTEXT D-26 | — | None — user is the gate |

**Missing dependencies with no fallback:** None for Phase 13 execution. All required tools and env vars are within the user's control.

**Missing dependencies with fallback:** `gtimeout` is available, but Phase 13 doesn't NEED it pre-flight (D-22 defers); in-process Promise.race is the default if mitigation ever ships.

## Validation Architecture

> Workflow `nyquist_validation` is enabled in `.planning/config.json`. Section included per protocol.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 (unit + integration) + Playwright 1.58.0 (E2E) |
| Config file | `vitest.config.ts` (root) — `e2e/playwright.config.ts`, `extraction/playwright.config.ts` |
| Quick run command | `npm test` (Vitest, runs all 77 test files) |
| Full suite command | `npm test && npm run e2e` (Vitest + Playwright E2E) |

### Phase Requirements → Test Map

| Req ID (from ROADMAP SC) | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC#1 (Gemini model audit) | Every Gemini slot returns `response.modelVersion?.startsWith(requested)` | live-API smoke (one-off script) | `npx tsx scripts/engine-self-test.ts` | ❌ Wave 0 (script doesn't exist — Plan 1 builds it) |
| SC#2 (Stage 11 rebuild) | `runStage11Counterfactuals` always returns non-null; adaptive shape per band; Zod schema validates | unit | `npx vitest src/lib/engine/__tests__/stage11-counterfactuals.test.ts` | ✅ exists but needs full rewrite (D-24 — mass test update) |
| SC#2 (Stage 11 prompt context) | Prompt builder receives full signal context (no 500-char truncation, all factors present) | unit | `npx vitest src/lib/engine/__tests__/stage11-counterfactuals.test.ts -t "prompt context"` | ❌ Wave 0 (new test) |
| SC#3 (Stage 11 UI wiring) | `SuggestionsSection` renders `result.counterfactuals.suggestions`; band-specific section header | unit (React Testing Library) | `npx vitest src/components/app/simulation/__tests__/insights-section.test.tsx` | ❌ Wave 0 (component test new — currently only `__tests__/` dir exists, no insights-section test) |
| SC#3 (chip three-state) | `SignalAvailabilityChips` renders ✓/✕/⚠ per state | unit | `npx vitest src/components/app/simulation/__tests__/signal-availability-chips.test.tsx` | ❌ Wave 0 |
| SC#4 (E2E smoke 1→5→10) | Real TikTok video upload → /api/analyze → result render | manual + Playwright | `npm run e2e -- analyze-real-video.spec.ts` AND manual upload via UI per D-25 | ❌ Wave 0 (Playwright spec optional; manual cadence is required) |
| SC#4 (signal completeness checklist) | Every wave produces non-degraded output per video | manual diff vs `validations/video-NN.md` | none (manual) | ❌ Wave 0 (template doc) |
| SC#5 (cross-phase code review) | Phases 9-12 wave wiring, signal fallback paths, no silent degradations | manual review artifact | none (manual) | ❌ Wave 0 (artifact: `13-CODE-REVIEW-PHASES-9-12.md`) |
| SC#6 (DeepSeek hang mitigation) | DEFERRED per D-22. When fires, deterministic kill within wall-clock budget | integration with mock slow server | TBD when manifests | ❌ Deferred |
| SC#7 (ENGINE_VERSION flip) | `src/lib/engine/version.ts` exports `"3.0.0"`; 1191 tests pass | unit | `npx vitest src/lib/engine/__tests__/version.test.ts && npm test` | ✅ `version.test.ts` exists |
| SC#8 (milestone merge) | `milestone/engine-foundation` merges cleanly to `main` per worktree merge protocol | manual git | `git merge --no-ff` (per `~/.claude/rules/gsd-worktree.md`) | — (process, not test) |
| D-13 (caption-less audit) | Every stage that reads `payload.content_text` documented with fix/accept/disable verdict | manual artifact | none (manual) | ❌ Wave 0 (artifact: `13-AUDIT-CAPTION-LESS.md`) |
| D-23 (cache invalidation) | Cache lookup with new ENGINE_VERSION returns null on old entries | unit | `npx vitest src/lib/engine/cache/__tests__/prediction-cache.test.ts -t "version invalidation"` | ❌ Wave 0 (new test — current `prediction-cache.test.ts` may not cover) |
| D-24 (mass test update) | All 1191+ tests pass after caption demotion + signal weight changes | unit | `npm test` | ✅ infra exists; bulk updates needed |
| D-32 (trending_sounds population) | `SELECT count(*) FROM trending_sounds WHERE embedding IS NOT NULL` returns ≥50 | manual DB query | `npx supabase db query "SELECT count(*) FROM trending_sounds WHERE embedding IS NOT NULL"` | — (manual probe) |

### Sampling Rate
- **Per task commit:** `npx vitest run <affected-test-file>` — fast subset
- **Per wave merge:** `npm test` (full Vitest run, ~30-60s)
- **Phase gate (before E2E start):** `npm test && npm run build` green
- **Per E2E video:** manual upload + diff written to `validations/video-NN.md`
- **Phase gate (before merge):** all 10 videos pass + user sign-off (D-28)

### Wave 0 Gaps
- [ ] `scripts/engine-self-test.ts` — covers SC#1; gates all subsequent waves per D-21
- [ ] `.planning/phases/13-.../13-AUDIT-CAPTION-LESS.md` — covers D-13; gates Stage 11 rebuild + signal-weight changes
- [ ] `.planning/phases/13-.../13-CODE-REVIEW-PHASES-9-12.md` — covers SC#5
- [ ] `.planning/phases/13-.../validations/video-01.md` ... `video-10.md` — covers SC#4 + D-25
- [ ] `src/lib/engine/__tests__/stage11-counterfactuals.test.ts` — REWRITE for new schema (D-05) + always-on contract (D-04)
- [ ] `src/components/app/simulation/__tests__/insights-section.test.tsx` — covers SC#3 (rebuilt SuggestionsSection)
- [ ] `src/components/app/simulation/__tests__/signal-availability-chips.test.tsx` — covers D-30 three-state
- [ ] `src/lib/engine/cache/__tests__/prediction-cache.test.ts` — covers D-23 (may exist; verify version-invalidation case is covered)
- [ ] Framework install: none — Vitest + Playwright already installed [VERIFIED: package.json]

*(All Wave 0 gaps are required by ROADMAP success criteria or CONTEXT decisions — none are nice-to-haves.)*

## Architectural Notes for Plan Sequencing

The planner should respect the following dependency chain when ordering plans/tasks:

1. **Plan 01 (foundational hardening — gates everything else):**
   - `engine-self-test.ts` build + run (D-21) — MUST pass before any E2E
   - `13-AUDIT-CAPTION-LESS.md` audit (D-13) — produces the fix-or-document verdict per stage; informs Plan 02 scope
   - Drop `-preview` suffix (D-09) — but only AFTER self-test confirms bare IDs are callable (Pitfall 2)
   - Investigate + fix silent-fallback bug (D-10) — code change in `gemini.ts:185` + `gemini/cost.ts:50-52`
   - Add `GEMINI_STAGE11_MODEL` env var (CONTEXT D-08)
   - DB probe: trending_sounds population (D-32)
   - Cache invalidation verification (D-23)
   - 1191-test audit — categorize failures (D-24)

2. **Plan 02 (Stage 11 rebuild + signal-weight reality):**
   - SCORE_WEIGHTS update (D-16) at `aggregator.ts:53`
   - Stage 11 full rewrite (D-01..D-05) at `stage11-counterfactuals.ts` + `stage11-counterfactuals-prompts.ts`
   - Adaptive Zod discriminated-union schema
   - Test rewrite for new schema (D-24 partial — Stage 11 tests specifically)
   - UI rewire: `results-panel.tsx:207` + `insights-section.tsx` rebuild per `13-UI-SPEC.md`
   - Chip three-state at `signal-availability-chips.tsx` (D-30)

3. **Plan 03 (pipeline cleanup + optimization):**
   - Shared `fileUri` (D-18) — refactor pipeline.ts upload to entry; thread through stages
   - Wave 0 niche fold (D-17) — extend `content-type-detector.ts` schema, migrate `wave0.ts`, delete `niche-detector.ts` after verification
   - Upload cap 287MB (D-19) at `gemini.ts:40` + `gemini/segmented.ts:43`
   - Mass test update completion (D-24 remainder)

4. **Plan 04 (cross-phase code review — read-only artifact):**
   - Manual review of phases 9, 10, 11, 12 source files for: wave wiring correctness, signal fallback paths, silent degradations
   - Output: `13-CODE-REVIEW-PHASES-9-12.md`
   - Any bugs found surface as fix tasks in Plan 04 or get deferred to a "post-review" plan

5. **Plan 05 (1-video E2E + iterate):**
   - 1 real TikTok video upload through UI
   - Diff report `validations/video-01.md`
   - Fix any blockers; if DeepSeek hang fires here, implement D-22 mitigation NOW
   - Phase 13 D-31 `tiktok_url` flow exercises one of the 10 videos

6. **Plan 06 (5-video cadence):**
   - Videos 2-5 in stratified order per D-26
   - One must be `tiktok_url` mode per D-31

7. **Plan 07 (10-video cadence):**
   - Videos 6-10
   - Final summary report

8. **Plan 08 (version flip + merge):**
   - `ENGINE_VERSION` 1-line flip at `version.ts:6` (D-27)
   - `npm test && npm run build` green
   - User sign-off (D-28)
   - Worktree merge per `~/.claude/rules/gsd-worktree.md` merge protocol

**Critical sequencing invariants:**
- Plan 01 self-test BLOCKS Plan 02 (no point rebuilding Stage 11 if models don't resolve)
- Plan 01 AUDIT-CAPTION-LESS BLOCKS Plan 02 signal-weight changes (must know all caption reads before disabling rules+retrieval)
- Plans 02 + 03 can partially overlap, but D-24 test update requires both schema changes (Plan 02) + cleanup (Plan 03) before tests can pass
- Plan 04 code review can run IN PARALLEL with Plan 02/03 (read-only)
- Plans 05/06/07 MUST be sequential (1-video, then 5, then 10) — D-25 cadence
- Plan 08 BLOCKED on all 10 videos passing (D-27)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Dropping `-preview` from model IDs (D-09) will work at runtime — i.e. bare `gemini-3.1-pro` resolves | Pitfall 2; Standard Stack | If preview-suffixed IDs are still required, self-test will fail and Plan 01 must amend CONTEXT D-09 to keep `-preview`. Stage 11 + Wave 1 broken until fixed. WebSearch (May 2026) suggests preview suffix may still be required for 3.x models. |
| A2 | `Buffer.from(await blob.arrayBuffer())` + `new Blob([new Uint8Array(buffer)])` at 287MB fits within Vercel function memory at default config | Pitfall 9 | OOM at runtime on real >100MB videos. Mitigation: provision Vercel function memory ≥2048MB or stream upload. |
| A3 | `result.modelVersion` is the correct SDK field to assert model match in `@google/genai` v? | Pattern 1 self-test | If the field is named differently (e.g. `usageMetadata.modelVersion` or buried under `responseMetadata`), self-test assertion will always fail. Verify against SDK docs at implementation time. |
| A4 | `gtimeout` will reliably kill the Node subprocess holding a DeepSeek TCP socket | Pitfall 6; Pattern 4 | If subprocess kill leaks zombie sockets, the pattern doesn't work. Mitigation: SIGKILL after grace period (`gtimeout -k 10 120`). |
| A5 | DeepSeek `reasonWithGeminiFallback` at `deepseek.ts:660` correctly handles caption-less input | Caption demotion sweep | If fallback also reads caption, the engine has no working reasoning path when caption is empty. Plan 01 audit must inspect this fallback path. |
| A6 | Existing `__tests__/factories.ts` factory can be extended to produce band-adaptive `CounterfactualResult` fixtures | Stage 11 test rewrite | If the factory's design doesn't support discriminated unions cleanly, more rewrite scope. Risk minor — extension should be straightforward. |
| A7 | 1191-test count is current (per D-24 CONTEXT note) — actual count may differ | D-24 mass test update | If actual count is significantly higher, test update scope is larger; if lower, smaller. Plan 01 should `npm test` and capture true count. |
| A8 | `trending_sounds` table has ≥50 non-null embedding rows | D-32 | If sparse, audio weight bump 0.07→0.10 produces noise rather than signal. Mitigation: re-tune weight back to 0.07 OR populate trending_sounds via existing `scripts/backfill-trending-sound-embeddings.ts` before E2E. |
| A9 | Gemini 3.1 Pro 2M context comfortably handles full DeepSeek reasoning + all signal context + video | Pitfall 3 | If context overflows or response quality degrades on huge prompts, must summarize DeepSeek reasoning before injection (Claude's Discretion). Per-video cost monitoring catches this. |
| A10 | Stage 11 prompt can request specific timestamp anchors AND get them back accurately when the video has been viewed | D-03 + UI-SPEC timestamp anchors | If Gemini hallucinates timestamps not actually in the video, UI displays misleading anchors. Mitigation: cross-check against hook_decomposition timestamps when available. |

## Open Questions

1. **`response.modelVersion` field name in `@google/genai` SDK current version.**
   - What we know: The SDK does report which model actually served the response.
   - What's unclear: Exact field path — `response.modelVersion`, `response.model`, `usageMetadata.modelVersion`, or buried elsewhere.
   - Recommendation: Plan 01 self-test does a one-off log of the full response object structure on first run; lock the assertion path from observed output.

2. **Vercel function memory provisioning for 287MB videos.**
   - What we know: Current `maxDuration=300` set at `route.ts:27`; memory not explicitly set in `vercel.json` (needs check).
   - What's unclear: Whether the analyze route is on the Pro plan default 1024MB or upgraded.
   - Recommendation: Plan 03 task — check `vercel.json` or function config; bump memory to ≥2048MB if needed.

3. **Whether Stage 11 prompt should include the video clip (full) or a specific timestamp range.**
   - What we know: D-01 says Stage 11 reuses Wave 1's `fileUri`; D-03 references "hook decomposition (when available)".
   - What's unclear: Should the generateContent call include `videoMetadata: { startOffset, endOffset }` to focus on a specific segment (e.g. hook 0-3s)? Or pass the full video?
   - Recommendation: Default to full video — let Gemini reason across all bands. Use `videoMetadata` only for "focus on hook" reinforcement items where it improves grounding. Plan 02 experiments.

4. **`tiktok_url` mode pipeline coverage (D-31).**
   - What we know: Phase 13 must include ≥1 `tiktok_url` video in the 10-video cadence.
   - What's unclear: Whether `tiktok_url` mode actually downloads the video bytes and runs the same video pipeline, or whether it falls back to metadata-only analysis.
   - Recommendation: Plan 01 audit-caption-less must answer this. If `tiktok_url` mode doesn't get video bytes, the engine is degraded for that mode regardless of caption changes.

5. **How `gemini-3-flash` (D-08 body + CTA) differs from `gemini-3-flash-preview` if/when both exist.**
   - What we know: WebSearch May 2026 confirms `gemini-3-flash` is "Pre-GA with limited support".
   - What's unclear: Whether dropping `-preview` even for body/CTA produces a working call.
   - Recommendation: Self-test (D-21) is the source of truth. Re-run after every Google model release.

## Security Domain

> `security_enforcement` not explicitly disabled in config — section included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing — `createClient()` + `supabase.auth.getUser()` at `route.ts:54-61`. No changes in Phase 13. |
| V3 Session Management | yes | Existing Supabase session cookies. No changes. |
| V4 Access Control | yes | `user_id` scoping on cache lookup at `prediction-cache.ts:76`. Existing pattern; D-23 verification confirms. |
| V5 Input Validation | yes | Existing — `AnalysisInputSchema` Zod at `route.ts:8`; URL/path/content-length validation at `route.ts:65-120`. Phase 13 lifts file size to 287MB (D-19) — Zod schema may need update. |
| V6 Cryptography | no | Phase 13 introduces no new crypto operations. Existing SHA-256 content hashing at `prediction-cache.ts:31` uses Node built-in. |
| V9 Communication | yes | TLS for Gemini + DeepSeek + Supabase already enforced by their SDKs. Phase 13 introduces no new external services. |
| V12 Files & Resources | yes | Phase 13 raises upload cap (D-19) — must keep the existing video MIME-type sniff at `wave0/content-type-detector.ts:120` and path-traversal protection at `route.ts:115-120`. |

### Known Threat Patterns for {Next.js + Supabase + Gemini/DeepSeek}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User uploads malicious MP4 that crashes Gemini parser | Denial of Service | Existing — server-side MIME-type sniff + size cap (now 287MB); Gemini Files API handles parse failures by returning `state=FAILED` |
| User uploads >287MB to exhaust Vercel function memory | Denial of Service | Size-cap check at `gemini.ts:505` rejects before allocation; Pitfall 9 — verify Vercel memory provisioning |
| Cross-tenant cache leak (one user sees another's prediction) | Information Disclosure | Existing — `user_id` filter on L2 cache `.eq("user_id", userId)` at `prediction-cache.ts:76`; ASVS V4 compliant |
| API key exposure via client-side bundle | Information Disclosure | Existing — `GEMINI_API_KEY` / `DEEPSEEK_API_KEY` read in server-only modules (`runtime = "nodejs"` at `route.ts:25`); never imported client-side |
| Prompt injection via uploaded video transcript content | Tampering | Out of scope — Phase 13 doesn't change prompt input handling. Future M2 risk if user-uploaded text re-enters prompts unsanitized. |
| TikTok URL parameter injection (e.g. `tiktok.com/...?javascript:...`) | Injection | Existing — regex validation at `route.ts:105` matches only `tiktok.com/` paths; no JS execution path |
| Model fallback to cheaper/weaker model billed at higher rate | Financial DoS | D-10 + D-21 self-test — assert `response.modelVersion === requested`; fail loudly |

No new security surfaces introduced by Phase 13. All hardening reuses existing patterns.

## Sources

### Primary (HIGH confidence)
- **Codebase grep across `src/lib/engine/`** — verified call sites for `fileUri`, `content_text`, DEEPSEEK_MODEL, ENGINE_VERSION, signal weight references
- **`src/lib/engine/version.ts`** — current `ENGINE_VERSION = "3.0.0-dev"`
- **`src/lib/engine/cache/prediction-cache.ts:20-22, 73-82`** — confirms D-23 cache key includes `ENGINE_VERSION`
- **`src/lib/engine/gemini/cost.ts:21-27`** — current PRICING table state
- **`src/lib/engine/stage11-counterfactuals.ts`** — current Stage 11 (DeepSeek; skip≥70; 3-suggestion schema)
- **`src/lib/engine/gemini/segmented.ts`** — Wave 1 segmented orchestrator (the `fileUri` reuse pattern)
- **`src/lib/engine/aggregator.ts:53-62`** — current SCORE_WEIGHTS
- **`13-CONTEXT.md`** — all D-01..D-32 decisions
- **`13-UI-SPEC.md`** — UI design contract for SuggestionsSection rebuild + chip three-state
- **`13-DISCUSSION-LOG.md`** — alternatives considered behind each decision
- **`.planning/MILESTONE.md`** — milestone identity and stack lock
- **`.planning/ROADMAP.md:303-317`** — Phase 13 definition

### Secondary (MEDIUM confidence — verified via WebSearch May 2026)
- [Gemini 3.1 Pro on Vertex AI](https://cloud.google.com/blog/products/ai-machine-learning/gemini-3-1-pro-on-gemini-cli-gemini-enterprise-and-vertex-ai) — confirms `gemini-3.1-pro-preview` is current ID, GA pending
- [Gemini 3 Flash Vertex AI docs](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-flash) — Pre-GA limited support
- [Gemini 3.1 Flash-Lite docs](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite) — preview availability, $0.25/M input pricing matches `gemini/cost.ts:25`
- [Gemini 3.1 Pro Vertex AI docs](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-1-pro) — global endpoint only, not us-central1/europe-west4
- [Node Timeouts: 12 Gaps That Bite Hard (medium.com)](https://medium.com/@bhagyarana80/node-timeouts-12-gaps-that-bite-hard-2a9d67bdb297) — wall-clock + abort + clearTimeout pattern
- [AbortSignal.any() reliability issue #57736 (github.com/nodejs/node)](https://github.com/nodejs/node/issues/57736) — known broken combined signals; prefer Promise.race
- [Managing Asynchronous Operations in Node.js with AbortController (appsignal.com)](https://blog.appsignal.com/2025/02/12/managing-asynchronous-operations-in-nodejs-with-abortcontroller.html) — current best practice

### Tertiary (LOW confidence — informational only)
- WebSearch returned references to `gemini-3.5-flash` and `gemini-3.5-pro` — Phase 13 doesn't use these per CONTEXT D-08; mentioned only for awareness that the model landscape moved past 3.x.
- Vertex AI `gtimeout` subprocess patterns — verified `gtimeout` exists locally but Phase 13 doesn't ship the mitigation (D-22 defers).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library already in the codebase; no new dependencies introduced
- Architecture: HIGH — pipeline patterns proven across Phases 1-12; Stage 11 rebuild reuses existing Files API + Zod + emit patterns
- Pitfalls: HIGH — pitfalls 1, 4, 5, 7, 8, 10 are codebase-grounded; Pitfalls 2, 3, 6, 9 are MEDIUM (depend on external API + Vercel runtime behavior)
- Model lineup (Gemini IDs): MEDIUM — verified May 2026 via WebSearch but model availability is fluid; A1 in Assumptions Log flags the `-preview` suffix risk

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (30 days for stable architecture; 7 days for Gemini model IDs — re-run self-test (D-21) before E2E if any meaningful gap)

## RESEARCH COMPLETE
