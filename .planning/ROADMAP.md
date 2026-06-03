# Roadmap — Apollo

**Branch:** `milestone/engine-opt` · **Worktree:** `~/virtuna-engine-opt/` · **Phases:** 1–5
**Forks from:** `main` post-PR-#5 · **SSOT:** `ENGINE-MAP.md`

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

> **Corpus track (parallel to P1/P2):** pin down the Chase Hughes data + distillation form → feeds P3. Biggest unknown; start early.

---

## Phase 1 — Strip to Senses
**Goal:** delete the fabrication + dead machinery so the engine is honest and under the latency cap — WITHOUT breaking the live product. **Subtractive only** (Apollo doesn't exist yet).
**Does:** delete the *fake* `predicted-engagement` (views = f(score)+jitter, ignores reach) + corpus-percentile framing — grounded engagement returns in P5 (R11); dormant/remove `ml.ts`, `audio-fingerprint`, `trends`; remove the separate `platform_fit` + `rule`-semantic + `stage11` calls (their jobs move to P3); delete vestigial stage10 flags. **Score stays, derivation UNCHANGED for now** — it keeps computing off the existing live signals (behavioral + gemini); the clean Apollo-derived score + confidence lands in P3/P5, not here. Just remove the dead terms from the blend so it reflects only live signals.
**Success:** R6 (under cap), R9 (no fabricated/dead signal), R5 (score + confidence still render). Engine stays shippable + green (minus deleted-feature tests).
**Risk:** low — mostly deletion. Watch blend-coupled board UI consumers + remix coupling in `pipeline.ts`/`types.ts`.
**Ship:** independently mergeable to `main` (honesty + latency win, no dependency on later phases) — merge promptly, don't bank it behind P3/P4.

## Phase 2 — Omni Verbatim
**Goal:** repurpose Omni from eyes-and-judge into observer/transcriber.
**Does:** extend `qwen/schemas.ts` + `omni-analysis.ts` prompt to emit `hook_verbatim` + per-segment `spoken_text`/`on_screen_text`; drop the redundant 0–10 judgment fields; thread verbatim through `aggregator.ts` → `PredictionResult`.
**Success:** R1 (verbatim persists). Zero-regret precondition for P3 + P4.
**Risk:** low — additive to a deterministic call; a few hundred more output tokens.
**Ship:** independently mergeable (Omni also feeds Remix's decode — verbatim helps it too).

## Phase 3 — Apollo Reasoner (Brain 1) — THE MOAT + shared knowledge core
**Goal:** establish the shared knowledge core and reframe `deepseek.ts` into the knowledge-grounded expert. **Score-composite principle:** the 0–100 is composed from named dimensions the brain scores (hook / retention / share-pull / …) + confidence — not a black-box number. Explainable, defensible, and it IS the "first insight that leads into the pillars."
**Does:** build the distilled multi-source knowledge core as a stable cached system prompt; wire it into the score-mode reasoner (swap the generic 5-step); feed verbatim; extend output with `rewrites` (original + 2–3 variants — these MAY use temp>0 even though scoring stays temp0+seed) + composite score + platform/watermark note; drop calibration/percentile. Keep infra (circuit breaker, retries, cache split). **Ground Remix's `decode` + `adapt` in the SAME knowledge core** (R12) — fold their bespoke frameworks (incl. decode's "repeatable vs luck") into the core so Remix doesn't fork the brain.
**Blocked by:** corpus v1 (start distilling now, in parallel with P1/P2 — the long pole).
**Success:** R2, R5, R12. Rewrites quote the real line; decode/adapt share the core.
**Risk:** medium — corpus distillation is the unknown; code skeletons (deepseek + decode/adapt) already exist.

## Phase 4 — Audience-Sim Fold (Brain 2) — THE BET
**Goal:** fold 20 persona calls into one grounded call.
**Does:** one reasoning call using `persona-registry.ts` knowledge, fed verbatim + segments + keyframes + emotion arc, emitting the per-archetype × per-segment matrix → heatmap + aggregate. Decide archetype count (10 vs ~5 core).
**Gate:** R10 — A/B the folded call vs the current 20 on real videos; must reproduce/beat curve quality before it replaces them. **Harness:** revive the dormant `corpus/eval-harness.ts` + `eval-runner.ts` to run both paths + compare retention curves on a fixed video set (the referee — scope this in P4 planning, it doesn't exist wired today).
**Success:** R3, R7, R10. Heatmap from one call.
**Risk:** medium-high — homogenization risk in a single call; mitigated by the A/B gate.

## Phase 5 — Wire + Surface
**Goal:** connect the three calls and surface the insight.
**Does:** wire `Omni → Audience-Sim → Apollo` so rewrites are audience-aware; finalize the score + confidence; build the **grounded engagement estimate** (R11 — creator baseline × quality read, as a range); update the board to render rewrites (original struck-through + copyable variants) + the heatmap + the grounded estimate; remove dead UI tied to the old fake engagement.
**Success:** R4, R5, R7, R11, R6 (final E2E). Full Apollo flow on the board.
**Risk:** medium — UI surface area; coordinate with the upcoming UI/UX milestone.

---

## Deferred (next milestone)
- **Chat surface** — Apollo + engine-as-tool ("analyze this video, give me hooks").
- **Outcome test-rig** as anything beyond a P4 validation tool.
