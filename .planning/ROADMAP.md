# Roadmap — Apollo

**Branch:** `milestone/engine-opt` · **Worktree:** `~/virtuna-engine-opt/` · **Phases:** 1–5
**Forks from:** `main` post-PR-#5 · **SSOT:** `ENGINE-MAP.md`

> **Reconstructed 2026-06-06** — P1–3 were accidentally truncated out of this file at commit `1827b44a` (P4 plan creation overwrote it), which drove the STATE `total_phases: 2` drift. Full 5-phase roadmap restored from `a3562245`; P4/P5 statuses brought to current reality.

## Strategy

Clear the engine down to its senses (low-risk deletion → under the cap), sharpen the senses (verbatim), build the expert brain (the moat), fold the crowd brain (the bet), then wire + surface. Phase 1 is corpus-independent and can start immediately; the multi-source corpus is pinned down in parallel and lands in Phase 3.

**Ship incrementally, don't bank a giant merge.** P1 + P2 are independently shippable to `main` (honesty/latency wins, no downstream dependency) — merge them promptly (CLAUDE.md rule: milestones land in days, not weeks). This also keeps us continuously reconciled with `main` (which now carries Remix) instead of one painful end-of-milestone collision.

**Remix is part of this milestone's brain, not separate.** `main` now has Remix (`engine/remix/decode.ts` + `adapt.ts`, `mode: score|remix`). It runs on the same engine and must share the Apollo knowledge core (P3 / R12) — Apollo is the brain for score-mode AND remix-mode.

## Dependency / parallelization

```
        main (post-#5)
              │
              ▼
        Phase 1  (strip to senses — deletion, corpus-independent)
              │
        Phase 2  (Omni verbatim — sharpen the senses)
              │
        ├───────────────┐
        ▼               ▼
   Phase 3          Phase 4
  (Apollo Reasoner  (Audience-Sim fold
   — needs corpus)   — needs P2 verbatim/segments)
        └───────┬───────┘
                ▼
           Phase 5  (wire sequencing + directional score + surface)
```

> **Corpus track (parallel to P1/P2):** pin down the Chase Hughes data + distillation form → feeds P3. Biggest unknown; start early. **RESOLVED** — corpus v1 (`KNOWLEDGE-CORE.md` v1.1) validated, P3 executed.

---

## Phase 1: Strip to Senses — ✅ COMPLETE (2026-06-04)

**Goal:** delete the fabrication + dead machinery so the engine is honest and under the latency cap — WITHOUT breaking the live product. **Subtractive only** (Apollo doesn't exist yet).
**Does:** delete the *fake* `predicted-engagement` (views = f(score)+jitter, ignores reach) + corpus-percentile framing — grounded engagement returns in P5 (R11); dormant/remove `ml.ts`, `audio-fingerprint`, `trends`; remove the separate `platform_fit` + `rule`-semantic + `stage11` calls (their jobs move to P3); delete vestigial stage10 flags. **Score stays, derivation UNCHANGED for now** — it keeps computing off the existing live signals (behavioral + gemini); the clean Apollo-derived score + confidence lands in P3/P5, not here. Just remove the dead terms from the blend so it reflects only live signals.
**Success:** R6 (under cap), R9 (no fabricated/dead signal), R5 (score + confidence still render). Engine stays shippable + green (minus deleted-feature tests).
**Risk:** low — mostly deletion. Watch blend-coupled board UI consumers + remix coupling in `pipeline.ts`/`types.ts`.
**Ship:** independently mergeable to `main` (honesty + latency win, no dependency on later phases) — merge promptly, don't bank it behind P3/P4.
**Plans:** 6/6 plans complete
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Wave 0 scaffolds: extend measure-pipeline (overall_score), fix creator-rules.test cross-import, add null-degrade tests, baseline DB/determinism/latency gates ✓ COMPLETE (2026-06-04) — baseline band 78–79, latency 154–159s, scraped_videos=7389 benign, R8 amended to tolerance band

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Remove stage11/ml/engagement-jitter call sites from aggregator.ts + analyze/route.ts; hard-delete predicted-engagement.ts
- [x] 01-03-PLAN.md — Remove audio/trends/rules/platform_fit call sites from pipeline.ts (Wave1+Wave2 awaited set)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-04-PLAN.md — Blend cut to behavioral+gemini; stage10 flags-only (keep confidence); deepseek 'top X%' label cut (keep calibration JSON)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-05-PLAN.md — git mv dead modules + tests to _dormant/; dormant retrain-ml cron route + remove its vercel.json schedule; prove exclusion

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 01-06-PLAN.md — Hide FALLBACK_ITEM; bump ENGINE_VERSION 3.1.0; blocking E2E gates (score delta, latency, determinism, remix smoke)

## Phase 2: Omni Verbatim — ✅ COMPLETE (2026-06-04)

**Goal:** repurpose Omni from eyes-and-judge into observer/transcriber.
**Does:** extend `qwen/schemas.ts` + `omni-analysis.ts` prompt to emit `hook_verbatim` + per-segment `spoken_text`/`on_screen_text`; thread verbatim through `aggregator.ts` → `PredictionResult` → persistence (dedicated `verbatim` JSONB column); bump the engine cache key. **Additive-only** (D-01) — the 0–10 judgment fields STAY; their drop is deferred to P3 (dropping them here would orphan the gemini half of the live score blend before Apollo replaces it).
**Success:** R1 (verbatim persists on a real run). Zero-regret precondition for P3 + P4.
**Risk:** low — additive to a deterministic call; a few hundred more output tokens. #1 risk is the assembly-hop regression (emotion_arc precedent: declared+prompted but dropped on the assembly literal → 26/26 null rows) — guarded by a real-run proof.
**Ship:** independently mergeable (Omni also feeds Remix's decode — verbatim helps it too).
**Plans:** 3/3 plans complete — PHASE COMPLETE
Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Verbatim contracts: extend OmniAnalysisZodSchema (hook_verbatim + per-segment text) + buildSystemPrompt (fidelity rules + null/[inaudible] contract) + Wave 0 regression test

**Wave 2** *(blocked on Wave 1)*

- [x] 02-02-PLAN.md — Thread verbatim assembly→aggregator→PredictionResult; persist to dedicated verbatim JSONB column (migration + [BLOCKING] live apply + db types + both route sites); bump ENGINE_VERSION 3.2.0 ✓ COMPLETE (2026-06-04)

**Wave 3** *(blocked on Wave 2)*

- [x] 02-03-PLAN.md — R1 real-run proof (speech→non-empty, silent→null not [inaudible]) + R6 latency + R12 remix no-regression + R8 determinism guard ✓ COMPLETE (2026-06-04) — R1 hook+seg PROVEN (gwxLeHphZCxK), R6 ~106s under cap, R8 grep=2, R12 51/51; D-02 silent deferred HUMAN-UAT

## Phase 3: Apollo Reasoner (Brain 1) — THE MOAT + shared knowledge core — ✅ COMPLETE

**Goal:** establish the shared knowledge core and reframe `deepseek.ts` into the knowledge-grounded expert. **Score-composite principle:** the 0–100 is composed from named dimensions the brain scores (hook / retention / share-pull / …) + confidence — not a black-box number. Explainable, defensible, and it IS the "first insight that leads into the pillars."
**Does:** build the distilled multi-source knowledge core as a stable cached system prompt; wire it into the score-mode reasoner (swap the generic 5-step); feed verbatim; extend output with `rewrites` (original + 2–3 variants — these MAY use temp>0 even though scoring stays temp0+seed) + composite score + platform/watermark note; drop calibration/percentile. Keep infra (circuit breaker, retries, cache split). **Ground Remix's `decode` + `adapt` in the SAME knowledge core** (R12) — fold their bespoke frameworks (incl. decode's "repeatable vs luck") into the core so Remix doesn't fork the brain.
**Blocked by:** corpus v1 — RESOLVED (corpus v1 validated; phase executed).
**Success:** R2, R5, R12. Rewrites quote the real line; decode/adapt share the core.
**Risk:** medium — corpus distillation is the unknown; code skeletons (deepseek + decode/adapt) already exist.
**Note (supersede):** D-10 (CONTEXT) supersedes the "rewrites MAY use temp>0" line above — P3 uses a SINGLE deterministic call (temp0+seed) for score + critique + rewrites.
**Plans:** 4/4 plans complete
Plans:
**Wave 1**

- [x] 03-01-PLAN.md — D-02 number port into core §2.0a + byte-stable apollo-core.ts constant + Wave 0 test scaffolds (R2/R5/R12)

**Wave 2** *(blocked on Wave 1)*

- [x] 03-02-PLAN.md — Reframe deepseek.ts → Apollo (APOLLO_SYSTEM_PROMPT prefix, additive output schema, verbatim-grounded rewrites, calibration cleanup) + dormant creator-rules.ts (R2, R5-partial, D-01)
- [x] 03-03-PLAN.md — Re-ground Remix decode + adapt on the shared core (§5 / §6+§2), preserve output contracts (R12, D-11/D-12)

**Wave 3** *(blocked on Wave 2 / Plan 02)*

- [x] 03-04-PLAN.md — Rewire blend to behavioral + Apollo (D-04/D-05) + thread verbatim + variants.apollo persist + ENGINE_VERSION 3.3.0 + live R2/R8/R6 checkpoint (R5)

## Phase 4: Audience-Sim Fold (Brain 2) — THE BET — ✅ COMPLETE (2026-06-05)

**Goal:** fold 20 persona calls (Pass-1 ×10 + Pass-2 ×10) into one grounded reasoning call that emits the per-archetype × per-segment matrix → heatmap + behavioral aggregate, A/B-proven before it replaces the live 10-pass.
**Does:** one `qwen3.6-plus` thinking call using `persona-registry.ts` knowledge, fed verbatim + segments + keyframes + emotion arc, emitting all 10 archetypes each carrying BOTH behavioral intents AND segment_reactions; two pure adapters split it back into the existing `PersonaSimulationResult[]` + `Pass2PersonaResult[]` shapes (aggregator + board byte-untouched, D-11/D-12); a `behavioralSource:"fold"` branch; a NEW `scripts/ab-fold-referee.ts` (modeled on `measure-pipeline.ts`, NOT the corpus harness) running the D-03 3-metric composite; the production flip gated on the A/B + human sign-off.
**Gate:** R10 — the 3-metric composite (behavioral parity ±5, diversity ≥0.8×, drop-point agreement ±1 for ≥6/10) on fixed videos × 2 runs each (R8 band), advisory per D-05.
**Harness deviation (RESEARCH-overrides-CONTEXT):** CONTEXT D-04 said "revive `corpus/eval-harness.ts`"; research found it is a corpus bucket-classifier benchmark (macro-F1), structurally wrong for a retention-curve A/B. Built a NEW referee on the `measure-pipeline.ts` scaffold; left the corpus harness dormant.
**Success:** R3, R7, R10. Heatmap from one call; 1-vs-20 call count; fold proven.
**Risk:** medium-high — homogenization (one call flattening 10 curves); mitigated by the D-06 in-call divergence requirement, the D-07 post-parse guard, and the A/B gate.
**Outcome:** **FLIP EXECUTED** (user mandate, supersedes the original SHADOW plan) — 10-pass (`runWave3Pass2` + Pass-1 loop) DELETED, fold is the sole audience-sim path, no `ENGINE_USE_FOLD` flag. `FOLD_THINKING_BUDGET` cut 4000→1000 (89.9s, diverse curves). Verified live in code 2026-06-06.
**Plans:** 5/5 plans complete
Plans:
**Wave 1**

- [x] 04-01-PLAN.md — Wave 0: 3 vitest scaffolds (schema/adapter/diversity-guard) + ab-fold-referee skeleton + stage/confirm the referee videos (checkpoint)
- [x] 04-02-PLAN.md — Fold LLM layer: byte-stable STABLE_FOLD_SYSTEM_PROMPT + FoldResponseSchema + runFold (one bounded temp0+seed thinking call, both intent+reaction families)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-03-PLAN.md — Lossless adapters + D-07 diversity guard + aggregator "fold" branch (behavioral + heatmap) + pipeline foldOutcome wiring

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04-04-PLAN.md — A/B referee composite: 3-metric (parity/diversity/drop-point) + R7 1-vs-20 call-count assertion + cost cap (advisory exit)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 04-05-PLAN.md — Run the A/B + production flip. Referee MISS 0/2 at budget=4000 (timeout artifact); R7 confirmed. **Superseded by FLIP-AND-DELETE mandate:** budget cut to 1000, 10-pass deleted, fold live as sole path.

## Phase 5: Wire + Surface — ⬜ NOT STARTED (unplanned — needs `/gsd-discuss-phase 5`)

**Goal:** connect the three calls and surface the insight.
**Does:** wire `Omni → Audience-Sim → Apollo` so rewrites are audience-aware; finalize the score + confidence; build the **grounded engagement estimate** (R11 — creator baseline × quality read, as a range); update the board to render rewrites (original struck-through + copyable variants) + the heatmap + the grounded estimate; remove dead UI tied to the old fake engagement.
**Success:** R4, R5, R7, R11, R6 (final E2E). Full Apollo flow on the board.
**Risk:** medium — UI surface area; coordinate with the upcoming UI/UX milestone.
**Note (2026-06-06):** the P4 fold-flip carry-forward (lower budget → flip) is already DONE in code — not P5 work. P5 scope is the wiring/score-finalize/grounded-engagement/surfacing items above.
**Plans:** none yet.

---

## Deferred (next milestone)

- **Chat surface** — Apollo + engine-as-tool ("analyze this video, give me hooks").
- **Outcome test-rig** as anything beyond a P4 validation tool.
