# Phase 3: Decode Frame - Research

**Researched:** 2026-06-02
**Domain:** Lightweight Qwen decode path (Omni structural signal → one Qwen text call) + Decode frame body (4 beats + repeatable/luck lanes) + `variants.remix.decode` persistence/streaming
**Confidence:** HIGH (all findings grounded in this codebase + the Phase 1 spike artifact; no external deps; Qwen-only, zero new packages per milestone constraint)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Teardown renders as **4 stacked labeled beats** in the Decode hero (Verdict's exact right-column bounds): `Hook pattern` / `Structure & pacing` / `The turn` / `Emotional beat`, each 1–2 honest lines. NOT a timeline (duplicates Content Craft filmstrip), NOT a single lead insight.
- **D-02:** **All 4 beat slots always render** (stable layout). A weak/absent beat **names the absence honestly** ("No distinct turn — it rides one continuous bit"), never hides or fabricates. The Qwen decode prompt MUST permit an explicit "absent/weak" verdict per beat.
- **D-03:** Split renders as **two stacked labeled lanes below the beats** (NOT side-by-side): **"What you can repeat"** (bulleted structural moves) then **"What was luck / timing"** (bulleted). Repeatable lane is a **clean extractable list** — Phase 4 Adapt draws concepts from exactly this lane.
- **D-04:** **Luck lane always non-empty** (SC#3 — never collapse everything into "repeatable"). Prompt must surface ≥1 luck factor.
- **D-05:** Luck attribution uses a **fixed taxonomy** the Qwen decode picks from: `timing / trend-moment`, `creator's existing audience / reach`, `algorithmic outlier (unrepeatable spike)`, `topic / zeitgeist`. Only genuinely-applicable categories render. Fixed, not free-form.
- **D-06:** Register is **analytical & declarative** — states what the video does plainly, **no hype, no advice verbs** (fix/improve/should/try). E.g. "The hook front-loads the payoff in the first 0.5s — result before setup."
- **D-07:** Decode stays **neutral / third-person about the source video** ("the hook / this structure / the video"). Second-person "you" is **reserved for Adapt (Phase 4)**. Decode = objective analysis, Adapt = personalization.
- **D-08:** Decode **auto-runs on remix submit** — it IS the headline payoff. Fills the frame as it returns (~60–90s).
- **D-09:** In-flight, the frame shows an **honest streaming state reusing the board's existing pending/streaming treatment** (quiet "Decoding structure…" with subtle motion), **no fabricated content / no fake skeleton-of-content**. Rejected beat-by-beat reveal (Qwen returns one blob) and static dead placeholder.
- **D-10:** Decode output persists to **`variants.remix.decode`** (JSON `variants` column on `analysis_results`). A remix/decode row has **`overall_score = null`**; completion/hydration marker is **`variants.remix != null`** (NOT `overall_score`), per Phase 5 pitfall m3.

### Claude's Discretion
- Exact Qwen decode **prompt schema** and **mapping of Omni fields → 4 beats** (starting hypothesis given; ground in real Omni output — see §Omni-Field Mapping below).
- Whether decode **reuses the Omni output already produced by remix ingestion** or makes its own Omni call (latency/cost optimization — RESOLVED in §Reuse-vs-Refetch below).
- Exact decode copy strings, beat-label final wording, lane-header final wording, TypeScript shape of `variants.remix.decode`.
- Mobile card-stack rendering of beats + lanes (mirror desktop; Phase 2 BoardMobile swap pattern).
- Decode result caching keyed on the existing remix `content_hash` (mode already folded — Phase 2 D-14) via `prediction-cache.ts`.
- All styling per Raycast design language (6% borders, Inter, 12px radius, no glow/tint).

### Deferred Ideas (OUT OF SCOPE)
- Adapt frame content + niche prompt — Phase 4 (consumes Decode repeatable lane).
- Develop & predict + lineage (`parent_id`, "remixed from" chip) — Phase 5.
- Shared-frame behavior in remix mode (what Audience / Content Craft render for an un-scored remix source) — out of scope (Decode in isolation).
- Qwen ASR transcript for hook-line fidelity — gated/deferred (Phase 1 spike §6: Omni speech fidelity sufficient). Revisit only if decode prompt design surfaces a concrete spoken-hook gap.
- Beat-by-beat streamed reveal — deferred (Qwen returns one structured blob).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DECODE-01 | Decode frame renders a structural teardown (hook pattern, pacing/structure, the turn, emotional beat) for a remix-mode video, on its own lightweight Qwen path (NOT the full 332s pipeline). | §Omni-Field → 4-Beat Mapping (real fields confirmed available), §Lightweight Path Architecture (the branch that skips `runPredictionPipeline`), §Decode Output Schema. |
| DECODE-02 | Explicit repeatable-vs-luck split (reproducible structure vs timing/existing-audience/outlier), never frames the video as something to "fix." | §Decode Prompt Design (luck-always-non-empty enforcement, fixed taxonomy, honest-voice system prompt), §Common Pitfalls (luck/beat hallucination, "fix this" framing). |
</phase_requirements>

## Summary

Phase 3 is a **wiring + one-LLM-call** phase, not infrastructure. Every capability is already in the codebase: the Omni structural signal (verified real and differential in the Phase 1 spike), the `variants` JSONB persistence pattern (`variants.craft` is the exact sibling), the SSE/permalink hydration plumbing (`use-analysis-stream` + `usePermalinkAnalysis`), the Qwen text-call pattern (`stage11-counterfactuals.ts` is the exact template), and the Decode frame shell + bounds (Phase 2 `DecodeShellNode` at Verdict's bounds). No new npm dependencies (milestone constraint, verified).

The single most important architectural finding: **a remix submission today still flows through `runPredictionPipeline`** — the `/api/analyze` route has NO remix branch (`grep -c runPredictionPipeline route.ts` = 4, all unconditional). Phase 3's core job is to introduce a **decode branch in the route that diverges BEFORE `runPredictionPipeline` and BEFORE the `usage_tracking` upsert**, runs `resolve → re-host → analyzeVideoWithOmni → one Qwen decode call`, persists `variants.remix.decode`, and streams a `complete` event whose payload carries `{ id, mode:'remix', overall_score:null, variants:{ remix:{ decode } } }`. The Omni call should be made **fresh on the decode path** (reuse is NOT available — the ingestion Omni output is consumed inside the pipeline and discarded; see §Reuse-vs-Refetch). The latency win comes from skipping Waves 1–4 + aggregateScores (Stage 10/11 LLM tail), not from skipping Omni.

The decode prompt is a single Qwen reasoning-model call that consumes the Omni structural fields (`hook_decomposition`, `factors`, `segments`, `video_signals`, `emotion_arc`, `content_summary`, `content_type`/niche) and returns a typed blob: 4 beats (each with an honest absent/weak verdict per D-02), a repeatable lane, and a non-empty luck lane (fixed taxonomy per D-05). The prompt's hardest job is **suppressing two hallucinations** — fabricating a beat that isn't there, and collapsing everything into "repeatable." Both are guarded at the prompt level + a pure-TS post-validation backstop.

**Primary recommendation:** Add `src/lib/engine/remix/decode.ts` (the Qwen call + Zod schema, modeled 1:1 on `stage11-counterfactuals.ts`), branch the `/api/analyze` route on `validated.mode === 'remix'` to run the decode-only path (skip `runPredictionPipeline` + `usage_tracking`), persist via a `persistDecodeToVariants` read-merge-write mirroring `persistCraftToVariants`, stream `complete` with `variants.remix.decode`, and swap `DecodeShellNode`'s body to render 4 beats + 2 lanes (dual-read live `result.variants` / permalink `variants`, mirroring `ContentAnalysisFrame`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Resolve TikTok URL → mp4 → re-host → signed URL | API / Backend (route or engine) | Supabase Storage | IP boundary (derive-and-drop); already lives in `pipeline.ts:530-609` — decode path must replicate or extract this hop |
| Omni structural analysis (`analyzeVideoWithOmni`) | API / Backend (engine) | DashScope (Qwen Omni) | Multimodal; already proven on signed URL; the structural signal source |
| Qwen decode call (4 beats + lanes) | API / Backend (`engine/remix/decode.ts`) | DashScope (Qwen reasoning) | Single LLM hop; mirrors `stage11-counterfactuals.ts`; Qwen-only |
| Decode-path orchestration (skip pipeline, skip usage) | API / Backend (`/api/analyze` route branch) | — | The route owns mode dispatch, persistence, SSE; pitfall C2 lives here |
| `variants.remix.decode` persistence (read-merge-write) | API / Backend (route helper) | Supabase DB | Mirrors `persistCraftToVariants`; additive JSONB, no migration |
| Decode payload streaming (`event: complete`) + permalink hydration | API → Client | `use-analysis-stream` / `usePermalinkAnalysis` | Existing transports; decode reuses `complete` frame + `select('*')` permalink |
| Decode frame body (4 beats + 2 lanes) render | Client (`DecodeShellNode`) | `FrameHero`/`_kit` | DOM overlay node (NOT Konva), narrow column; Raycast styling |
| In-flight "Decoding structure…" state | Client (`DecodeShellNode` + board pending) | `use-analysis-stream` phase | Reuses board pending treatment per D-09 |

## Standard Stack

### Core (all already installed — zero new deps)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `openai` (DashScope compatible-mode) | installed | Qwen client transport (`getQwenClient`) | The pipeline's sole LLM transport; `client.ts` already configures DashScope endpoint + `maxRetries:0` |
| `zod` | installed | Decode output schema + validation | Every engine LLM call validates via Zod (`OmniAnalysisZodSchema`, `CounterfactualsResponseSchema`) |
| `@sentry/nextjs` | installed | Error capture on decode failure | Pattern S7 across all engine stages |
| `node:crypto` | builtin | `content_hash` (mode folded) for decode cache | `prediction-cache.ts` already uses it |

### Supporting (existing modules to reuse, not rebuild)
| Module | Purpose | When to Use |
|--------|---------|-------------|
| `src/lib/engine/qwen/client.ts` | `getQwenClient`, `QWEN_REASONING_MODEL` (`qwen3.6-plus`), `QWEN_SEED` (7) | The decode Qwen call — use the reasoning model + temp 0 + seed |
| `src/lib/engine/qwen/omni-analysis.ts` | `analyzeVideoWithOmni(signedUrl)` → segments + hook_decomposition + factors + emotion_arc + video_signals | The structural-signal source for decode |
| `src/lib/engine/qwen/cost.ts` | `calculateCost(model, usage)` | Cost telemetry on the decode call (pattern parity) |
| `src/lib/engine/utils/strip.ts` | `stripModelOutput` | Clean Qwen JSON before parse (every call does this) |
| `src/lib/scraping/apify-provider.ts` | `ApifyScrapingProvider.resolveVideoUrl` + SSRF allowlist | URL → mp4Url resolve (the existing ingestion hop) |
| `src/lib/engine/cache/prediction-cache.ts` | `computeContentHash` (mode folded, D-14), L1/L2 cache | Cache the decode result keyed on remix content_hash |
| `src/app/api/analyze/route.ts` `persistCraftToVariants` | Read-merge-write into `variants` JSONB | Template for `persistDecodeToVariants` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Branch inside `/api/analyze` route | A new `/api/decode` route | New route duplicates auth/validation/SSE/placeholder-insert/permalink wiring. Branching the existing route reuses all of it and keeps one integration point. **Recommend: branch the existing route** unless the SSE-vs-decode-path divergence proves too tangled — re-evaluate at plan time. |
| `analyzeVideoWithOmni` fresh call | Reuse ingestion Omni output | Reuse is NOT available — ingestion Omni runs inside `runPredictionPipeline` which the decode path skips entirely (§Reuse-vs-Refetch). Fresh Omni call required. |
| `QWEN_REASONING_MODEL` (`qwen3.6-plus`) for decode | `QWEN_FAST_MODEL` (`qwen3.6-flash`) | Decode is one-shot structured reasoning over rich signal; reasoning model matches `stage11`'s analytical task. Flash is cheaper/faster but the decode is the headline payoff — quality over the ~few-second flash savings. **Recommend reasoning model**; flag as tunable via `QWEN_DECODE_MODEL` env. |

**Installation:** None. All capabilities verified present in installed deps (milestone constraint: "New npm dependencies — Out of Scope, research confirmed all capabilities exist in installed deps").

## Package Legitimacy Audit

> Not applicable — Phase 3 installs **zero** external packages (milestone-locked constraint). All modules used are first-party (`src/lib/engine/*`) or already-installed (`openai`, `zod`, `@sentry/nextjs`, `node:crypto`). slopcheck/registry verification N/A.

## Omni Output: Real Available Fields (the ROADMAP research flag)

> **Source-of-truth:** Phase 1 spike (`01-INGESTION-SPIKE.md` §6/§7) + `OmniAnalysisZodSchema` (`src/lib/engine/qwen/schemas.ts`). These are CONFIRMED real values from live Omni runs on two non-owned URLs, not assumptions.

`analyzeVideoWithOmni` returns (post-normalize) the following structural fields, all confirmed non-empty + differential across two structurally-different viral videos (spike §7 C1 PASS):

| Field | Shape (verified) | Real sample values (spike §6) | Decode relevance |
|-------|------------------|-------------------------------|------------------|
| `hook_decomposition` | `{ visual_stop_power, audio_hook_quality, text_overlay_score, first_words_speech_score, weakest_modality, visual_audio_coherence, cognitive_load }` all 0–10 | Comedy: `visual_stop_power:9, audio_hook_quality:10, first_words_speech_score:10, weakest_modality:text_overlay_score, cognitive_load:2`. Tutorial: `text_overlay_score:10, weakest_modality:visual_stop_power, cognitive_load:2` | **Hook pattern** beat — modality strengths + cognitive_load (INVERTED polarity) name what the hook does |
| `factors` (×5) | `[{ name, score 0-10, rationale ≤300, improvement_tip? }]`, names = Scroll-Stop Power / Completion Pull / Rewatch Potential / Share Trigger / Emotional Charge | populated each run | **Hook pattern** + **Repeatable lane** — `rationale` strings are honest structural descriptions; `name`+`score` rank what drives virality. **NOTE: ignore `improvement_tip`** (it's advice-voiced — violates D-06; do not surface) |
| `segments` | `[{ t_start, t_end, visual_event ≤200, audio_event ≤200, scene_boundary_reason?, is_hook_zone?, idx? }]` (normalized, always non-empty) | Comedy: 6 segs [0-3,3-5.5,...16.8], short 2-3s cuts. Tutorial: 7 segs [0-3,...59], long 12-13s blocks | **Structure & pacing** (segment count/length/cuts) + **The turn** (a scene_boundary_reason marking a pivot) |
| `video_signals` | `{ visual_production_quality, pacing_score, transition_quality }` 0–10 | populated each run | **Structure & pacing** beat — pacing_score + transition_quality quantify rhythm |
| `emotion_arc` | `[{ timestamp_ms, intensity_0_1, label? "low"\|"mid"\|"high" }]`, 3–8 points (`.optional()` but prompt marks REQUIRED for video) | per-segment affect curve | **Emotional beat** — the arc shape (rise/peak/flat) names the emotional move |
| `content_summary` | string ≤500 | Comedy: "Mr. Bean POV impersonation, wide-angle, driveway, 'Pov: Mr Bean' overlay". Tutorial: "Splice app: grab sound → import → extract audio → edit to beat → re-upload" | Decode grounding context — names what the video actually IS (real multimodal transcription, NOT caption). **The turn** detection often readable here |
| `overall_impression` | string ≤500 | populated | High-level decode context |
| `content_type` / `niche` | `content_type` enum + `niche_primary_slug` + `niche_micro_slug?` | comedy/character_impersonation; tutorial/social_media_tips | Decode framing; Phase 4 niche seed |
| `cta_segment`, `audio_signals`, `audio_perceptual_score` | (Content-Craft owned) | — | NOT decode's concern (Content Craft frame owns these) |

**ASR verdict (spike §6, A4):** ASR is **NOT required**. `hook_decomposition.first_words_speech_score` + `audio_hook_quality` reflect real audio; `content_summary` accurately transcribes spoken content (named the exact app "Splice" + step sequence). Omni's built-in audio/speech fidelity is sufficient for hook-line decode. **Do NOT add a Qwen ASR transcript** unless decode prompt design surfaces a concrete spoken-hook gap (deferred).

## Omni-Field → 4-Beat Mapping (DECODE-01)

Grounded in the real fields above. The Qwen decode call receives these fields as structured context and produces honest prose per beat. The mapping below is the **input grounding** for the prompt, not the output schema (the model writes the prose):

| Beat (D-01 label) | Primary Omni inputs | Honest-absence trigger (D-02) |
|-------------------|---------------------|-------------------------------|
| **Hook pattern** | `hook_decomposition` (modality scores + `weakest_modality` + `cognitive_load`), `factors[name=Scroll-Stop Power].rationale`, `content_summary` (first-segment), `segments[is_hook_zone]` | Low `visual_stop_power`+`audio_hook_quality` → "The hook is soft — it relies on [strongest modality] alone" (still describes, never "fix") |
| **Structure & pacing** | `segments` (count, durations, cut rhythm), `video_signals.pacing_score` + `transition_quality` | n/a — every video has a structure; describe it honestly even if flat ("one continuous shot, no cuts") |
| **The turn** | A pivot in `segments[].scene_boundary_reason` or a `content_summary` mid-point shift; emotion_arc inflection | **Most-likely-absent beat** — many videos ride one bit. Honest: "No distinct turn — it rides one continuous bit" (D-02 example) |
| **Emotional beat** | `emotion_arc` shape (rise/peak/plateau), `factors[name=Emotional Charge].score`+`rationale` | Flat `emotion_arc` (all "low"/"mid", low Emotional Charge) → "Emotionally flat — it works on novelty, not feeling" |

**Repeatable lane (D-03) inputs:** high-scoring `factors[].rationale` describing **structural** moves (hook construction, pacing pattern, segment rhythm) — the reproducible mechanics. This lane MUST be a clean bullet list (Phase 4 Adapt parses it).

**Luck lane (D-04/D-05) inputs:** the decode model classifies into the fixed 4-category taxonomy. The Omni signal does NOT directly carry luck attribution (it's video-intrinsic), so luck is **inferred by the decode model** from context (e.g., a trend-dependent format → `timing/trend-moment`; a creator-reach-dependent spike → `existing-audience/reach`). This is why luck-always-non-empty needs a prompt + TS backstop (§Pitfalls).

## Reuse-vs-Refetch: RESOLVED → Refetch (fresh Omni call)

> Claude's-Discretion item + SC#2. Traced `pipeline.ts:530-654` + `route.ts:495,634`.

**Finding:** The ingestion Omni output is **NOT reusable** by a decode-only path:
1. The `tiktok_url` resolve→rehost→`analyzeVideoWithOmni` hop lives **inside `runPredictionPipeline`** (`pipeline.ts:530-654`). Its output (`omniOut`) is consumed within the pipeline (feeds `precomputedGeminiResult`, segments → filmstrip + Pass 2) and is **not persisted as raw Omni structural fields** anywhere — only derived Craft signals land in `variants.craft` (`route.ts:persistCraftToVariants`), and `overall_score`/factors land on the row via the scoring path.
2. The decode path **must skip `runPredictionPipeline` entirely** (pitfall C2 — no usage_tracking, no 332s scoring). Therefore there is no pipeline run to harvest Omni output from.

**Resolution:** The decode path makes its **own** `resolve → rehost → analyzeVideoWithOmni` hop, then **one** Qwen decode call. This is exactly SC#2's "Omni segment call → one Qwen decode call." The resolve+Omni hop is already proven (~60–75s, spike §5) and well under `maxDuration=300`.

**Latency win (SC#2):** Decode skips Waves 1–4 + `aggregateScores` (Stage 10/11 LLM tail ~46s+ + ML + personas). Estimated decode wall-clock: **resolve(25–38s) + rehost + Omni(35s) + Qwen decode(~10–30s) ≈ 70–100s**, vs. the full ~332s scoring pipeline. CONTEXT's ~60–90s estimate is in range. The win is from skipping the scorer, not from reusing Omni.

**Refactor opportunity (flag for planner):** The resolve→rehost→signed-URL hop is currently inline in `pipeline.ts:530-609`. The decode path needs the identical hop. **Recommend extracting it into a shared helper** (e.g. `src/lib/engine/remix/resolve-and-rehost.ts` returning `{ signedUrl, cleanup }`) so both `pipeline.ts` (existing) and the decode path call one implementation — avoids duplicating the derive-and-drop `finally` (pitfall C4 is security-critical and must not be re-implemented divergently). If extraction is too invasive for this phase, duplicate carefully and add a test asserting both paths delete the temp object.

## Lightweight Path Architecture (DECODE-01, pitfall C2)

### System flow

```
Remix submit (Board.handleContentSubmit, submittedIntent='remix', mode:'remix' in POST body)
        │
        ▼
POST /api/analyze
        │
   auth + INFRA-04 validation (unchanged)
        │
   DAILY_LIMITS / 429 cost-exhaustion guard (route.ts:296-310, mode-agnostic — KEEP; it is the
   paste-spam guard for remix per STATE Plan 03 decision. This is NOT usage_tracking increment.)
        │
   computeContentHash(mode folded, D-14) + cache lookup (variants.remix.decode hit?)
        │
   ┌────┴─────────────── mode === 'remix' ? ───────────────┐
   │ NO (score)                                             │ YES (remix) ── NEW BRANCH (Phase 3)
   ▼                                                        ▼
 [existing path]                              insert placeholder row {overall_score:null, mode:'remix'}
 runPredictionPipeline                        send SSE 'started' {id}
 aggregateScores                              send SSE 'phase' {phase:'analyzing', "Decoding structure…"}
 usage_tracking upsert ◄── pitfall C2:                │
 variants.craft                               resolveAndRehost(tiktok_url) → signedUrl (derive-and-drop finally)
 complete                                             │
                                              analyzeVideoWithOmni(signedUrl) → structural fields
                                                      │
                                              runDecode(omniFields) → Qwen call → DecodeResult
                                                      │  (pure-TS backstop: luck-lane-non-empty, beats×4)
                                              persistDecodeToVariants(id, decode)  // read-merge-write
                                                      │  ◄── NO usage_tracking, NO scoring columns
                                              populate decode cache (content_hash)
                                                      │
                                              send SSE 'complete' {id, mode:'remix',
                                                 overall_score:null, variants:{remix:{decode}}}
```

### Critical constraints (pitfall C2)
- **NO `runPredictionPipeline`** on the decode branch.
- **NO `usage_tracking` upsert** on the decode branch (the `route.ts:545/709` upsert must be inside the score branch only). The DAILY_LIMITS **read** guard at `route.ts:296-310` is a separate cost-exhaustion check that STAYS (it's the paste-spam guard) — distinguish "read limit to reject" (keep) from "increment usage count" (skip).
- **NO scoring columns** written: `overall_score`, `confidence`, `factors`, `feature_vector`, `behavioral_predictions` stay null. Completion marker is `variants.remix != null` (m3).
- **Derive-and-drop preserved:** the temp re-hosted mp4 is deleted in a `finally`-equivalent regardless of Omni/decode success (pitfall C4). `video_storage_path` stays null on the remix row.

## Decode Output Schema (`variants.remix.decode`)

> TypeScript shape is Claude's Discretion. Recommended (additive, JSONB — no migration; mirrors `variants.craft`):

```typescript
// src/lib/engine/remix/decode-types.ts
export type BeatId = 'hook_pattern' | 'structure_pacing' | 'the_turn' | 'emotional_beat';

export interface DecodeBeat {
  id: BeatId;
  /** 1-2 honest declarative lines. Third-person, no advice verbs (D-06/D-07). */
  body: string;
  /** D-02: explicit honest absence/weakness. When 'absent'|'weak', body names it
   *  ("No distinct turn — it rides one continuous bit"). 'present' = a real beat. */
  verdict: 'present' | 'weak' | 'absent';
}

export type LuckCategory =
  | 'timing_trend_moment'
  | 'existing_audience_reach'
  | 'algorithmic_outlier'
  | 'topic_zeitgeist';

export interface DecodeResult {
  beats: DecodeBeat[];            // EXACTLY 4, fixed order (hook → structure → turn → emotional)
  repeatable: string[];          // D-03 clean bullet list (Phase 4 Adapt parses this)
  luck: { category: LuckCategory; note: string }[]; // D-04: length >= 1 ALWAYS
}

// Persisted at analysis_results.variants.remix.decode (DecodeResult).
// Row: overall_score = null, mode = 'remix'. Completion marker: variants.remix != null.
```

**Zod schema** (in `decode.ts`, validating the Qwen output) enforces `beats.length(4)`, `luck.min(1)`, the beat-id enum + order, the luck-category enum (D-05 fixed taxonomy). Single retry on Zod failure → Sentry capture (PATTERN S7, mirrors `stage11`).

## Decode Prompt Design (DECODE-02, voice)

Modeled on `stage11-counterfactuals-prompts.ts` (system prompt constant + `buildSignalContextUserMessage` + response Zod schema). The decode call:

- **Model:** `QWEN_REASONING_MODEL` (`qwen3.6-plus`), `temperature: 0`, `seed: QWEN_SEED` (reproducible — same video → same decode), `response_format: { type: "json_object" }`, `maxRetries:0` (client default), per-call timeout ~30–45s.
- **System prompt invariants (the honest-voice contract, D-06/D-07/SC#4):**
  - Third-person about the source ("the hook", "this structure") — NEVER "you" (reserved for Adapt).
  - Declarative analysis of **why it worked** — NEVER advice verbs (fix/improve/should/try/consider). Explicitly forbid them in the prompt.
  - Each of the 4 beats MUST be emitted; when a beat is genuinely weak/absent, set `verdict` accordingly and **name the absence honestly in `body`** — never fabricate (D-02).
  - The luck array MUST contain ≥1 entry from the fixed taxonomy (D-04/D-05). Instruct: "Every viral video has at least one unrepeatable factor — identify it. Do NOT collapse everything into repeatable."
  - `repeatable` is structural moves only (reproducible by any creator), NOT topic/timing.
- **User message:** `buildDecodeContext(omniFields)` — serialize `hook_decomposition`, the 5 `factors` (name+score+rationale, **omit `improvement_tip`** — advice-voiced), `segments` (compact), `video_signals`, `emotion_arc`, `content_summary`, `overall_impression`, `content_type`/niche.
- **Pure-TS backstop** (NOT model-trusted, mirrors `maybeAppendLikelyFlopWarning`): after Zod parse, if `luck.length === 0` → push a default `{ category: 'algorithmic_outlier', note: '...' }` and Sentry-warn (guards SC#3 even if the model disobeys); assert `beats.length === 4`.

## Frontend (DecodeShellNode body + streaming)

### Reading the decode payload (mirror `ContentAnalysisFrame`'s dual-read)
`ContentAnalysisFrame.tsx` is the exact template: it calls `useAnalysisStream({ initialData: usePermalinkAnalysis().data })` and dual-reads `result.variants.craft`. Decode does the same for `result.variants.remix.decode`:

```typescript
// DecodeShellNode reads:
const { data: permalinkData } = usePermalinkAnalysis();   // /analyze/[id] direct nav
const stream = useAnalysisStream({ initialData: permalinkData ?? null });
const row = stream.result as unknown as
  { variants?: { remix?: { decode?: DecodeResult } } } | null;
const decode = row?.variants?.remix?.decode ?? null;
const isDecoding = stream.phase === 'analyzing' || stream.phase === 'reconnecting' || stream.phase === 'polling';
```
- **Live path:** `event: complete` payload (`use-analysis-stream:244 setResult`) carries `variants.remix.decode`.
- **Permalink path:** `/api/analysis/[id]` does `select("*")` (`route.ts:28`) → returns `variants` → `usePermalinkAnalysis` surfaces it → `initialData`. (Note: permalink short-circuit at `use-analysis-stream:127` keys on `overall_score != null`; a decode row has `overall_score: null`, so it will NOT short-circuit to 'complete' from initialData alone. **Plan must handle remix hydration:** either pass the decode row through a remix-aware initialData path, or have DecodeShellNode read `permalinkData.variants.remix.decode` directly when present. This is the m3 marker concern — `overall_score` is the wrong completion signal for remix. Flag explicitly to planner.)

### Render (D-01/D-03, Raycast)
- 4 beats as stacked labeled blocks in the Decode hero bounds (Verdict's bounds, D-07 Phase 2). Use `FrameHero` for the frame label + the `_kit` chrome.
- Below beats: two labeled lanes ("What you can repeat" bulleted, "What was luck / timing" bulleted with category labels).
- All 4 beats always rendered (D-02); `verdict:'absent'|'weak'` styles the block muted but still shows the honest `body` line.
- Raycast: 6% borders (`white/[0.06]`), Inter, 12px radius, no glow/tint, muted text via `text-white/35`–`/60`. Mirror VerdictNode's `SectionHead` (`text-[11px] uppercase tracking-[0.08em] text-white/45`) for lane/beat labels.

### In-flight state (D-09)
- While `isDecoding && !decode`: render a quiet "Decoding structure…" status with subtle motion (reuse the board's existing pending treatment — VerdictNode uses `motion-safe:animate-skeleton-breathe`; Decode should use the SAME honest streaming treatment, NOT a fake skeleton-of-content). No fabricated beat placeholders.

### Mobile (Claude's Discretion)
- `BoardMobile.tsx:134` already routes `case 'decode': return <DecodeShellNode />` — the swapped body renders identically (DOM, no Konva). Mirror desktop content; the Phase 2 BoardMobile swap pattern already handles mount order (`MOBILE_ORDER_REMIX`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Qwen call + retry + Zod + cost + Sentry | A new LLM wrapper | Copy `stage11-counterfactuals.ts` structure verbatim | Exact proven pattern (timeout, single-retry, strip, calculateCost, Sentry S7) |
| `variants` JSONB write | A wholesale `variants` overwrite or a new migration/column | `persistCraftToVariants` read-merge-write pattern | Filmstrip + craft writers race on `variants`; read-merge-write preserves siblings. JSONB = no migration (additive) |
| URL→mp4→signed-URL resolve | A second resolver | `ApifyScrapingProvider.resolveVideoUrl` + the `pipeline.ts:530-609` rehost hop (extract to shared helper) | SSRF allowlist + derive-and-drop `finally` are security-critical (C4); don't reimplement divergently |
| content_hash for cache | A new hash | `computeContentHash` (mode already folded, D-14) | Remix + score of same URL already don't collide; reuse it |
| SSE transport + permalink hydration | A `/api/decode` SSE route | Branch `/api/analyze`; reuse `event: started/phase/complete` + `select('*')` permalink | All transport/auth/placeholder plumbing already exists |
| Frame read of `variants` on client | New data hook | `ContentAnalysisFrame` dual-read (`useAnalysisStream` + `usePermalinkAnalysis`) | Identical sibling; handles live + permalink |

**Key insight:** Phase 3 introduces exactly ONE genuinely new artifact — `src/lib/engine/remix/decode.ts` (the Qwen decode call + schema). Everything else is a copy-of-a-sibling (`variants.craft` → `variants.remix.decode`, `stage11` → `decode`, `ContentAnalysisFrame` → `DecodeShellNode` body) plus one route branch.

## Common Pitfalls

### Pitfall C2: Decode enters the full pipeline / touches usage_tracking
**What goes wrong:** Reusing the existing route flow as-is runs `runPredictionPipeline` + `aggregateScores` + the `usage_tracking` upsert for a remix submit — 332s latency, billable scoring, and a usage increment on a non-scored row.
**Why it happens:** The route today has NO remix branch (`runPredictionPipeline` is called unconditionally in both the JSON and SSE paths). Phase 2 only added mode persistence + hash folding, not a pipeline divergence.
**How to avoid:** Branch on `validated.mode === 'remix'` BEFORE `runPredictionPipeline` and BEFORE the `usage_tracking` upsert. Keep the DAILY_LIMITS **read** guard (paste-spam protection, mode-agnostic per STATE Plan 03) but skip the usage **increment**.
**Warning signs:** A remix row with non-null `overall_score`; a `usage_tracking` row incremented by a remix submit; decode latency near 332s; `stage` SSE events for `wave_3_personas` on a remix stream.

### Pitfall: Luck-lane hallucination (collapses to "repeatable")
**What goes wrong:** The model attributes 100% of success to repeatable structure, leaving luck empty — violates SC#3/D-04.
**Why it happens:** The Omni signal is video-intrinsic and doesn't carry luck attribution; the model must infer it, and a confident model over-credits structure.
**How to avoid:** Prompt instruction ("every viral video has ≥1 unrepeatable factor; never collapse to repeatable") + Zod `luck.min(1)` + pure-TS backstop that injects a default luck entry if empty (mirrors `maybeAppendLikelyFlopWarning`).
**Warning signs:** `luck.length === 0` in a decode result; identical luck text across structurally-different videos.

### Pitfall: Beat hallucination (fabricates a turn/emotional beat)
**What goes wrong:** The model invents "the turn" for a video that rides one continuous bit, or claims an emotional arc where `emotion_arc` is flat.
**Why it happens:** A 4-slot schema pressures the model to fill every slot with positive content.
**How to avoid:** D-02 `verdict: 'present'|'weak'|'absent'` field + prompt instruction to name absences honestly ("No distinct turn — it rides one continuous bit"). The schema makes "absent" a first-class, expected answer.
**Warning signs:** Every video reports `verdict:'present'` on all 4 beats; "the turn" body present when `segments` show no scene-boundary pivot.

### Pitfall: "Fix this" / advice framing (SC#4 / D-06)
**What goes wrong:** Decode copy slips into advice ("you should tighten the hook") — violates the "why it worked, never fix this" non-negotiable.
**Why it happens:** The Omni `factors[].improvement_tip` field is advice-voiced; if surfaced or fed unfiltered it leaks the wrong register. The scoring frames (Verdict/Actions) ARE advice-voiced, tempting copy reuse.
**How to avoid:** OMIT `improvement_tip` from the decode user message. System prompt forbids advice verbs + second-person. Third-person, declarative only.
**Warning signs:** "you", "fix", "improve", "should", "try", "consider" in decode output. A test should grep the rendered beats/lanes for these tokens.

### Pitfall m3: Wrong completion marker on permalink hydration
**What goes wrong:** A decode row has `overall_score: null`; code that treats `overall_score != null` as "complete" (the `use-analysis-stream:127` short-circuit) will never mark a decode permalink complete, leaving a permanent loading state.
**Why it happens:** The entire score-path hydration keys on `overall_score`. Decode rows never have one.
**How to avoid:** The Decode frame's hydration must key on `variants.remix != null` (or read `permalinkData.variants.remix.decode` directly). Phase 3 is the FIRST phase to write a populated remix row — this is where the marker first matters. (Phase 5 generalizes it.)
**Warning signs:** Decode permalink (`/analyze/[id]` for a remix row) shows "Decoding structure…" forever; `stream.phase` stuck non-'complete' on a reload.

### Pitfall C4: Derive-and-drop regression on the decode path
**What goes wrong:** The decode path's own resolve→rehost hop persists the temp mp4 (IP boundary breach) by skipping the `finally` delete.
**Why it happens:** Duplicating the rehost hop without duplicating the unconditional cleanup.
**How to avoid:** Extract the resolve→rehost→cleanup into a shared helper used by both `pipeline.ts` and decode; OR if duplicated, assert deletion in a test (`derive-and-drop.test.ts` is the existing template). Never set `video_storage_path` on a remix row.
**Warning signs:** A `remix-temp/*.mp4` object surviving a decode request; `video_storage_path` non-null on a remix row.

## Code Examples

### Qwen decode call skeleton (mirror `stage11-counterfactuals.ts`)
```typescript
// src/lib/engine/remix/decode.ts — pattern verbatim from stage11-counterfactuals.ts:68-end
import { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } from "../qwen/client";
import { calculateCost } from "../qwen/cost";
import { stripModelOutput } from "../utils/strip";
import { DecodeResultZodSchema, DECODE_SYSTEM_PROMPT, buildDecodeContext } from "./decode-prompts";

const QWEN_DECODE_MODEL = process.env.QWEN_DECODE_MODEL ?? QWEN_REASONING_MODEL;
const PER_CALL_TIMEOUT_MS = 45_000;

export async function runDecode(omni: OmniStructuralInput): Promise<DecodeResult> {
  const ai = getQwenClient();
  // single-retry loop on Zod failure (PATTERN S7), AbortController timeout,
  // temperature:0 + seed:QWEN_SEED, response_format json_object.
  // calculateCost(QWEN_DECODE_MODEL, completion.usage). Sentry on 2nd failure.
  // Pure-TS backstop: if parsed.luck.length === 0 push default; assert beats.length===4.
}
```

### `variants.remix.decode` persistence (mirror `persistCraftToVariants`)
```typescript
// route.ts — read-merge-write, preserves sibling variants (craft/filmstrip_segments)
const { data: row } = await service.from("analysis_results").select("variants").eq("id", id).single();
const current = (row?.variants ?? {}) as Record<string, unknown>;
const remix = (current.remix ?? {}) as Record<string, unknown>;
await service.from("analysis_results")
  .update({ variants: { ...current, remix: { ...remix, decode } } as unknown as Json })
  .eq("id", id);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Gemini segmented (3 calls) for structural signal | Single `qwen3.5-omni-plus` call | Pre-milestone (Qwen-only) | Decode reads one unified Omni output; no multi-call assembly |
| `tiktok_url` = caption text only | `tiktok_url` = real Omni segments via Supabase re-host | Phase 1 (INGEST-01) | Structural decode is now POSSIBLE on non-owned URLs (the hard gate) |
| Token-scoped Omni pass-through | Supabase re-host + derive-and-drop | Phase 1 Plan 03 | Decode path must reuse the secure re-host (no token leak to DashScope) |

**Deprecated/outdated:** Do NOT use `factors[].improvement_tip` in decode (advice-voiced, violates D-06). Do NOT add ASR (deferred — Omni fidelity sufficient).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `QWEN_REASONING_MODEL` is the right model for decode (vs FAST) | Standard Stack | LOW — env-overridable via `QWEN_DECODE_MODEL`; quality/latency tunable at plan time |
| A2 | Branching `/api/analyze` is cleaner than a new `/api/decode` route | Alternatives | MEDIUM — if SSE divergence is too tangled, a dedicated route may be cleaner; re-evaluate in planning |
| A3 | Decode wall-clock ~70–100s (Omni ~60–75s proven + Qwen decode ~10–30s) | Reuse-vs-Refetch | LOW — Qwen reasoning calls in this codebase run ~30–35s (stage11); decode context is smaller. Comfortably < 300s either way |
| A4 | Permalink `initialData` won't auto-complete a decode row (overall_score null) | Frontend | MEDIUM — must verify the exact hydration path in planning; m3 marker handling is the fix |
| A5 | Luck attribution is model-inferred (Omni carries no luck signal) | Omni-Field Mapping | LOW — confirmed: Omni fields are video-intrinsic structural; luck is contextual inference (hence the prompt+TS backstop) |

## Open Questions

1. **Route branch vs. new route for the decode path.**
   - What we know: Branching reuses all auth/validation/SSE/permalink plumbing; the route already persists `mode` + folds it into the hash.
   - What's unclear: How cleanly the SSE `ReadableStream.start` can fork between the pipeline path and the decode path without tangling.
   - Recommendation: Branch the existing route; isolate the decode branch into a `runDecodeStream(controller, ...)` helper to keep the fork readable. Re-evaluate if the fork balloons.

2. **Exact permalink hydration for a remix/decode row (m3).**
   - What we know: `/api/analysis/[id]` returns `variants` via `select("*")`; `use-analysis-stream` short-circuits on `overall_score != null` (won't fire for decode).
   - What's unclear: Whether DecodeShellNode reads `permalinkData.variants.remix.decode` directly, or whether the hook needs a remix-aware initialData branch.
   - Recommendation: Have DecodeShellNode read the permalink decode payload directly (simplest, no hook change); confirm with a permalink-reload test. Phase 5 owns the general marker.

3. **Shared resolve→rehost helper extraction scope.**
   - What we know: The hop is inline in `pipeline.ts:530-609` with a security-critical derive-and-drop `finally`.
   - Recommendation: Extract to `src/lib/engine/remix/resolve-and-rehost.ts` returning `{ signedUrl, cleanup }`; if too invasive this phase, duplicate + add a deletion test. Do NOT silently diverge the cleanup logic.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| DashScope (Qwen) API | Omni + decode calls | ✓ (env `DASHSCOPE_API_KEY`) | `qwen3.5-omni-plus`, `qwen3.6-plus` | none (Qwen-only milestone) |
| Apify (Clockworks scraper) | URL → mp4 resolve | ✓ (env `APIFY_TOKEN`) | `clockworks/tiktok-scraper` | none — Phase 1 hard gate |
| Supabase Storage `videos` bucket | re-host (derive-and-drop) | ✓ | — | none |
| Supabase `analysis_results.variants` JSONB | decode persistence | ✓ (`Json \| null`, no migration) | — | none |

**Missing dependencies with no fallback:** none — Phase 1 closed the ingestion gate; all decode deps are live.

## Validation Architecture

> nyquist_validation = true (`.planning/config.json:61`). Test framework: **Vitest 4.0.18** (`package.json` `"test": "vitest run"`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @testing-library + vitest-axe |
| Config file | `vitest.config.*` (project root — confirm exact name at plan time) |
| Quick run command | `npx vitest run <path>` |
| Full suite command | `npm test` (`vitest run`) |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| DECODE-01 | `runDecode` returns exactly 4 beats in fixed order, each with a verdict | unit | `npx vitest run src/lib/engine/remix/__tests__/decode.test.ts` | ❌ Wave 0 |
| DECODE-01 | Decode path does NOT call `runPredictionPipeline` and does NOT upsert `usage_tracking` (pitfall C2) | unit (route, mocked) | `npx vitest run src/app/api/analyze/__tests__/decode-route.test.ts` | ❌ Wave 0 |
| DECODE-01 | Persists to `variants.remix.decode`; preserves sibling `variants.craft`/`filmstrip_segments` (read-merge-write) | unit | same route test | ❌ Wave 0 |
| DECODE-01 | Decode row has `overall_score: null`, `mode: 'remix'`; completion marker = `variants.remix != null` (m3) | unit | same route test | ❌ Wave 0 |
| DECODE-02 | `luck` array length ≥ 1 always (backstop injects default when model returns empty) | unit | `decode.test.ts` (fixture w/ empty luck) | ❌ Wave 0 |
| DECODE-02 | Luck categories restricted to the fixed D-05 taxonomy (Zod enum) | unit | `decode.test.ts` | ❌ Wave 0 |
| DECODE-02 | Beat with no signal returns `verdict:'absent'` + honest body, not fabricated content | unit | `decode.test.ts` (flat-emotion / one-shot fixture) | ❌ Wave 0 |
| DECODE-02/SC#4 | Rendered beats + lanes contain NO advice verbs / second-person ("you/fix/improve/should/try/consider") | unit (component) | `npx vitest run src/components/board/decode/__tests__/DecodeShellNode.test.tsx` | ⚠️ dir exists, add test |
| DECODE-01 | DecodeShellNode renders all 4 beats + both lanes from a `variants.remix.decode` fixture (live + permalink) | component | same component test | ⚠️ add |
| DECODE-01/C4 | Decode path deletes the re-hosted temp mp4 (derive-and-drop) | unit | extend `derive-and-drop.test.ts` | ⚠️ exists, extend |
| SC#5 | Score-mode board + existing analyze flow unchanged (regression) | unit | existing route/board suites stay green | ✅ |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched test file>` (< 30s).
- **Per wave merge:** `npm test` (full Vitest suite).
- **Phase gate:** Full suite green before `/gsd:verify-work`; plus a live remix-URL manual decode (the ~70–100s path) producing non-empty beats + non-empty luck.

### Wave 0 Gaps
- [ ] `src/lib/engine/remix/__tests__/decode.test.ts` — covers DECODE-01/02 (beats×4, luck≥1, fixed taxonomy, honest-absence verdicts, voice). Needs Omni-fixture (build from spike §6 real values).
- [ ] `src/app/api/analyze/__tests__/decode-route.test.ts` — covers C2 (no pipeline, no usage_tracking), variants.remix.decode persistence + read-merge-write, overall_score null.
- [ ] `src/components/board/decode/__tests__/DecodeShellNode.test.tsx` — 4-beat + 2-lane render from fixture, no-advice-verb assertion, in-flight "Decoding…" state, mobile parity.
- [ ] Extend `src/app/api/analyze/__tests__/derive-and-drop.test.ts` — decode path deletes temp mp4.
- [ ] Omni structural fixture file (real-shaped from spike §6) — shared by decode + component tests.

## Security Domain

> security_enforcement enabled (absent in config = enabled).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing `supabase.auth.getUser()` gate on `/api/analyze` (unchanged) |
| V4 Access Control | yes | Decode cache key + permalink scoped by `user_id` (`prediction-cache.ts:86`, `/api/analysis/[id]` `.eq("user_id")`) — keep |
| V5 Input Validation | yes | TikTok URL format validation (`route.ts:238`) + SSRF host allowlist on resolve (`apify-provider`) — keep, unchanged |
| V6 Cryptography | no | No new crypto (content_hash uses existing `node:crypto`) |

### Known Threat Patterns for {Next.js route + LLM + 3rd-party media}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Apify token leak to DashScope (URL pass-through) | Information Disclosure | Re-host + signed URL (never put token in Omni URL) — Phase 1 Option B, preserved |
| Source mp4 persistence (IP boundary) | — / Compliance | Derive-and-drop `finally` delete; no `video_storage_path` on remix row (C4) |
| SSRF via resolved media URL | Spoofing/Tampering | SSRF host allowlist (`.apify.com`, `.tiktokcdn.com`, etc.) — Phase 1, unchanged |
| Paste-spam cost exhaustion | DoS | DAILY_LIMITS read guard (`route.ts:296-310`) stays on the remix branch (read-to-reject, NOT increment) |
| Prompt-injection via `content_summary` into decode | Tampering | Decode prompt treats Omni fields as data, returns fixed-schema JSON (Zod-validated); no tool-calls; low blast radius |

## Sources

### Primary (HIGH confidence)
- `.planning/phases/01-ingestion-build-hard-gate/01-INGESTION-SPIKE.md` §6 (Omni fidelity, real values), §7 (C1 differential), §8 (re-host strategy) — the ROADMAP research flag source-of-truth.
- `src/lib/engine/qwen/schemas.ts` — `OmniAnalysisZodSchema` (exact available structural fields + types).
- `src/lib/engine/qwen/omni-analysis.ts` — `analyzeVideoWithOmni` contract + output shape.
- `src/lib/engine/pipeline.ts:490-670` — tiktok_url resolve→rehost→Omni branch (reuse-vs-refetch trace; runs inside the pipeline).
- `src/app/api/analyze/route.ts` — `persistCraftToVariants` (persistence template), unconditional `runPredictionPipeline` (4×, no remix branch), `usage_tracking` upserts, DAILY_LIMITS, placeholder insert, SSE start/phase/complete.
- `src/lib/engine/stage11-counterfactuals.ts` + `client.ts` — exact Qwen text-call template (model, seed, retry, cost, Sentry, TS backstop).
- `src/components/board/content-analysis/ContentAnalysisFrame.tsx` — `variants.craft` dual-read (live + permalink) template.
- `src/hooks/queries/use-analysis-stream.ts` — `complete` event → `setResult` (variants flow); `overall_score`-keyed short-circuit (m3 concern).
- `src/components/board/{Board,BoardMobile,decode/DecodeShellNode,_kit/FrameHero,verdict/VerdictNode}.tsx` + `board-constants.ts` — mount points, bounds (decode = verdict bounds, D-07), honest-voice + Raycast styling reference.
- `src/app/api/analysis/[id]/route.ts` — permalink `select("*")` returns `variants` (hydration path).
- `.planning/config.json` — nyquist_validation true; `package.json` — Vitest 4.0.18.

### Secondary / Tertiary
- None — phase is fully codebase-grounded; no external/web sources needed (no new deps, Qwen-only).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all modules read first-hand; zero new deps (milestone-locked).
- Omni field availability: HIGH — confirmed real + differential in the Phase 1 live spike (not training/assumption).
- Architecture (lightweight path): HIGH — traced the exact route flow; the "remix still uses pipeline" finding is verified (`grep -c` + read).
- Decode prompt/schema: MEDIUM-HIGH — pattern is proven (`stage11`); the exact prompt wording is Claude's Discretion (planner/discuss to finalize copy).
- Permalink hydration (m3): MEDIUM — the short-circuit behavior is read; the exact fix path needs confirmation in planning (Open Q2).

**Research date:** 2026-06-02
**Valid until:** 2026-07-02 (stable — internal codebase + locked Qwen model IDs; re-check only if pipeline.ts/route.ts refactored)
