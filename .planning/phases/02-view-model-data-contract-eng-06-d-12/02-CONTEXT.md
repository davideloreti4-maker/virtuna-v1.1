# Phase 2: View-Model + Data Contract (ENG-06 D-12) - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning

<domain>
## Phase Boundary

One **pure module** maps the engine's ~40-field `PredictionResult` → **~10 value-bearing Reading blocks + a verdict (band + why)**, and BOTH the live `complete` SSE path and the persisted-row replay path funnel through it — so a live Reading and its re-opened resting document are **identical**. This is the architectural crux; it ships before any UI consumes it (Phase 4).

The engine (v4.1, `ENGINE_VERSION` **3.19.0**) is **FROZEN** — this phase is presentation-layer only: **no `lib/engine/` edits, no `ENGINE_VERSION` bump.** All work re-composes existing engine output.

**In scope:** `lib/reading/view-model.ts` `toReadingBlocks()` (pure, no React/no fetch); the ReadingBlock type union; a pure deterministic **reload-normalizer** (`fromPersistedRow`) that both paths feed through; consolidation of the existing ad-hoc replay shims; the consumed-vs-dead field-prune doc; verdict (band + why) derivation.
**Out of scope:** any Reading/thread UI (Phase 4); the SMOKE GATE + band-threshold *calibration values* (Phase 3 tunes the constant this phase exposes); ingestion/shell (Phase 5); engine internals (frozen).
</domain>

<decisions>
## Implementation Decisions

### A. Block Taxonomy + Borderline Keeps (DATA-01 / DATA-03)
- **D-01:** **~10 value-bearing KEEP blocks** the Reading exposes:
  1. **Verdict** — band + why + confidence (the throne; derivation in §B)
  2. **Expert insight** — `apollo_reasoning` (rewrites + ceiling / the-one-fix) — **foregrounded, not buried** (vision wedge; Apollo is the interpreter)
  3. **Hook** — `hook_decomposition` (weakest modality + per-segment)
  4. **Retention / beats** — `heatmap` (segments + weighted curve) — **conditional on §C normalizer resolving heatmap deterministically; else degrades (D-13)**
  5. **Audience behavior** — `behavioral_predictions` 4-pct (Share / Completion / Comment / Save) + intent chips
  6. **Fixes** — `suggestions` + `counterfactuals.suggestions` (band-adaptive)
  7. **Drivers** — `factors[]` (the 5 graded factors w/ rationale)
  8. **Persona read** — `persona_behavioral_aggregate` (the ~7/10 archetype aggregate, qualitative)
  9. **Content summary** — `overall_impression` / `content_summary` (editorial one-liner)
  10. **Audio** — `audio_fingerprint` trending-sound match *(conditional-render: only when matched)*
- **D-02:** **DROP set (dead / never-rendered):** `rule_score`, `trend_score`, `gemini_score`, `ml_score` (all null since blend removed, F43), `reasoning` (`""` in prod), `predicted_engagement` (live-only — see D-09), raw `component_scores`, `matched_trends`, `retrieval_score` / `retrieval_evidence`, `platform_fit`, `critique`, `emotion_arc`.
- **D-03:** **Borderline rulings:** `emotion_arc` → DROP (overlaps retention; revisit Phase 4 if UI wants it). `retrieval_evidence` ("similar videos") → DROP (corpus-match provenance, sparse, not creator-facing insight). `platform_fit` / `critique` → DROP (internal engine self-checks). `audio_fingerprint` → KEEP but conditional-render (high value when present, absent on most). The prune is driven by **what the Reading consumes**, documented as a consumed-vs-dead map (DATA-03, resolves F27/F28/F43).

### B. Verdict Derivation + Band Source (DATA-04 / F41 / F45)
- **D-04:** **Band** from `bandLabel(overall_score)` — **reuse the existing thresholds** (≥70 High potential / 40–69 Solid contender / <40 Needs work) but **extract them into a single exported constant** (e.g. `VERDICT_BANDS`) that **Phase 3 calibration tunes**. Do not re-derive band logic.
- **D-05:** **The "why"** → prefer engine-authored `hero.verdict_line` (grounded in a real signal). Deterministic fallback when `hero` is absent: derive from the top-weighted `factor` rationale or `the_one_fix`. **Never a generic string.**
- **D-06:** **Confidence in the band's language, not a number** (vision §5). Map `confidence_label` HIGH/MED/LOW → wording, not a `/100` or a hedge.
- **D-07:** **"Mixed signals" is a first-class band** — fired by `anti_virality_gated` OR a boundary score within Phase-3's buffer zone. The `/100` number is **demoted to in-body supporting evidence only** (resolves F41/F45; the throne shows judgment, not a metric).

### C. Identical-Render Contract (DATA-02) — THE CRUX
- **D-08:** **Call-site = client-at-mount, both paths.** Live → `toReadingBlocks(stream.result)`; replay → `toReadingBlocks(fromPersistedRow(row))`. `toReadingBlocks` is pure — no React, no fetch inside. *Rejected: server emits a `reading_blocks` SSE event — replay can't re-emit, so live would structurally diverge from replay.*
- **D-09:** **Hard rule — the contract consumes only the field intersection of live ∩ persisted shapes.** Any live-only field (`predicted_engagement` R11; audit all `[id]/route.ts` reload-derived fields) is **excluded from `toReadingBlocks` inputs**. This is the load-bearing rule of the phase.
- **D-10:** **AUDIT FINDING — DATA-02 is currently FALSE for reconstructed fields.** The replay route (`src/app/api/analysis/[id]/route.ts`) does **not** return the raw row — it actively reconstructs: `synthHeatmap()` fabricates a heatmap (incl. `Math.random()` persona ids + default watch-through), `optimal_post_window` is **recomputed** at load time, `analysis_unavailable` is derived. Apollo/hero live in a **racing `variants` JSONB bag** (async merges that race with filmstrip extraction), not top-level columns. So for any block built on a reconstructed field, live ≠ replay today.
- **D-11:** **Resolution — Phase 2 introduces a single pure, deterministic reload-normalizer** `fromPersistedRow(row) → canonical shape`. BOTH paths funnel the view-model through the canonical shape. The existing ad-hoc shims in `[id]/route.ts` get **consolidated into / replaced by** this normalizer. Any field not deterministically reconstructable (random ids, time-dependent recompute) is either **made deterministic** or **excluded from the contract** (D-09). This normalizer is presentation-layer, not engine — **stays within the freeze**. It is NOT optional polish: DATA-02 cannot be satisfied without it.
- **D-12:** **Fixture test** asserts `toReadingBlocks(liveFixture)` deep-equals `toReadingBlocks(fromPersistedRow(persistedFixture))` for the same analysis — unit-tested against **real persisted fixtures**, not hand-authored mocks (success criterion 1 + 2).

### D. Block Shape + Degraded Signals
- **D-13:** **Output = a discriminated union** `ReadingBlock = { kind: 'verdict' | 'expert-insight' | 'hook' | 'retention' | ... ; ...data }` — **pure data, no presentation hints** (no className/layout/order-for-render). Phase 4 UI owns rendering; the view-model owns *what is true*. Keeps it pure + testable.
- **D-14:** **Two-tier degradation** (matches the existing `verdict-derive.ts` "omit what isn't present, never fabricate" philosophy):
  - **Individual signal absent** (a null field) → that block is **omitted silently**. No empty shells.
  - **Whole-analysis degradation** (`analysis_unavailable` / `partial_analysis` true) → a **first-class honest block** ("couldn't fully read this — here's what we have"). The anxious-creator audience needs the honesty, not a mysteriously short Reading.
  - **Retention specifically (D-01 #4):** if the normalizer can't resolve `heatmap` faithfully, retention **degrades** rather than rendering a fabricated `Math.random` curve.

### Claude's Discretion
- Exact `ReadingBlock` union member names + per-block field shapes (D-13 sets the strategy).
- File layout within `lib/reading/` (view-model + normalizer + block types co-location).
- Whether `fromPersistedRow` lives in `lib/reading/` and `[id]/route.ts` imports it, vs a shared module — planner's call.
- Exact wording map for confidence band-language (D-06).
- Which `variants`-bag race conditions the normalizer must defensively handle (researcher maps).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- `.planning/ROADMAP.md` → Phase 2 (goal + 4 success criteria) and the Phase 3 gate that consumes this contract
- `.planning/REQUIREMENTS.md` → DATA-01, DATA-02, DATA-03, DATA-04 (4 requirements, all Phase 2)

### Authoritative vision (the WHY — locked, do not relitigate)
- `.planning/NUMEN-SURFACE-VISION.md` §"What the verdict says" (band + one-sentence why; confidence in band language; number demoted) — grounds D-04…D-07
- `.planning/NUMEN-SURFACE-VISION.md` §F-table (F36/F41/F43/F45) — the contract collapses three scorecards to ONE verdict + re-composes only value-bearing fields
- `.planning/phases/01-design-system-foundation-brand-migration/01-CONTEXT.md` — Phase 1 token/type direction (verdict scale green/amber/clay) informs block shapes; D-11 there = the same band scale this phase exposes as a constant

### Engine output shape (the INPUT — read before writing the view-model)
- `src/lib/engine/types.ts` — `PredictionResult` interface (~50 fields). Key: `HeroBlock` (L285, `verdict_line` L289), `predicted_engagement` (L315, live-only), `hero?` (L362, persisted to `variants.hero`), `analysis_unavailable` (L378), `partial_analysis` (L387). The full consumed-vs-dead source of truth.

### The two funnel paths (the CONTRACT — both must yield identical blocks)
- `src/app/api/analyze/route.ts` — live `complete` path: `aggregateScores` → `send("complete", finalResult)` (~L1101); `buildInsertRow` + the racing `variants` merges (craft ~L142, apollo+hero ~L209-256, engagement_range). Where the live result is emitted + persisted.
- `src/app/api/analysis/[id]/route.ts` — **replay path + the reconstruction shims** (`synthHeatmap` L76-124, recomputed `optimal_post_window` L153-170, derived `analysis_unavailable` L142-144). **This is the D-10/D-11 problem surface** — these shims get consolidated into the normalizer.
- `src/app/api/analysis/history/route.ts` — list/summary path (Phase 5 home; not consumed here but shares the row shape)
- `src/hooks/queries/use-analysis-stream.ts` (~L245-256) — live receipt: `setResult(data as PredictionResult)`; where `toReadingBlocks` would be called at mount (D-08)
- `src/types/database.types.ts` (~L218-327) — `analysis_results` row shape (flattened columns + `variants` JSONB bag); the persisted-vs-live divergence source

### Existing verdict/derivation logic to REUSE (do not rebuild)
- `src/components/board/verdict/verdict-derive.ts` — `bandLabel()` (the thresholds to extract, D-04), `bandTone()`, `confidenceRange()`, `comparativeLine()`, `deriveBehavioralTiles()`, the "never fabricate, omit what isn't present" philosophy (grounds D-14)
- `src/components/board/verdict/verdict-constants.ts` — `fixCount` etc.
- `src/components/board/verdict/VerdictNode.tsx` / `EngineGroup.tsx` — current consumer; shows which fields the board actually reads vs ignores (informs the prune)

### Known technical landmines (MUST respect)
- `CLAUDE.md` (project root) → engine FROZEN at 3.19.0; no `lib/engine/` edits; Tailwind v4 / Lightning CSS notes (not load-bearing here, but the freeze is)

### F-number provenance
- `.planning/milestones/v4.1-mvp-ready/01-engine-pipeline/01-WALKTHROUGH-LOG.md` — F27 (Apollo input overlap), F28 (dual output-contract); LOW/MEDIUM, documented-only, no surface action beyond the prune note

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`verdict-derive.ts`** — band scale, behavioral-tile derivation, confidence-range viz, and the honest "omit/never-fabricate" pattern. The view-model reuses these (extract `bandLabel` thresholds into a tunable constant per D-04).
- **`PredictionResult` type** (`src/lib/engine/types.ts`) — the single source of truth for the input contract; `HeroBlock`, `signal_availability`, `analysis_unavailable`/`partial_analysis` already exist (no engine work needed to derive the verdict/degradation).
- **`use-analysis-stream.ts`** — already sets the full `PredictionResult` on `complete`; `toReadingBlocks` plugs in at mount (D-08), no transport work (streaming already exists — reshape, don't build).

### Established Patterns
- **`variants` JSONB extensibility bag** — apollo/hero/craft/engagement_range persist here via read-merge-write (racing writers). The normalizer (D-11) must read defensively from `variants.*`, mirroring how `[id]/route.ts` already does.
- **Reload shims** in `[id]/route.ts` — the existing (ad-hoc, partly non-deterministic) precedent for "reconstruct live shape from persisted row." Phase 2 makes this a single pure module instead of inline route logic.
- **Honest-derivation discipline** — every rendered value traces to a real engine field; tiles/banners omit what isn't present. The view-model inherits this as D-14.

### Integration Points
- `lib/reading/view-model.ts` (new) — pure `toReadingBlocks(canonicalResult) → ReadingBlock[]`.
- `lib/reading/` reload-normalizer (new, D-11) — `fromPersistedRow(row) → canonical shape`; `[id]/route.ts` imports it (consolidating its current inline shims).
- Live consumer: `use-analysis-stream.ts` at mount. Replay consumer: the permalink hook reading `[id]/route.ts` output.
- Phase 3 consumes the exported `VERDICT_BANDS` constant (D-04) to calibrate thresholds; Phase 4 consumes `ReadingBlock[]` to render.

</code_context>

<specifics>
## Specific Ideas

- **Apollo expert insight is the hero block of the Reading body** — vision positions the engine as a sensor and Apollo (Chase-Hughes-grounded interpreter) as the moat. It must be foregrounded (D-01 #2), never buried at the bottom as it is on today's board.
- **WHOOP anchor** — verdict-first, color only in the data; the verdict block is THE product, the `/100` is demoted evidence (D-07).
- **"Reading == resting document" is a brand promise, not a nice-to-have** — the whole stage-reveal + re-openable-document premise rests on the contract being real (vision §7b: the data contract is the deliberately-deferred-INTO-this-milestone precondition). D-08…D-12 exist to make it literally true.
</specifics>

<deferred>
## Deferred Ideas

- **emotion_arc as a Reading block** — dropped now (D-03); revisit in Phase 4 if the UI wants a distinct emotional-timeline visualization separate from retention.
- **retrieval_evidence "similar videos" surface** — dropped from this contract; could be a Phase 6 agentic-tool result instead (competitor/similar-content fetch), not a core Reading block.
- **Persisting the real heatmap as a first-class column (migration)** — if the normalizer (D-11) can't faithfully reconstruct heatmap from persisted data, a persistence fix may be needed — but that's a migration decision for the planner/Phase 3+, not a given for Phase 2 (which prefers a pure normalizer + degradation).
- **Band threshold *values*** — Phase 2 exposes the constant; Phase 3 calibrates the actual numbers + buffer zones against measured score noise.

None of the above is scope creep into Phase 2 — all are correctly downstream.

</deferred>

---

*Phase: 2-View-Model + Data Contract (ENG-06 D-12)*
*Context gathered: 2026-06-11*
