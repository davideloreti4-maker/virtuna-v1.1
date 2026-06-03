# Roadmap — Apollo

**Branch:** `milestone/engine-opt` · **Worktree:** `~/virtuna-engine-opt/` · **Phases:** 1–5
**Forks from:** `main` post-PR-#5 · **SSOT:** `ENGINE-MAP.md`

## Strategy

Clear the engine down to its senses (low-risk deletion → under the cap), sharpen the senses (verbatim), build the expert brain (the moat), fold the crowd brain (the bet), then wire + surface. Phase 1 is corpus-independent and can start immediately; the Chase Hughes corpus is pinned down in parallel and lands in Phase 3.

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

> **Corpus track (parallel to P1/P2):** pin down the Chase Hughes data + distillation form → feeds P3. Biggest unknown; start early.

---

## Phase 1 — Strip to Senses
**Goal:** delete the score-and-fabrication machinery so the engine is honest and under the latency cap before any new brain is built.
**Does:** delete `predicted-engagement` (fabricated counts) + corpus-percentile framing; dormant/remove `ml.ts`, `audio-fingerprint`, `trends`; collapse the `aggregator.ts` 7-source blend → a clean score derived from Apollo (+ Audience-Sim) with a confidence value (KEEP the 0–100 score, R5); delete vestigial stage10 flags; remove the separate `platform_fit` + `rule`-semantic + `stage11` calls' wiring (their jobs move to P3). 
**Success:** R6 (under cap), R9 (no fabricated/dead signal), R5 (score + confidence survive, honestly derived). Pipeline still runs green on existing tests (minus deleted-feature tests).
**Risk:** low — mostly deletion. Watch for blend-coupled consumers in the board UI.

## Phase 2 — Omni Verbatim
**Goal:** repurpose Omni from eyes-and-judge into observer/transcriber.
**Does:** extend `qwen/schemas.ts` + `omni-analysis.ts` prompt to emit `hook_verbatim` + per-segment `spoken_text`/`on_screen_text`; drop the redundant 0–10 judgment fields; thread verbatim through `aggregator.ts` → `PredictionResult`.
**Success:** R1 (verbatim persists). Zero-regret precondition for P3 + P4.
**Risk:** low — additive to a deterministic call; a few hundred more output tokens.

## Phase 3 — Apollo Reasoner (Brain 1) — THE MOAT
**Goal:** reframe `deepseek.ts` into the knowledge-grounded expert.
**Does:** swap the generic 5-step framework for the distilled Chase Hughes knowledge core (stable cached system prompt); feed verbatim content; extend output schema with `rewrites` (original + 2–3 variants) + directional read + platform/watermark note; drop calibration/percentile framing. Keep infra (circuit breaker, retries, temp0+seed, cache split).
**Blocked by:** the corpus dependency (distill the Chase Hughes material first).
**Success:** R2, R5. Rewrites quote the real line.
**Risk:** medium — the corpus distillation is the unknown; the code skeleton already exists.

## Phase 4 — Audience-Sim Fold (Brain 2) — THE BET
**Goal:** fold 20 persona calls into one grounded call.
**Does:** one reasoning call using `persona-registry.ts` knowledge, fed verbatim + segments + keyframes + emotion arc, emitting the per-archetype × per-segment matrix → heatmap + aggregate. Decide archetype count (10 vs ~5 core).
**Gate:** R10 — A/B the folded call vs the current 20 on real videos; must reproduce/beat curve quality before it replaces them.
**Success:** R3, R7, R10. Heatmap from one call.
**Risk:** medium-high — homogenization risk in a single call; mitigated by the A/B gate.

## Phase 5 — Wire + Surface
**Goal:** connect the three calls and surface the insight.
**Does:** wire `Omni → Audience-Sim → Apollo` so rewrites are audience-aware; finalize the directional score; update the board to render rewrites (original struck-through + copyable variants) + the heatmap; remove dead UI tied to the old score/engagement.
**Success:** R4, R5, R7, R6 (final E2E). Full Apollo flow on the board.
**Risk:** medium — UI surface area; coordinate with the upcoming UI/UX milestone.

---

## Deferred (next milestone)
- **Chat surface** — Apollo + engine-as-tool ("analyze this video, give me hooks").
- **Outcome test-rig** as anything beyond a P4 validation tool.
