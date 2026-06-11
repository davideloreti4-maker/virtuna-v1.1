# HANDOFF — Phase 5 (Wire + Surface) + engine-opt follow-ups

**Written:** 2026-06-06 (end of the engine-latency-quality quick task)
**For:** a fresh session starting Phase 5 discussion.
**Read first:** `.planning/STATE.md` · this milestone's quick task
`.planning/quick/20260605-engine-latency-quality-spine-ab/SUMMARY.md` · `.planning/ENGINE-MAP.md`

---

## 1. Engine state the surface must reflect (NEW — changed this session)

The engine was optimized **~312s → 74s (−76%)**, quality-verified, shipped (ENGINE_VERSION
**3.7.0**, on `origin/milestone/engine-opt`). Phase 5 surfaces THIS engine:

- **Call graph:** omni `qwen3.5-omni-flash` (~17s, the only call that sees pixels) →
  `deepseek` Apollo reasoner `qwen3.6-plus` budget 1500 (~51s) ∥ `fold` `qwen3.6-flash`
  (~50s, hidden under deepseek). E2E ~74s.
- **The fold is a TEXT simulator** — it does NOT consume video frames (keyframes never
  reach it; it reasons over omni's segment text + verbatim + emotion_arc). Personas don't
  "watch." Surface copy should not imply frame-level persona viewing.
- **Score is Apollo's composite** (0–100) + behavioral (fold) blend. ⚠️ **It swings ±5 on
  identical input** (74–82 observed) — provider noise on a deliberately-holistic judgment.
- **Hero = the Apollo INSIGHT** (6 §-cited dimensions + 3 verbatim-grounded hook rewrites).
  This held depth at every budget — it's the strongest, most trustworthy output. Per
  `apollo-direction`: insight is hero, score demoted.

## 2. The four follow-ups — how they route into Phase 5

| # | Item | Routing |
|---|------|---------|
| 1 | **Composite score-trust** (±5 noise) | **Phase 5 discussion input** — decide what to surface: show the number? band it? lead with insight + demote score? Fix (rubric-sum the 6 dimensions vs holistic guess, or ensemble N reads) may be in-scope or a sibling task. |
| 3 | **<45s path** (progressive paint vs fold-split) | **Phase 5 discussion input** — progressive painting (omni instant score ~17s → fold+Apollo refine async, number shifts) is a BOARD-REVEAL UX decision. fold-split conflicts the 1-call mandate. Decide if <45 is even a requirement given 74s. |
| 2 | **Dead keyframe→fold plumbing** | **Standalone hygiene** — `readKeyframeUris` + `buildFoldUserContent` image_url path + `keyframeUris` param are inert (analysisId never threaded). ~20-min cleanup quick task. Non-blocking. |
| 4 | **Broader omni-flash validation** | **Standalone QA** — flash defaulted on 2 videos (easy+hard). Validate on music-heavy / accented / visual-only before fully trusting. `scripts/measure-pipeline.ts <video>`. Non-blocking; rollback = `QWEN_OMNI_MODEL=qwen3.5-omni-plus`. |

## 3. Recommended move-forward sequence

1. **Fresh session → `/gsd-discuss-phase 5`.** Carry items #1 and #3 in as surface decisions
   (what to show for the score given its noise; whether the board reveals progressively).
2. Let discussion settle the score-presentation + reveal-UX, THEN `/gsd-plan-phase 5`.
3. **Backlog #2 + #4** as a small post-Phase-5 (or parallel) engine-hygiene quick task —
   `/gsd-quick` each. Not on the Phase 5 critical path.

## 4. Phase 5 opening questions (for discuss)

- What does the board show as the headline — the ±5-noisy composite, a band, or the insight?
- Progressive reveal (fast first paint, refine) vs single 74s paint — which UX?
- Which Apollo outputs surface: composite, 6 dimensions, 3 rewrites, behavioral curve, flop warning?
- Remix modes (R12, Apollo modes) — in Phase 5 scope or separate?

## 5. Repo notes

- Aggressive auto-commit hook ("feat/test: changes") sweeps edits mid-session; auto-PUSH is
  active (HEAD is on origin). Commit deliberately; verify HEAD.
- Harnesses available: `scripts/measure-pipeline.ts` (E2E probe), `scripts/apollo-budget-sweep.ts`
  (omni-once → deepseek at N budgets, dumps insight; `SWEEP_BUDGETS` + `QWEN_OMNI_MODEL` env).
