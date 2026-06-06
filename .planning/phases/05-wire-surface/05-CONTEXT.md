# Phase 5: Wire + Surface - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Connect the three engine calls (`Omni → {Audience-Sim fold ∥ Apollo}`) and surface the
full Apollo flow on the board. Deliver: finalized score + confidence, audience-aware rewrites,
retention heatmap, grounded engagement estimate (R11), and removal of dead fake-engagement UI.

**This phase surfaces the engine optimized in Phases 1–4** (ENGINE_VERSION 3.7.0, ~74s E2E):
omni `qwen3.5-omni-flash` ~17s (observer/transcriber — emits verbatim + segments, **no score**)
→ in parallel: `fold` text-simulator ~50s (reasons over omni TEXT — **never sees video frames**)
and Apollo reasoner ~53s. Score is Apollo composite + fold-behavioral blend; **swings ±5 on
identical input** (provider noise on a holistic judgment).

**Not in scope (belongs elsewhere):** the P4 fold-flip carry-forward (already DONE in code);
chat surface (later milestone); dead keyframe→fold plumbing cleanup (standalone hygiene); broader
omni-flash QA validation (standalone QA). The upcoming UI/UX milestone owns deep visual polish —
P5 surfaces the data + a working hero hierarchy, not a final design pass.

</domain>

<decisions>
## Implementation Decisions

### Score derivation + presentation (R5 — handoff follow-up #1)
- **D-01:** **De-noise via rubric-sum.** Apollo scores each of its 6 named dimensions
  (temp0+seed), and the 0–100 composite is the **deterministic sum** of those dimension
  scores — NOT a separately-asked holistic 0–100. This kills the holistic-guess variance
  that causes the ±5 swing, and matches the banked P3 principle "score = composite of named
  dimensions, not a black box." In-scope here as R5 score-finalize (touches the Apollo output
  contract + aggregator blend).
- **D-02:** **Present as a directional band + tight range**, demoted below the insight.
  Reuse the existing coral confidence-band machinery (`verdict-derive.ts`: `confidenceRange`,
  `bandLabel`, `bandTone`). Band shows strong/mid/weak + a range (e.g. "78–82"); width should
  reflect the real residual noise. Honest, keeps the chess-engine-eval framing (2026-06-03)
  without re-exposing a jittery bare integer.

### Board reveal UX (handoff follow-up #3)
- **D-03:** **Progressive per-frame reveal.** Each board frame paints when its call lands:
  omni breakdown (~17s, the felt-speed win) → fold heatmap (~67s) → Apollo score+rewrites
  (~70s). Score appears **exactly once, final** — because omni produces no score, there is
  **no shifting-number problem.** Board already has separate frames per call.
- **D-04:** **<45s target DROPPED.** 74s with a 17s first paint feels fast. The only sub-45
  paths (fold-split, omni-instant-score) conflict the 1-call mandate or fake a number. Not
  pursued; not even a stretch goal.

### Grounded engagement estimate (R11)
- **D-05:** **Gate R11 on a researcher input-availability check.** Today only `creator_handle`
  is threaded into the engine; follower / typical-views data lives in the scraping layer
  (`apify-provider`) and is **not confirmed to reach the engine.** R11's own note + verify
  clause require confirming baseline inputs first. **Researcher MUST determine whether
  creator-baseline data (follower tier / typical views) reaches the engine.**
  - **If yes** → build estimate = creator baseline × Apollo+fold quality read.
  - **If no** → remove the fake `predicted-engagement` UI this phase and **defer** the real
    grounded estimate to its own task. P5 surfacing does NOT block on R11 either way.
- **D-06:** **R11 output form decided AFTER the researcher reports** — let the available data
  shape it. Default lean (if built): a wide, honest **range relative to the creator's own
  history** ("8–40k vs your ~15k median"), never a false-precise point (virality is fat-tailed).

### Rewrite + insight surfacing (R4 — the hero)
- **D-07:** **R4 satisfied at surface-time, not generation-time.** fold ∥ Apollo run in
  PARALLEL today; serializing fold→Apollo (so Apollo reads the retention curve at generation)
  costs ~+50s → ~120s, **breaking R6 (≤90s).** Instead: keep the parallel graph; the **board
  visually correlates** each Apollo rewrite with fold's heatmap drop-point ("targets the 0:02
  dip"). Rewrites stay verbatim-grounded; audience-awareness is **rendered, not generated.**
  ⚠ **This reinterprets R4** ("rewrites reference where archetypes drop") from a generation-time
  to a surface-time contract — the verify ("a rewrite cites an archetype bounce point") is met
  at the UI layer. **Preserves the 74s E2E / R6.**
- **D-08:** **Insight-hero surface set + priority.** Hero = the read + 3 verbatim-grounded
  rewrites (original struck-through + copyable variants). Then, in order: 6 §-cited dimensions
  → fold retention heatmap → score band (D-02) → flop/anti-virality warning. **Strip the dead
  fake-engagement UI** (`results-panel` predicted-engagement path already has a null test).
  Insight stays the hero; score never competes for top attention (per `apollo-direction`).

### Claude's Discretion
- Skeleton/placeholder loading states per frame during progressive reveal (D-03) — user picked
  plain progressive, not the skeleton variant; planner/UI may add a light loading affordance.
- Exact band copy, range width formula, and tone thresholds — within the existing
  `verdict-derive.ts` machinery.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone direction + strategy
- `.planning/ROADMAP.md` §"Phase 5: Wire + Surface" — phase goal, Does/Success/Risk
- `.planning/STATE.md` — current truth (P1–4 complete, engine 3.7.0, decisions-locked blocks)
- `.planning/HANDOFF-phase5.md` — engine state to surface + the 4 follow-ups routing
- `.planning/ENGINE-MAP.md` — SSOT cut-list / call-graph reference
- `.planning/VISION.md` — Apollo product vision (insight-hero positioning)

### Requirements
- `.planning/REQUIREMENTS.md` — R4 (audience-aware insight), R5 (honest expert score),
  R6 (≤90s cap), R7 (~3 calls), R11 (grounded engagement), R12 (one brain across modes)

### Engine + surface code (verify against current code — memory is point-in-time)
- `src/lib/engine/types.ts` — `PredictionResult`, `confidence`/`confidence_label`,
  composite_score, Apollo output contract (rubric-sum lands here, D-01)
- `src/lib/engine/` (Apollo reasoner / deepseek, fold, aggregator, pipeline) — wiring target
- `src/components/board/verdict/verdict-derive.ts` — score band machinery (D-02)
- `src/components/board/verdict/`, `audience/`, `actions/`, `content-analysis/` — the frames
  for progressive reveal (D-03) and the insight-hero set (D-08)
- `src/components/app/simulation/results-panel.tsx` (+ predicted-engagement-null test) —
  dead fake-engagement UI to strip (D-08)
- `src/lib/scraping/apify-provider.ts`, `src/lib/scraping/types.ts` — where follower/baseline
  data lives; researcher checks if it reaches the engine (D-05)

### Memory (background, verify before asserting)
- `apollo-direction` — insight=hero, score demoted, don't rebuild outcome RAG
- `apollo-knowledge-core`, `engine-latency-optimization`, `qwen-only-pipeline`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`verdict-derive.ts`** (`confidenceRange`, `bandLabel`, `bandTone`): score-band rendering
  already exists — D-02 reuses it rather than building new banding.
- **Per-call board frames** (`verdict/`, `audience/RetentionChart`+`RetentionPlayer`,
  `actions/ActionsNode`, `content-analysis/`): the frame separation enables progressive
  per-frame reveal (D-03) with little new structure.
- **`results-panel` null-engagement test**: the fake-engagement removal path is already
  partially anticipated in tests.

### Established Patterns
- Engine output flows `assembly → aggregator → PredictionResult → route persist → board derive`
  (the emotion_arc/verbatim assembly-hop is the recurring regression risk — any new field,
  e.g. rubric dimension scores, must be threaded the whole way or it nulls at the DB).
- temp0+seed determinism on scoring; rewrite variants may use temp>0.
- Score blend currently behavioral(fold) + Apollo (D-04/D-05 from P3).

### Integration Points
- **D-01 rubric-sum**: Apollo output schema (dimension scores) → aggregator composite sum →
  `PredictionResult.overall_score` → board band. New per-dimension fields need full threading.
- **D-07 surface correlation**: board layer joins Apollo `rewrites` with fold heatmap
  drop-points — no engine wiring change, no added latency.
- **D-05 R11**: potential new read of creator-baseline from scraping/creator_context into the
  engine — gated on researcher confirming the data path.

</code_context>

<specifics>
## Specific Ideas

- Rewrites render as **original struck-through + copyable variants** (explicit user framing
  carried from ROADMAP "Does").
- Surface-time R4 example phrasing: a rewrite labeled "targets the 0:02 dip" tied to the
  heatmap (D-07).
- R11 range example: "8–40k vs your ~15k median" — wide, history-relative, never a point.
- Keep the chess-engine-eval framing for the score (2026-06-03) — band, not a bare "Strong".

</specifics>

<deferred>
## Deferred Ideas

- **Dead keyframe→fold plumbing cleanup** (`readKeyframeUris` + `buildFoldUserContent` image_url
  path + `keyframeUris` param are inert — analysisId never threaded) — standalone `/gsd-quick`
  hygiene task (~20 min), non-blocking. (Handoff follow-up #2.)
- **Broader omni-flash validation** (music-heavy / accented / visual-only videos before fully
  trusting flash as default; rollback = `QWEN_OMNI_MODEL=qwen3.5-omni-plus`) — standalone QA
  via `scripts/measure-pipeline.ts`. (Handoff follow-up #4.)
- **<45s engine path** — explicitly dropped (D-04); revisit only if a non-1-call-conflicting,
  non-faking path appears.
- **True generation-time audience-aware rewrites** (fold→Apollo serial) — deferred unless a
  latency budget reopens; D-07 takes the surface-time route to protect R6.
- **Real grounded engagement estimate** — deferred to its own task IF researcher finds the
  creator-baseline input is not wired (D-05).
- **Chat surface** — next milestone (`apollo-direction`).

### Reviewed Todos (not folded)
None — no todo matches surfaced for this phase.

</deferred>

---

*Phase: 5-Wire + Surface*
*Context gathered: 2026-06-06*
