# Phase 2: View-Model + Data Contract (ENG-06 D-12) - Research

**Researched:** 2026-06-12
**Domain:** Pure data-transformation module (TypeScript) — engine output → Reading blocks + verdict; identical-render contract across live SSE and persisted-row replay
**Confidence:** HIGH (the entire input/output surface is in-repo and was read directly; no external libraries introduced)

## Summary

Phase 2 is a pure-TypeScript presentation-layer module with zero new dependencies. Everything it consumes (`PredictionResult`), everything it must funnel both paths through (`analyze/route.ts` live `complete` + `analysis/[id]/route.ts` replay), and every derivation it should reuse (`verdict-derive.ts`, `verdict-constants.ts`) was read directly from the codebase. There is no library research to do — the risk is entirely in **getting the field audit and the live∩persisted intersection exactly right**, because the success criteria demand a deep-equal test across two real-data paths that *currently diverge*.

The load-bearing finding (confirms D-10): **DATA-02 is FALSE today.** `analysis/[id]/route.ts` does not return the raw row — it actively reconstructs four fields at load time, one of them (`heatmap` via `synthHeatmap()`) using `Math.random()` for persona ids and synthetic attention curves. So `toReadingBlocks(live)` and `toReadingBlocks(replay)` cannot be equal for any block built on those fields until a deterministic normalizer (`fromPersistedRow`) replaces the route's inline shims. The phase's whole reason to exist is this normalizer plus the intersection rule (D-09).

**Primary recommendation:** Build `lib/reading/` as three pure co-located modules — `block-types.ts` (the discriminated `ReadingBlock` union + `CanonicalReading` shape), `from-persisted-row.ts` (`fromPersistedRow(row) → CanonicalReading`, absorbing and replacing the `[id]/route.ts` shims), and `view-model.ts` (`toReadingBlocks(canonical) → ReadingBlock[]` + the exported `VERDICT_BANDS` constant). The live path feeds `toReadingBlocks(canonicalFromLiveResult(stream.result))`; the replay path feeds `toReadingBlocks(fromPersistedRow(row))`. **Make heatmap deterministic-or-degrade**: drop `Math.random()` ids, and if the real `heatmap` column/`variants` is absent, emit a degraded retention block — never a fabricated curve. Capture real fixtures by running `scripts/smoke-tiktok-pipeline.ts` (live JSON) and reading the same row back through `/api/analysis/[id]` (persisted), not by hand-authoring.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `toReadingBlocks()` mapping | Shared pure lib (`lib/reading/`) | — | Must run client-at-mount on BOTH paths (D-08); pure = no React/no fetch so it's identical regardless of caller |
| `fromPersistedRow()` normalizer | Shared pure lib (`lib/reading/`) | API route (`[id]/route.ts` imports it) | Presentation-layer reconstruction; consolidates the route's inline shims (D-11) — stays within the engine freeze |
| Verdict band derivation | Shared pure lib | reuses `verdict-derive.bandLabel` thresholds | Band logic already exists; extract thresholds to `VERDICT_BANDS` constant (D-04), don't rebuild |
| Live result receipt | Client hook (`use-analysis-stream.ts`) | — | `setResult(data as PredictionResult)` on `complete`; the view-model is called downstream of this, not inside it |
| Persisted-row enrichment | API route (`[id]/route.ts`) | → becomes a thin caller of `fromPersistedRow` | Today owns the shims; Phase 2 moves the logic into the lib and leaves the route as a wrapper |
| Engine output production | Engine (`lib/engine/`) — **FROZEN** | — | NO edits, NO `ENGINE_VERSION` bump (3.19.0 frozen); Phase 2 only re-composes |

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** ~10 value-bearing KEEP blocks: Verdict, Expert insight (`apollo_reasoning`, foregrounded), Hook (`hook_decomposition`), Retention/beats (`heatmap` — conditional on normalizer; else degrades), Audience behavior (`behavioral_predictions` 4-pct + intent chips), Fixes (`suggestions` + `counterfactuals.suggestions`, band-adaptive), Drivers (`factors[]`), Persona read (`persona_behavioral_aggregate`), Content summary (`overall_impression`/`content_summary`), Audio (`audio_fingerprint`, conditional-render only when matched).
- **D-02:** DROP set: `rule_score`, `trend_score`, `gemini_score`, `ml_score` (all null since F43), `reasoning` (`""`/null in prod), `predicted_engagement` (live-only — D-09), raw `component_scores`, `matched_trends`, `retrieval_score`/`retrieval_evidence`, `platform_fit`, `critique`, `emotion_arc`.
- **D-03:** Borderline: `emotion_arc` → DROP; `retrieval_evidence` → DROP; `platform_fit`/`critique` → DROP; `audio_fingerprint` → KEEP conditional-render. Prune documented as a consumed-vs-dead map (DATA-03).
- **D-04:** Band from `bandLabel(overall_score)` — reuse thresholds (≥70 / 40–69 / <40) but extract into a single exported `VERDICT_BANDS` constant Phase 3 calibrates. Do not re-derive band logic.
- **D-05:** The "why" → prefer engine-authored `hero.verdict_line`; deterministic fallback (top-weighted factor rationale or `the_one_fix`). Never a generic string.
- **D-06:** Confidence in band language, not a number. Map `confidence_label` HIGH/MED/LOW → wording.
- **D-07:** "Mixed signals" is a first-class band — fired by `anti_virality_gated` OR a boundary score in Phase-3's buffer zone. The `/100` demoted to in-body supporting evidence.
- **D-08:** Call-site = client-at-mount, both paths. Live → `toReadingBlocks(stream.result)`; replay → `toReadingBlocks(fromPersistedRow(row))`. Pure — no React/fetch inside. (Rejected: server emits a `reading_blocks` SSE event — replay can't re-emit.)
- **D-09:** Hard rule — the contract consumes only the field intersection of live ∩ persisted shapes. Any live-only field (`predicted_engagement` R11; audit all) is excluded. **Load-bearing rule.**
- **D-10:** AUDIT FINDING — DATA-02 is currently FALSE for reconstructed fields (`synthHeatmap()` with `Math.random()`, recomputed `optimal_post_window`, derived `analysis_unavailable`; Apollo/hero in racing `variants` JSONB).
- **D-11:** Resolution — single pure deterministic `fromPersistedRow(row) → canonical shape`. Both paths funnel through it. Existing `[id]/route.ts` shims consolidated into it. Non-deterministic fields made deterministic OR excluded. Presentation-layer — stays within freeze. NOT optional.
- **D-12:** Fixture test — `toReadingBlocks(liveFixture)` deep-equals `toReadingBlocks(fromPersistedRow(persistedFixture))` for the same analysis, against **real persisted fixtures**, not hand-authored mocks.
- **D-13:** Output = discriminated union `ReadingBlock = { kind: 'verdict' | 'expert-insight' | ... ; ...data }` — pure data, no presentation hints (no className/layout/order). Phase 4 owns rendering.
- **D-14:** Two-tier degradation: individual signal absent (null field) → block omitted silently; whole-analysis degradation (`analysis_unavailable`/`partial_analysis`) → first-class honest block; retention specifically degrades rather than rendering a fabricated `Math.random` curve.

### Claude's Discretion
- Exact `ReadingBlock` union member names + per-block field shapes (D-13 sets the strategy).
- File layout within `lib/reading/` (view-model + normalizer + block types co-location).
- Whether `fromPersistedRow` lives in `lib/reading/` and `[id]/route.ts` imports it, vs a shared module — planner's call.
- Exact wording map for confidence band-language (D-06).
- Which `variants`-bag race conditions the normalizer must defensively handle (researcher maps — see Runtime State Inventory below).

### Deferred Ideas (OUT OF SCOPE)
- `emotion_arc` as a Reading block — dropped now (D-03); revisit Phase 4.
- `retrieval_evidence` "similar videos" surface — dropped; possible Phase 6 agentic tool.
- Persisting the real heatmap as a first-class column (migration) — a Phase 3+ migration decision, NOT a given for Phase 2 (which prefers pure normalizer + degradation).
- Band threshold *values* — Phase 2 exposes the constant; Phase 3 calibrates the numbers + buffer zones.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | Pure `lib/reading/view-model.ts` `toReadingBlocks()` mapping ~40 engine fields → ~10 value-bearing blocks | Field audit below maps every `PredictionResult` field → KEEP/DROP block; vitest unit-test convention (node env, `*.test.ts`) confirmed |
| DATA-02 | Both live `complete` path and persisted-row replay funnel through the SAME view-model → identical Reading | The two paths mapped exactly (`analyze/route.ts` buildInsertRow + variants merges; `[id]/route.ts` shims). `fromPersistedRow` design + deep-equal fixture strategy below; the intersection (D-09) exclusion list derived |
| DATA-03 | Consumed-vs-dead field prune documented (resolves F27/F28/F43) | Full consumed-vs-dead table in "Don't Hand-Roll" + Field Audit sections |
| DATA-04 | Verdict derivation (band + one-line why); `/100` demoted (resolves F41/F45) | `bandLabel`/`BAND_THRESHOLDS` located (two definitions, same numbers — must unify into `VERDICT_BANDS`); `hero.verdict_line` traced on both paths; fallback chain identified |

## Standard Stack

**No new packages.** This phase is pure in-repo TypeScript. The only "stack" is what already exists:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5 | The whole module (discriminated unions, exhaustive `kind` switches) | Already the project language [VERIFIED: package.json] |
| Vitest | ^4.0.18 | Unit-test the pure module + deep-equal fixture test | Project test runner; `pnpm test` → `vitest run` [VERIFIED: package.json scripts] |

**Installation:** None. `npm install` of any new package would violate the "pure presentation-layer, no engine, no new deps" boundary. If a planner proposes a dependency, that is a red flag for this phase.

**No Package Legitimacy Audit required** — zero external packages installed.

## Architecture Patterns

### System Architecture Diagram

```
                        ENGINE (FROZEN 3.19.0)
                                 │
                    aggregateScores() → PredictionResult
                                 │
           ┌─────────────────────┴──────────────────────┐
           │ (live)                                       │ (persist)
           ▼                                              ▼
  send("complete", finalResult)            buildInsertRow → analysis_results row
  src/app/api/analyze/route.ts:1101        (flattened cols + heatmap col)
           │                                  + RACING variants merges:
           │                                    persistCraftToVariants  (variants.craft)
           │                                    persistApolloToVariants (variants.apollo,
           │                                       variants.hero, variants.engagement_range)
           │                                              │
           ▼                                              ▼
  use-analysis-stream.ts                       GET /api/analysis/[id]/route.ts
  setResult(data as PredictionResult)          select("*") + RECONSTRUCTION SHIMS:
           │                                    • synthHeatmap()  ← Math.random() (NON-DETERMINISTIC)
           │                                    • recompute optimal_post_window (time/DB-dependent)
           │                                    • derive analysis_unavailable / confidence_label
           │                                              │
           │                                              ▼
           │                                    permalinkQuery → row JSON
           │                                              │
           └──────────────┬───────────────────────────────┘
                          │  ❌ TODAY: these two shapes DIVERGE (D-10)
                          ▼
       ╔══════════════════════════════════════════════════╗
       ║   NEW: lib/reading/   (Phase 2 — the crux)         ║
       ║                                                    ║
       ║  fromPersistedRow(row) ──► CanonicalReading ◄──────╫── canonicalFromLive(result)
       ║         (deterministic; absorbs the [id] shims)    ║
       ║                          │                         ║
       ║              toReadingBlocks(canonical)            ║
       ║              (pure; consumes ONLY live∩persisted)  ║
       ║                          │                         ║
       ╚══════════════════════════╪═════════════════════════╝
                                  ▼
                           ReadingBlock[]   (discriminated union, pure data)
                                  │
                        ┌─────────┴─────────┐
                   (Phase 4 UI)        (Phase 3 reads VERDICT_BANDS to calibrate)
```

### Recommended Project Structure
```
src/lib/reading/
├── block-types.ts       # ReadingBlock discriminated union + CanonicalReading shape (the contract)
├── verdict-bands.ts      # exported VERDICT_BANDS constant (D-04) — Phase 3 calibration target
├── from-persisted-row.ts # fromPersistedRow(row) → CanonicalReading (D-11; absorbs [id]/route shims)
├── view-model.ts         # toReadingBlocks(canonical) → ReadingBlock[] (DATA-01) + canonicalFromLive()
└── __tests__/
    ├── view-model.test.ts        # block taxonomy + degradation (D-14)
    ├── verdict.test.ts            # band + why derivation (DATA-04)
    └── identical-render.test.ts   # DATA-02 deep-equal across real fixtures (D-12)
        fixtures/
        ├── live-<id>.json         # captured from scripts/smoke-tiktok-pipeline.ts
        └── persisted-<id>.json    # same row read back through /api/analysis/[id]
```

### Pattern 1: Discriminated union with exhaustive narrowing (D-13)
**What:** Each block is `{ kind: '<literal>'; ...data }`; the union is `ReadingBlock`. Consumers (Phase 4) `switch (block.kind)` with a `never`-typed default for exhaustiveness.
**When to use:** Always for this output — it's the contract Phase 4 renders against.
**Example:**
```typescript
// Source: codebase pattern — mirrors CounterfactualResult discriminated union (lib/engine/types.ts:589)
export type ReadingBlock =
  | { kind: 'verdict'; band: VerdictBand; why: string; confidenceLanguage: string; score: number }
  | { kind: 'expert-insight'; ceiling: string | null; theOneFix: string | null; rewrites: ApolloRewrite[] }
  | { kind: 'hook'; weakestModality: string; segments: /* … */ }
  | { kind: 'retention'; segments: RetentionSegment[]; weightedCurve: number[] }
  | { kind: 'retention-degraded'; reason: 'heatmap_unavailable' }   // D-14 retention degrade
  | { kind: 'audience'; share: number; completion: number; comment: number; save: number; intents: string[] }
  | { kind: 'fixes'; items: Fix[] }
  | { kind: 'drivers'; factors: Factor[] }
  | { kind: 'persona-read'; aggregate: PersonaBehavioralAggregate }
  | { kind: 'content-summary'; text: string }
  | { kind: 'audio'; soundName: string; trendPhase: string | null }
  | { kind: 'analysis-degraded'; tier: 'unavailable' | 'partial'; have: string[] }; // D-14 whole-analysis
```

### Pattern 2: Canonical intermediate shape (the intersection enforcer)
**What:** `CanonicalReading` is the deliberately-narrow shape that contains ONLY live∩persisted fields. Both `fromPersistedRow` and `canonicalFromLive` produce it; `toReadingBlocks` only ever sees it.
**When to use:** This is how D-09 is *enforced by the type system* rather than by discipline. If a live-only field (e.g. `predicted_engagement`) isn't on `CanonicalReading`, `toReadingBlocks` literally cannot read it.
**Why it matters:** Makes the "consumes only the intersection" rule a compile-time guarantee, not a code-review hope.

### Anti-Patterns to Avoid
- **Reading raw `PredictionResult` directly in `toReadingBlocks`.** That re-admits live-only fields and breaks D-09. Always go through `CanonicalReading`.
- **Calling `synthHeatmap`-style `Math.random()` anywhere in the normalizer.** Non-determinism breaks the deep-equal test by construction (D-14).
- **Re-deriving band thresholds inline.** There are already TWO copies (`verdict-derive.bandLabel` and `verdict-constants.BAND_THRESHOLDS`). Adding a third makes drift worse. Extract ONE `VERDICT_BANDS` (D-04).
- **Putting presentation hints in blocks** (className/order/layout). D-13 forbids it; Phase 4 owns rendering.

## Field Audit — `PredictionResult` → KEEP / DROP (DATA-03)

> Source of truth: `src/lib/engine/types.ts` `PredictionResult` (read in full). This is the consumed-vs-dead map (resolves F27/F28/F43). [VERIFIED: src/lib/engine/types.ts]

| Field | Disposition | Block | Notes / both-path availability |
|-------|-------------|-------|-------------------------------|
| `overall_score` | KEEP (demoted) | verdict (in-body number) | Flattened DB column. **Both paths.** Drives band. |
| `confidence` / `confidence_label` | KEEP | verdict | `confidence_label` is a flattened column; `[id]/route` *also re-derives* it from `confidence` when absent — **reconcile to one source** (D-09: prefer the persisted column, fall back to deriving from `confidence`). |
| `anti_virality_gated` | KEEP | verdict (fires "Mixed signals" per D-07) | Flattened column. `[id]/route` re-derives from `confidence < 0.4` when absent — **non-deterministic-ish** (threshold drift). Prefer persisted column. |
| `analysis_unavailable` | KEEP | analysis-degraded (D-14) | NOT a column — derived from `signal_availability` JSONB on BOTH paths. Deterministic (pure boolean from `!gemini && !behavioral`). Safe. |
| `partial_analysis` | KEEP | analysis-degraded (D-14) | Derivable from `signal_availability` (`gemini !== behavioral`). **NOT currently derived in `[id]/route`** — normalizer must add it for parity. |
| `signal_availability` | KEEP (as input) | feeds degradation tiers | Flattened JSONB column. **Both paths.** |
| `hero` (`HeroBlock`) | KEEP | verdict (`verdict_line`, why), expert-insight (`ceiling`, `the_one_fix`) | **Lives in `variants.hero`** (racing write). Live: top-level `result.hero`. Persisted: `row.variants.hero`. Normalizer must read `variants.hero` defensively (may be absent if Apollo raced/failed). |
| `apollo_reasoning` | KEEP | expert-insight (the hero block of the body) | **Lives in `variants.apollo`** (racing). Live: top-level. Persisted: `row.variants.apollo`. Defensive read required. |
| `predicted_engagement` (`EngagementRange`) | **DROP** (live-only, D-09) | — | Live: top-level `result.predicted_engagement`. Persisted: `variants.engagement_range` (different key!). **This is the canonical live-only exclusion** — but see Live-Only list below; it's actually persisted under a different key, so the real issue is key-shape mismatch, not pure absence. Excluded from contract per D-02/D-09. |
| `hook_decomposition` | KEEP | hook | Flattened column (`buildInsertRow` persists it). **Both paths.** |
| `heatmap` (`HeatmapPayload`) | KEEP-conditional / DEGRADE | retention | Flattened `heatmap` column EXISTS and IS persisted (`buildInsertRow` line ~721). **BUT** `[id]/route` falls back to `synthHeatmap()` (Math.random) when the column is null. See Heatmap Reconstructability below — the column is the deterministic source; the synth is the problem. |
| `behavioral_predictions` | KEEP | audience | Flattened column. **Both paths.** |
| `persona_behavioral_aggregate` | KEEP | persona-read | Flattened column. **Both paths.** |
| `persona_simulation_results` | input-only | (feeds synthHeatmap today) | Persisted as `personas` column. Used only to synth heatmap on replay — once heatmap degrades-or-uses-column, not directly a block. |
| `suggestions` | KEEP | fixes | Flattened column. **Both paths.** |
| `counterfactuals` | KEEP | fixes (band-adaptive) | Flattened column. **Both paths.** |
| `factors[]` | KEEP | drivers | Flattened column. **Both paths.** |
| `overall_impression` / `content_summary` | KEEP | content-summary | **Live in `variants.craft`** (racing). Defensive read. |
| `audio_fingerprint` | KEEP-conditional | audio (only when matched) | Optional; null on most. Live top-level. Persisted: **not in `buildInsertRow`** — verify whether it survives (likely DROP-by-absence on replay → would BREAK intersection). **Open question — see below.** |
| `audio_signals` / `audio_perceptual_score` / `audio_description` | DROP (or input to audio) | — | `audio_description` is a column; the rest in `variants.craft`. Not a standalone block per D-01. |
| `optimal_post_window` | DROP from contract (or KEEP carefully) | — | Flattened column BUT `[id]/route` **recomputes** it (time + DB-dependent) when null → non-deterministic. D-01 list does NOT include a "when to post" block, so DROP is cleanest. If kept, use the persisted column only, never the recompute. |
| `emotion_arc` | DROP (D-03) | — | Column exists; overlaps retention. |
| `reasoning` | DROP (D-02) | — | `""`/null in prod (F43). |
| `rule_score` / `trend_score` / `gemini_score` / `ml_score` | DROP (D-02) | — | All null since F43 blend removal. |
| `feature_vector` | DROP | — | Internal signal backbone, not creator-facing. |
| `retrieval_score` / `retrieval_evidence` | DROP (D-03) | — | Corpus provenance; Phase 6 candidate. |
| `platform_fit` / `critique` | DROP (D-03) | — | Internal engine self-checks. |
| `matched_trends` | DROP (D-02) | — | — |
| `score_weights` | DROP | — | Blend internals. |
| `verbatim` | DROP (or input to hook) | — | Column exists; hook block can cite it but D-01 doesn't list a standalone verbatim block. |
| `warnings` | KEEP (optional) | could fold into verdict/fixes | Flattened column. Both paths. Planner's call whether it's a block. |
| meta (`latency_ms`, `cost_cents`, `engine_version`, models, `input_mode`, `has_video`, `mode`) | DROP | — | Telemetry / provenance, not Reading content. |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Band from score | A new threshold function | Extract the EXISTING `bandLabel` (verdict-derive.ts:25) thresholds into `VERDICT_BANDS` | Two copies already exist (verdict-derive `≥70/≥40`, verdict-constants `BAND_THRESHOLDS 70/40`); a third = guaranteed drift. D-04 mandates one constant. |
| "Why this score" driver/risk | New factor-ranking logic | `deriveVerdictSummary` (verdict-constants.ts:81) pattern + `hero.verdict_line` | The fallback chain (top factor rationale / `the_one_fix`) already has a precedent in `deriveVerdictSummary` + `deriveGatedHero`. |
| Behavioral tiles | New pct extraction | `deriveBehavioralTiles` (verdict-derive.ts:102) shape | Already handles the "absolute %, omit when absent, never fabricate" discipline (D-14). |
| Confidence visualization | A new hedge string | `confidenceRange` (verdict-derive.ts:19) + a HIGH/MED/LOW→language map (D-06) | The honest-uncertainty pattern exists; D-06 wants language not number. |
| Heatmap reconstruction | A new synth | The persisted `heatmap` column (deterministic) OR a degraded block | `synthHeatmap()` in `[id]/route.ts` uses `Math.random()` — copying it re-introduces non-determinism that breaks D-12. |
| Replay shape reconstruction | Re-implementing `[id]/route` shims | `fromPersistedRow` (the phase's whole point, D-11) | The shims are the problem surface; consolidate, don't duplicate. |

**Key insight:** The hard work here is *deletion and consolidation*, not construction. Most fields DROP. The verdict/behavioral/degradation logic already exists in `verdict-derive.ts` and just needs to be (a) made pure-and-path-agnostic and (b) sourced from `CanonicalReading` instead of raw `PredictionResult`.

## Runtime State Inventory (replay-shape reconstruction surface — D-10/D-11)

> This is a refactor/contract-consolidation phase, so the inventory is the `variants`-bag race surface and the reconstruction shims, NOT OS/DB renames.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data (flattened columns — deterministic, safe) | `overall_score`, `confidence`, `confidence_label`, `anti_virality_gated`, `behavioral_predictions`, `factors`, `suggestions`, `counterfactuals`, `hook_decomposition`, `heatmap`, `signal_availability`, `persona_behavioral_aggregate`, `personas`, `optimal_post_window`, `emotion_arc`, `verbatim`, `audio_description`, `warnings`, `reasoning` — all on `analysis_results` Row [VERIFIED: database.types.ts:218-273] | `fromPersistedRow` reads these directly; no reconstruction needed. |
| Live service config (`variants` JSONB bag — RACING writers) | `variants.apollo` (`persistApolloToVariants`), `variants.hero` (same writer), `variants.engagement_range` (same writer), `variants.craft` (`persistCraftToVariants` → `video_signals`/`cta_segment`/`audio_signals`/`audio_perceptual_score`/`overall_impression`/`content_summary`), `variants.remix.decode`, `variants.filmstrip_segments` (filmstrip extract route) [VERIFIED: analyze/route.ts:156-313] | Normalizer must read each `variants.*` **defensively** (any can be absent if its async writer failed/raced). The Apollo+hero+engagement_range writer fires AFTER the `complete` SSE, so on a freshly-completed live run these may be absent client-side but present on later reload — a real live≠replay timing gap. |
| OS-registered state | None — pure presentation-layer module, no OS/service registration. | None. |
| Secrets/env vars | None — no new env vars; the module reads no secrets. (`[id]/route` reads `creator_profiles` for `optimal_post_window` recompute, which the normalizer should NOT replicate — drop the field instead.) | None. |
| Build artifacts | None — no package rename, no egg-info equivalent. New `lib/reading/` dir only. | None. |

**The canonical reconstruction problem (verbatim from the code):**
- `synthHeatmap()` (`[id]/route.ts:76-124`) — **NON-DETERMINISTIC**: persona id fallback is `` `persona-${Math.random().toString(36)...}` `` (line 102); attention curves are synthetic (base from `watch_through_pct`, ×0.3 after drop). This fabricates retention. → D-14 retention must degrade, not synth.
- `optimal_post_window` recompute (`[id]/route.ts:153-172`) — **TIME + DB-dependent**: calls `computeOptimalPostWindow(service, niche, null)` at load time. Same row reloaded at a different time / after the daily `pg_cron` refresh can differ. → DROP from contract (not in D-01's ~10 blocks anyway).
- `analysis_unavailable` derive (`[id]/route.ts:142-144`) — **deterministic** (`!sa.gemini && !sa.behavioral`). Safe to keep in normalizer.
- `confidence_label` / `anti_virality_gated` derive (`[id]/route.ts:178-190`) — threshold-based fallbacks (`>=0.7`/`>=0.4`, `<0.4`). Deterministic but **must match the engine's own thresholds** or live≠replay. Prefer the persisted column; only derive when the column is genuinely null on old rows.

## Common Pitfalls

### Pitfall 1: `predicted_engagement` is "live-only" but actually persisted under a different key
**What goes wrong:** D-09 names `predicted_engagement` (R11) as the canonical live-only field. But it IS persisted — into `variants.engagement_range`, not as `result.predicted_engagement`. A naive normalizer that maps `variants.engagement_range → predicted_engagement` would re-admit it; a naive one that ignores it loses parity if a future block wants it.
**Why it happens:** Same datum, two key paths (live top-level vs persisted `variants` key). The shape also differs from the deprecated point `PredictedEngagement`.
**How to avoid:** Per D-02/D-09, **exclude it from `CanonicalReading` entirely** — don't map it either way. Document it as "excluded by decision, persisted under `variants.engagement_range`."
**Warning sign:** A `predicted_engagement` field appearing on `CanonicalReading`.

### Pitfall 2: Apollo/hero/craft absent on the FRESH live run (write-after-complete race)
**What goes wrong:** `persistApolloToVariants` / `persistCraftToVariants` run AFTER `send("complete", finalResult)` (analyze/route.ts:1025-1028). On the live path the client already has `result.apollo_reasoning`/`result.hero` top-level, so it's fine live. But a permalink reload moments later might race the write and read absent `variants.apollo`. The deep-equal test must use a row where the variants writes have SETTLED.
**Why it happens:** Fire-after-response persistence for non-blocking latency.
**How to avoid:** Capture the persisted fixture by reading the row AFTER the writes complete (the smoke script's run finishes the request; read the DB row a beat later, or assert `variants.apollo != null` before snapshotting). Normalizer reads `variants.*` defensively → degrades the block rather than throwing.
**Warning sign:** Flaky deep-equal test that passes/fails by timing.

### Pitfall 3: `heatmap` column present live but synth on replay
**What goes wrong:** `buildInsertRow` persists `finalResult.heatmap` into the `heatmap` column (line ~721), so the REAL heatmap survives. But `[id]/route` only uses it `?? synthHeatmap()` — and old rows / rows where heatmap was null get the Math.random synth. If `fromPersistedRow` copies that `?? synth` logic, replay diverges from live.
**How to avoid:** `fromPersistedRow` reads the `heatmap` column ONLY. If null → `retention-degraded` block (D-14). Never synth. Live path passes `result.heatmap` straight through (same null → same degrade).
**Warning sign:** A retention block on a row whose `heatmap` column is null.

### Pitfall 4: Two band-threshold definitions, one new constant
**What goes wrong:** `bandLabel` (verdict-derive.ts) returns 'High potential'/'Solid contender'/'Needs work' at ≥70/≥40; `BAND_THRESHOLDS`/`bandFromScore` (verdict-constants.ts) returns 'Strong'/'Mid'/'Low' at 70/40. Same numbers, different labels, two files. Phase 3 must tune ONE.
**How to avoid:** Create `VERDICT_BANDS` in `lib/reading/verdict-bands.ts` as the single source `{ label, min }[]`. Have the view-model import it. Leave the legacy board copies for now (they're board-only; the freeze is on engine, not these), but note them so they don't drift further.
**Warning sign:** Phase 3 calibration editing a board file instead of `VERDICT_BANDS`.

### Pitfall 5: `confidence` stored as string on some rows
**What goes wrong:** `[id]/route.ts:56-61` defensively `Number.parseFloat`s `confidence`/`overall_score` because some rows store them as strings. A normalizer that assumes `number` will mis-derive bands.
**How to avoid:** `fromPersistedRow` must coerce numeric columns (mirror the route's `typeof === "string" ? parseFloat` guard).
**Warning sign:** Band derived from a string score.

## Code Examples

### VERDICT_BANDS extraction (D-04)
```typescript
// Source: extracted from verdict-derive.ts:25 bandLabel + verdict-constants.ts:4 BAND_THRESHOLDS (same numbers)
// Phase 3 calibrates THIS array (adds buffer zones / "Mixed signals" boundary).
export interface VerdictBand { id: 'high' | 'solid' | 'needs-work'; label: string; min: number; }
export const VERDICT_BANDS: readonly VerdictBand[] = [
  { id: 'high',       label: 'High potential',  min: 70 },
  { id: 'solid',      label: 'Solid contender', min: 40 },
  { id: 'needs-work', label: 'Needs work',      min: 0  },
] as const;
export function bandFor(score: number): VerdictBand {
  return VERDICT_BANDS.find((b) => score >= b.min) ?? VERDICT_BANDS[VERDICT_BANDS.length - 1]!;
}
```

### The "why" fallback chain (D-05)
```typescript
// Source: hero.verdict_line (types.ts:289) preferred; fallback mirrors deriveVerdictSummary (verdict-constants.ts:81)
function deriveWhy(c: CanonicalReading): string {
  if (c.hero?.verdict_line) return c.hero.verdict_line;        // engine-authored, grounded
  if (c.hero?.the_one_fix)  return c.hero.the_one_fix;          // highest-leverage rewrite
  const top = [...(c.factors ?? [])].sort((a, b) => b.score - a.score)[0];
  if (top?.rationale) return top.rationale;                     // top-weighted factor
  // NEVER a generic string — if nothing grounds it, the verdict block carries band only.
  return '';
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline shims in `[id]/route.ts` reconstruct replay shape | Single pure `fromPersistedRow` both paths funnel through | This phase (D-11) | Replay becomes deterministic + testable |
| `synthHeatmap()` Math.random fabrication | Persisted `heatmap` column OR degraded block | This phase (D-14) | Retention stops lying |
| Three parallel scorecards / naked `/100` | ONE verdict block (band + why), number demoted | This phase (DATA-04, F36/F41/F45) | Trust |
| Two band-threshold copies | One exported `VERDICT_BANDS` | This phase (D-04) | Phase 3 has a single calibration target |

**Deprecated/outdated:**
- `PredictedEngagement` (point shape, types.ts:245) — `@deprecated`, replaced by `EngagementRange`. Both excluded from the contract anyway (D-02).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `audio_fingerprint` is NOT in `buildInsertRow`, so it does not survive to the persisted row and would break the intersection if KEPT | Field Audit / Open Questions | If it IS persisted somewhere I missed, the audio block could be KEEP-both-paths instead of live-only-DROP. Verify before finalizing the audio block. [ASSUMED — based on reading buildInsertRow; grep for `audio_fingerprint` persistence not exhaustively run] |
| A2 | The `complete` SSE payload (`finalResult`) carries `variants` fields top-level (e.g. `result.apollo_reasoning`, `result.hero`) so the LIVE canonical can read them without touching `variants` | Pitfall 2 | If the live `finalResult` does NOT include `hero`/`apollo_reasoning` top-level (only persisted later), then live and replay both source from different places and the canonical mapping per-path differs. The aggregator assigns `hero` on every run (types.ts:360 comment), so this is likely safe, but confirm `finalResult.hero`/`finalResult.apollo_reasoning` are populated at `send("complete")` time. [ASSUMED] |
| A3 | The persisted `heatmap` column reliably holds the real `HeatmapPayload` for fresh rows (not null), so retention is usually a real block, degrading only on old/failed rows | Heatmap pitfall | If heatmap is frequently null on real rows, retention degrades far more often than expected and the block is rarely useful. Measure on real fixtures. [ASSUMED] |
| A4 | No new npm package is needed | Standard Stack | Effectively zero risk — pure TS transform. |

## Open Questions

1. **Does `audio_fingerprint` survive to the persisted row?**
   - What we know: `buildInsertRow` (analyze/route.ts:656-747) does NOT list `audio_fingerprint`; `persistCraftToVariants` persists `audio_signals`/`audio_perceptual_score` but not `audio_fingerprint`.
   - What's unclear: whether it lands in `variants` via another writer, or is genuinely live-only.
   - Recommendation: grep the full persist surface during planning; if live-only, the audio block must be DROPPED (D-09) — it cannot be a both-path block. Update D-01 #10 accordingly (it's already "conditional-render"; "live-only → dropped" is a stronger ruling).

2. **Are `result.hero` / `result.apollo_reasoning` present on the LIVE `complete` payload, or only after the post-complete `variants` write?** (See A2.) Trace `aggregateScores` return to confirm `hero` is assigned before `send("complete")`. If yes, the live canonical reads top-level; the persisted canonical reads `variants.hero` — both resolve to the same object → deep-equal holds.

3. **Real-fixture capture path.** `scripts/smoke-tiktok-pipeline.ts` already writes the live `PredictionResult` JSON to `scripts/validations/video-NN.json` (line 518). The persisted counterpart must be read back from `/api/analysis/[id]` for the SAME analysis id. Recommendation: the plan adds a tiny capture step (or extends the smoke script) to also dump the `/api/analysis/[id]` JSON for the row the smoke run created — giving a genuine (live, persisted) pair for the D-12 test. **Do not hand-author** the persisted fixture (success criterion 1+2 forbids mocks).

## Validation Architecture

> nyquist_validation is enabled (config.json `workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 [VERIFIED: package.json] |
| Config file | `vitest.config.ts` (node env default; `*.test.ts`/`*.test.tsx`; `@/` alias) [VERIFIED] |
| Quick run command | `pnpm test -- src/lib/reading` (or `npx vitest run src/lib/reading`) |
| Full suite command | `pnpm test` (→ `vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | `toReadingBlocks(canonical)` returns ~10 value-bearing blocks; drops dead fields | unit | `npx vitest run src/lib/reading/__tests__/view-model.test.ts` | ❌ Wave 0 |
| DATA-02 | live and replay yield IDENTICAL blocks for same analysis (deep-equal, real fixtures) | unit (contract) | `npx vitest run src/lib/reading/__tests__/identical-render.test.ts` | ❌ Wave 0 |
| DATA-03 | consumed-vs-dead documented (the map in this RESEARCH); assert no dropped field leaks into a block | unit | covered by view-model.test.ts (assert absent block kinds for dropped fields) | ❌ Wave 0 |
| DATA-04 | verdict = band + grounded why; `/100` only in-body, never the headline | unit | `npx vitest run src/lib/reading/__tests__/verdict.test.ts` | ❌ Wave 0 |
| D-14 | individual-null → omit; whole-degradation → honest block; heatmap null → degrade not synth | unit | view-model.test.ts (degradation cases) | ❌ Wave 0 |

### The DATA-02 identical-render contract test (the crux)
```typescript
// identical-render.test.ts — the load-bearing test
import live from './fixtures/live-<id>.json';          // captured from smoke-tiktok-pipeline
import persisted from './fixtures/persisted-<id>.json'; // SAME row via /api/analysis/[id]
import { toReadingBlocks, canonicalFromLive } from '../view-model';
import { fromPersistedRow } from '../from-persisted-row';

it('live Reading deep-equals re-opened resting document', () => {
  const liveBlocks    = toReadingBlocks(canonicalFromLive(live as PredictionResult));
  const replayBlocks  = toReadingBlocks(fromPersistedRow(persisted));
  expect(replayBlocks).toEqual(liveBlocks);  // deep structural equality
});
```

### Signals per block — "correctly rendered" vs "degraded"
| Block | Rendered when | Degraded/omitted when |
|-------|---------------|------------------------|
| verdict | `overall_score` present (always) | never omitted; "Mixed signals" when `anti_virality_gated` or boundary score |
| expert-insight | `variants.apollo`/`hero` present with `ceiling` or `the_one_fix` | omitted when Apollo absent (raced/failed) |
| hook | `hook_decomposition` non-null | omitted when null |
| retention | `heatmap` column non-null | **`retention-degraded` block** when null (NEVER synth) |
| audience | `behavioral_predictions.*_pct` numeric | per-tile omit when a pct absent |
| fixes | `suggestions` or `counterfactuals.suggestions` non-empty | omitted when both empty |
| drivers | `factors[]` non-empty | omitted when empty |
| persona-read | `persona_behavioral_aggregate` non-null | omitted when null |
| content-summary | `variants.craft.overall_impression`/`content_summary` present | omitted when absent |
| audio | `audio_fingerprint` matched (pending Open Q1) | omitted when no match / live-only |
| analysis-degraded | `analysis_unavailable` or `partial_analysis` true | absent on healthy runs |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/reading` (the new module's tests)
- **Per wave merge:** `pnpm test` (full vitest suite — ensures no board regression from the `VERDICT_BANDS` extraction / `[id]/route` refactor)
- **Phase gate:** Full suite green + the DATA-02 deep-equal test green against REAL fixtures before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `src/lib/reading/__tests__/identical-render.test.ts` — DATA-02 deep-equal (needs real fixtures)
- [ ] `src/lib/reading/__tests__/view-model.test.ts` — DATA-01/DATA-03/D-14
- [ ] `src/lib/reading/__tests__/verdict.test.ts` — DATA-04
- [ ] `src/lib/reading/__tests__/fixtures/live-<id>.json` + `persisted-<id>.json` — REAL captured pair (extend `scripts/smoke-tiktok-pipeline.ts` to also dump the `/api/analysis/[id]` row)
- [ ] No framework install needed (Vitest present).

## Environment Availability

> The pure module has no runtime dependencies. Capturing REAL fixtures (D-12) does require live infra.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vitest | unit tests | ✓ | ^4.0.18 | — |
| TypeScript | the module | ✓ | ^5 | — |
| Live engine + Supabase (smoke run) | capturing the REAL fixture pair (D-12) | ⚠ requires API keys / deployed or local stack | — | Use an existing captured `scripts/validations/video-NN.json` as the LIVE half + read its row back; if no real row exists, the deep-equal test is BLOCKED on capture (do NOT substitute a hand-authored mock — that fails success criteria 1+2) |

**Missing dependencies with no fallback:** A real (live, persisted) fixture pair for the same analysis id. This is the single execution prerequisite — the plan must include a capture step. Existing `src/test/fixtures/*` and `verdict/__tests__/fixtures/*` are **hand-authored mocks** (stale `predicted_engagement` point shape, null/absent `apollo_reasoning`/`hero`/`heatmap`) and are NOT acceptable for D-12.

## Security Domain

> `security_enforcement` not present in config.json → treat as default. This phase is a pure data transform with NO new I/O, NO new endpoints, NO new packages, NO secret handling.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Module never authenticates; `[id]/route` keeps its existing `user_id`-scoped SELECT |
| V3 Session Management | no | — |
| V4 Access Control | indirect | The normalizer must NOT widen what `[id]/route` returns; the route's `.eq("user_id", user.id)` ownership filter (and the `?summary` cross-user guard) stay intact — `fromPersistedRow` operates on an already-authorized row |
| V5 Input Validation | yes (light) | Defensive reads of `variants.*` (may be absent/partial); numeric coercion of string `confidence`/`overall_score`; no trust of shape beyond the row already validated at write time |
| V6 Cryptography | no | — |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Normalizer throws on a partial/missing `variants` bag → 500 on permalink reload | Denial of Service | Defensive optional-chaining + degrade-to-block (D-14); never throw on absent optional fields |
| Refactor accidentally drops the `[id]/route` `user_id` ownership filter when extracting shims | Elevation of Privilege | Keep the SELECT + `.eq("user_id")` in the route; `fromPersistedRow` receives the already-scoped row, performs no DB I/O itself |

## Sources

### Primary (HIGH confidence — read directly in this session)
- `src/lib/engine/types.ts` — full `PredictionResult` + `HeroBlock` + `HeatmapPayload` + `EngagementRange` + `SignalAvailability`
- `src/app/api/analyze/route.ts` — live `complete` (L1101), `buildInsertRow` (L656-747), `persistCraftToVariants`/`persistApolloToVariants`/`persistDecodeToVariants` (variants races)
- `src/app/api/analysis/[id]/route.ts` — `synthHeatmap` (L76-124, Math.random L102), recomputed `optimal_post_window` (L153-172), derived `analysis_unavailable`/`confidence_label`/`anti_virality_gated`
- `src/hooks/queries/use-analysis-stream.ts` — `setResult(data as PredictionResult)` (L246), permalink hydration (L491-555)
- `src/components/board/verdict/verdict-derive.ts` — `bandLabel`/`bandTone`/`confidenceRange`/`deriveBehavioralTiles`/`deriveGatedHero`
- `src/components/board/verdict/verdict-constants.ts` — `BAND_THRESHOLDS`/`bandFromScore`/`deriveVerdictSummary`
- `src/types/database.types.ts` — `analysis_results` Row/Insert/Update (flattened cols + `variants` JSONB)
- `src/lib/engine/__tests__/factories.ts`, `src/test/fixtures/completed-prediction.ts`, `src/components/board/verdict/__tests__/fixtures/prediction-result.ts` — confirmed all hand-authored mocks
- `vitest.config.ts`, `package.json` — test runner + scripts
- `.planning/{02-CONTEXT,REQUIREMENTS,ROADMAP,NUMEN-SURFACE-VISION}.md`, `01-CONTEXT.md` — decisions/scope
- `scripts/smoke-tiktok-pipeline.ts` — writes live `PredictionResult` JSON (the live-fixture capture path)

### Secondary / Tertiary
- None — no external/web sources needed for an in-repo pure-transform phase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; runner verified in package.json
- Field audit / two paths: HIGH — both routes + types read in full; the two open questions (audio_fingerprint persistence, live-payload hero presence) are flagged, not assumed-resolved
- Pitfalls: HIGH — every pitfall cites a specific line in the read code (Math.random, recompute, two band copies, string confidence)
- Real-fixture capture: MEDIUM — the path exists (smoke script writes live JSON) but the persisted-half capture step must be added by the plan; live infra access is the one execution gate

**Research date:** 2026-06-12
**Valid until:** ~2026-07-12 (stable — engine frozen; only risk is the two open questions being resolved during planning)

## RESEARCH COMPLETE

**Phase:** 2 - View-Model + Data Contract (ENG-06 D-12)
**Confidence:** HIGH

### Key Findings
- **DATA-02 is FALSE today (D-10 confirmed):** `[id]/route.ts` reconstructs four fields at replay time; `synthHeatmap()` uses `Math.random()` (L102) for persona ids → live and replay structurally diverge. The phase exists to fix exactly this with a deterministic `fromPersistedRow`.
- **Enforce D-09 with the type system:** introduce a narrow `CanonicalReading` shape (live∩persisted only) that `toReadingBlocks` consumes; live-only fields (`predicted_engagement`, recomputed `optimal_post_window`, synth heatmap) physically can't enter. `predicted_engagement` is actually persisted under a *different* key (`variants.engagement_range`) — exclude it by decision, not by absence.
- **Don't build, consolidate:** band logic exists in TWO files (`verdict-derive.bandLabel` + `verdict-constants.BAND_THRESHOLDS`, same numbers, different labels) — extract ONE `VERDICT_BANDS` (D-04). Behavioral/confidence/why derivations already exist in `verdict-derive.ts`; make them pure + path-agnostic.
- **Heatmap degrades, never synths (D-14):** the real `heatmap` column IS persisted; `fromPersistedRow` reads it directly and emits `retention-degraded` when null — never the Math.random synth.
- **Real fixtures are missing:** all existing fixtures are hand-authored mocks (stale shapes). D-12 demands a real (live, persisted) pair — capturable by extending `scripts/smoke-tiktok-pipeline.ts` to also dump `/api/analysis/[id]`. This is the one execution prerequisite.

### File Created
`.planning/phases/02-view-model-data-contract-eng-06-d-12/02-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | No new deps; Vitest ^4 verified |
| Architecture / two paths | HIGH | Both routes + types read in full; divergence pinpointed to specific lines |
| Pitfalls | HIGH | Each cites a line in read code |
| Real-fixture capture | MEDIUM | Path exists; persisted-half capture step must be added by the plan; needs live infra |

### Open Questions (carry into planning)
1. Does `audio_fingerprint` survive to the persisted row? If live-only → audio block must be DROPPED (D-09), not just conditional-render.
2. Are `result.hero` / `result.apollo_reasoning` on the LIVE `complete` payload (vs only post-complete `variants` write)? Confirms whether live and replay canonical mappings converge on the same object.
3. Real-fixture capture step — extend the smoke script to dump the persisted `/api/analysis/[id]` row for the same id.

### Ready for Planning
Research complete. The planner can create PLAN.md files: Wave 0 = test scaffolding + real-fixture capture; then `block-types.ts` + `verdict-bands.ts`, `from-persisted-row.ts` (absorbing the `[id]/route` shims), `view-model.ts`, and the DATA-02 deep-equal contract test. Resolve the two open questions early — they change the audio block ruling and confirm the convergence proof.
