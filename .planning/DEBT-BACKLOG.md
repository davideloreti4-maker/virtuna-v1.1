---
type: debt-backlog
created: 2026-06-21
owner: milestone/numen-tools (lives here; stripped from main by the code-only ship)
purpose: Single resume point for ALL deferred work after v6.0 Numen Studio shipped to main.
  Nothing is lost — every item below is accessible in this worktree.
---

# Debt & Deferred-Work Backlog

Captured at v6.0 ship (2026-06-21). v6.0 = P1–14 built, verified, prod-build green,
merged to `main` via a clean code-only PR. This branch + worktree stay live to burn
this list down. Check items off here as they land.

---

## 1. v6.0 milestone debt (this branch)

### Test reds (6 — build is green; these are test-debt, not regressions)
- [ ] `audiences/route.test.ts` ×3 — DELETE tests omit the `Content-Type` header that
  `csrfGuard` now requires (CR-01 security fix added the guard to DELETE in P12; tests
  predate it). **Fix:** add `headers: { "Content-Type": "application/json" }` to the 3
  DELETE `Request`s (lines ~363/370/+1), mirroring the passing PATCH tests. Route is correct.
- [ ] `Sidebar.recent.test.tsx` ×1 — "shows content_text snippet" times out (5s). Live
  surface; test updated in P12 relabel. Confirm whether the snippet still renders post-relabel
  (stale assertion) or genuinely regressed.
- [ ] `board/adapt/AdaptFrameBody.test.tsx` ×2 — LEGACY canvas-board surface (Konva
  `AdaptShellNode` + `use-analysis-stream`), test from milestone v3.2 viral-remix (2026-06-03),
  never updated through v5/v6. Multiple-elements + timeout. **Decide:** fix or delete with the
  legacy board.

### Engine (generation path — the moat path)
- [ ] **Gen reliability:** ~1 in 3 direct `runHooksPipeline` Qwen generate calls throw
  transiently (route catches → SkillRunError toast, not silent). Add retry/fallback for
  "output 100% of the time." (handoff §1 Deferred)
- [ ] **Gen latency:** ~110s/hook-run even with critic off — dominated by `qwen3.7-plus`
  reasoning-gen + 8-way SIM fan-out. Goal <5s/<90s. Separate engine track (faster gen model +
  SIM parallelism). See memory `engine-latency-optimization`.
- [ ] **Rubric critic** deactivated (env `RUBRIC_CRITIC_ENABLED`, default OFF) because it
  failed ~100% of candidates → 0 blocks. Re-enable once it stops over-rejecting. Code + tests
  kept. See memory `rubric-critic-deactivated`.

### Verification gaps
- [ ] P13 gen-path **UAT (`13-UAT.md`) + phase verifier** pending (blocked on the flaky engine).
- [ ] **Flywheel residual:** confirm script/remix runners also call `pinPredictedSignature()`,
  and verify capture→reconcile fires E2E against live data. See `HANDOFF-composer-flywheel.md`
  + `10-VERIFICATION.md`/`10-UAT.md` Gaps.

### Existing granular todos (`.planning/todos/pending/`)
- [ ] `empty-generation-latency-and-ux.md`
- [ ] `gap-remix-01-decode-failed.md`
- [ ] `p10-single-post-metrics-to-clockworks.md`
- [ ] `thread-lifecycle-new-simulation-clear.md`

### Code TODOs (in src)
- [ ] `api/tools/ideas/route.ts:117` — per-user rolling rate limit (v2).
- [ ] `api/cron/audience-drift/route.ts:110/181/206` — remove `(supabase as any)` casts after
  types regen (TODO 10-07).
- [ ] `lib/engine/anti-virality.ts:24` — revisit weighting once outcome data accumulates (M2-II).
- [ ] `lib/__tests__/handle-parser.test.ts:17` — wire by `reference-creators-input.tsx` tests (02-03).

### Deferred decisions (D-NN)
- [ ] Comment seeding (D-04 / D-09) — deferred out of P8 + P11.
- [ ] KCQ-03 live-exemplar RAG + N2 cited-research (D-15) — deferred to a future grounding phase.
- [ ] See per-phase `11-*/deferred-items.md`.

---

## 2. v6.1 — next milestone (deferred phases, not built)
- [ ] **P15 Marketing Intent** — per-run composer intent (grow⇄sell) reframing persona reactions
  + buyer block. Prompt-layer, not engine.
- [ ] **P16 Commerce Skills** — Offer/Product Validation + Ad Creative + brand-profile entity +
  in-thread monetization, on P15's buyer frame.
- [ ] **P17 Initiated Numen** — the proactive half split from P13 (morning drops, scheduled
  `PROACTIVE-01/02`). Not discussed.
- [ ] Commerce/Marketing-Intent track (B2C→B2B via per-run intent). See memory
  `commerce-marketing-intent-track` + `.planning/NEXT-MILESTONE-VISION.md`.

---

## 3. Engine track (cross-cutting)
- [ ] **Model-assignment flip:** flash-fold is WRONG (unstable diversity); flip + cost-fix
  PENDING on branch `fix/flash-coercion-stability`. See memory `engine-model-assignment`.
- [ ] E2E latency 312s→<90s; DashScope parallel-not-serial. Determinism gate (temp:0+seed);
  fold-validate-cheap-first; 1:1 video learning loop. See memory `engine-*` cluster.
- [ ] **Chat citations not grounded** — §pills are fake labels, not real RAG. Fix taxonomy or
  drop. See memory `chat-citations-not-grounded`.
- [ ] **D-R1 Read→pure-sensor** — drop Read judgment fields = atomic 5-file commit + version bump.

---

## 4. Open branches elsewhere (cross-milestone — needs triage/prune)
> 17 branches unmerged vs `main`. Triage: revive, merge, or prune.
- [ ] `feat/chat-ethics-gate` — Chase Hughes knowledge layer PARKED; A/B inconclusive + cost
  flag; decision pending. See memory `chase-hughes-knowledge-layer`.
- [ ] `feat/creator-voice-sample` — **UNTRACKED in memory; triage what this is.**
- [ ] `fix/flash-coercion-stability` — engine model flip (see §3).
- [ ] `reconcile/reading-pr19` — reading reconciliation follow-up to PR #19.
- [ ] `milestone/numen-surface` — v5.0 (shipped PR #20); confirm fully merged, then prune.
- [ ] `milestone/ui-opt` — in progress (per CLAUDE.md worktree table).
- [ ] `milestone/viral-remix` + `viral-remix-adapt` + `viral-remix-pr` — v3.2 dormant; revive
  for the Remix tool when it lands.
- [ ] Landing proliferation — `milestone/landing`, `landing-v2`, `landing-linear-clone`,
  `landing-page`, `landing-page-redesign`, `numen-landing` — consolidate/prune to the live one
  (landing-v2 active per memory).
- [ ] Stale milestone branches — `mvp-launch`, `platform-refinement`,
  `prediction-engine-integration`, `prediction-engine-v2`, `phase-5-video-segmentation` —
  triage/prune.

---

## 5. Rebrand
- [ ] **Numen rebrand** — logo locked (Stele "n"); "Virtuna" text sweep across the app pending.
  See memory `numen-rebrand`.
