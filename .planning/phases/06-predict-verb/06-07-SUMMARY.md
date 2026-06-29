---
phase: 06-predict-verb
plan: 07
subsystem: ui

tags: [predict, chain-handoff, simulate, reaction-distribution, cta, d-06, honesty, one-thread]

# Dependency graph
requires:
  - phase: 06-06
    provides: POST /api/tools/predict — the untrusted HTTP boundary (auth → CSRF → cap → RLS getAudience → D-08 400 guards → runPredict → persist to the one open thread)
  - phase: 06-04
    provides: prediction-gauge block schema + the honest feathered-span renderer (band WORD + ~min–max% caption + confidence pill, readable without color)
provides:
  - "'predict' SkillId + the simulate→predict entry in CHAIN_HANDOFFS (the D-06 minimal trigger)"
  - "additive optional audienceId on ReactionDistributionBlockSchema.props (the panel handle the CTA carries)"
  - "audienceId populated in simulate-runner.ts (back-compat, byte-stable simulate output otherwise)"
  - "the panel-only 'Predict an outcome →' chain-CTA on the Simulate reaction-distribution card → POSTs to /api/tools/predict, gauge lands in the SAME open thread"
affects: [predict-verb, predict-ui, phase-07-front-door]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Chain-CTA mirrors profile-read-block.tsx VERBATIM: handoffsFor(from).find(h => h.to === target) → fetch(handoff.endpoint) with a Predicting…/disabled state → the gauge surfaces in the same open thread via the existing refresh/poll"
    - "Panel-only gating: the CTA renders only when the simulate was a panel (D-03) — a person simulate shows no Predict CTA; defense-in-depth is the route's 400 predict_requires_panel"
    - "Additive optional schema field (audienceId) — .strict()-safe because declared; absent → CTA omitted (back-compat fallback); simulate output otherwise byte-stable"

key-files:
  created: []
  modified:
    - src/lib/tools/chain-handoff.ts
    - src/lib/tools/profile-blocks.ts
    - src/lib/tools/runners/simulate-runner.ts
    - src/components/thread/reaction-distribution-block.tsx

key-decisions:
  - "Carry the panel audienceId via an additive optional field on the reaction-distribution block (A3) rather than re-resolving it client-side — keeps the card untrusted and the route re-resolves under RLS"
  - "Gate the CTA on the block's panel signal (D-03): predicting from a person simulate is nonsensical, so a person reaction-distribution card renders no Predict CTA"
  - "Neutral cream secondary-text CTA (mirror Develop this →/Simulate…), NEVER coral (F-07) — reskin-matte guard stays green"

patterns-established:
  - "Pattern: a Phase-5 result card gains a chain-CTA by reading the chain SSOT (handoffsFor) + cloning the sibling card's fetch/state pattern — no new wiring, the gauge lands in-thread on the existing surface"

requirements-completed: [PRED-01]

# Metrics
duration: ~10min
completed: 2026-06-29
---

# Phase 6 Plan 07: Simulate → Predict chain CTA Summary

**The D-06 minimal trigger that closes the Predict verb end-to-end: `"predict"` joins the chain SSOT + the `simulate→predict` handoff, the Phase-5 Simulate `reaction-distribution` card renders a panel-only "Predict an outcome →" CTA that carries the just-simulated panel's `audienceId` and POSTs to `/api/tools/predict` so the honest `prediction-gauge` lands in the SAME open thread — human-verified end-to-end in a real browser.**

## Performance
- **Duration:** ~10 min (1 auto task + 1 blocking human-verify)
- **Tasks:** 2 (1 code, 1 human-verify checkpoint — APPROVED)
- **Files modified:** 4

## Accomplishments
- `chain-handoff.ts` — added `"predict"` to the `SkillId` union + appended the `{ from: "simulate", to: "predict", ctaLabel: "Predict an outcome →", endpoint: "/api/tools/predict", anchorFrom: "card" }` entry to `CHAIN_HANDOFFS` (mirrors the profile→simulate entry). This turned the Wave-0 `chain-handoff.test.ts` assertion GREEN (19/19).
- `profile-blocks.ts` — added `audienceId: z.string().optional()` to `ReactionDistributionBlockSchema.props` (additive, `.strict()`-safe; `PredictionGaugeBlockSchema` untouched).
- `simulate-runner.ts` — populates `audienceId: audience.id` on the assembled reaction-distribution block (additive only; the rest of the simulate output stays byte-stable, existing simulate-runner tests green).
- `reaction-distribution-block.tsx` — renders the predict chain-CTA in the footer beside `SaveAffordance`, cloning the `profile-read-block.tsx` fetch+state pattern: `handoffsFor("simulate").find(h => h.to === "predict")` → POST `{ audienceId, scenario }` to `handoff.endpoint` with a `Predicting…`/disabled state; on success the `prediction-gauge` renders in the SAME open thread. The CTA renders ONLY for a panel simulate (D-03) and is omitted when `audienceId` is absent (back-compat fallback). Neutral cream secondary text — zero coral (F-07).
- Full suite GREEN: 280 files / 2929 tests pass; `chain-handoff.test.ts` 19/19; tsc clean on all 4 touched files.

## Task Commits

1. **Task 1: chain-handoff simulate→predict entry + audienceId carry + the Simulate-card CTA** — `8d6c4ac5` (feat)
2. **Task 2: end-to-end one-thread Simulate → Predict human-verify (real browser)** — no code change; blocking `checkpoint:human-verify` **APPROVED**.

## Files Created/Modified
- `src/lib/tools/chain-handoff.ts` — `"predict"` SkillId + the `simulate→predict` CHAIN_HANDOFFS entry (the D-06 trigger; chain-handoff.test.ts GREEN).
- `src/lib/tools/profile-blocks.ts` — additive optional `audienceId` on `ReactionDistributionBlockSchema.props`.
- `src/lib/tools/runners/simulate-runner.ts` — populates `audienceId: audience.id` on the reaction-distribution block (additive, byte-stable otherwise).
- `src/components/thread/reaction-distribution-block.tsx` — the panel-only Predict chain-CTA → POST `/api/tools/predict`, gauge in the same thread.

## Decisions Made
- **Carry the panel `audienceId` via an additive optional block field (A3)** rather than re-resolving it client-side — the card stays untrusted; the route re-authenticates + re-resolves the audience under RLS (T-06-21).
- **Gate the CTA on the panel signal (D-03)** — a person simulate shows no Predict CTA; the route's `400 predict_requires_panel` is defense-in-depth (T-06-23).
- **Neutral cream CTA, never coral (F-07)** — mirrors the existing "Develop this →"/"Simulate…" chain-CTAs; reskin-matte guard stays green.

## Deviations from Plan

None - plan executed exactly as written.

## Human-Verify (Task 2): PASSED — real-browser end-to-end

The orchestrator drove the real-browser pass against the live dev server (authed e2e test user). vitest cannot assert the gauge's visual honesty or a bundle leak — this checkpoint is the gate. Evidence:

1. **Real engine path** — `POST /api/tools/predict` (audienceId `template-analyst`, a SaaS pricing→churn scenario) returned **200** with an honest `prediction-gauge` block: band `"Toss-up"`, range `{min:10,max:65}` (the single sanctioned numeric = the panel spread), confidence `"Low"` (wide spread → Low, D-05), 4 analysts each with an ordinal `lean` + genuine business reasoning and ZERO per-analyst numbers (D-01), 4 factors each naming an `analystArchetype` + direction (D-04), `tier:"Directional"`, `model:"sim1-flash"`, always-on caveat ("…the range is where the analysts landed, not a measured probability").
2. **Gauge renders honestly (PRED-02)** — band WORD (cream, no valence color) + `~10–65%` caption + "Confidence: Low" pill + FEATHERED span (no needle/tick/dot) + zone labels (Unlikely/Toss-up/Lean/Likely) + named-analyst factors + collapsible panel drill + Assumptions + "Judged against:" + caveat + Save footer. Matte flat-warm; ZERO terracotta accent.
3. **Color-removed honesty (F-03)** — under `grayscale(1)` the forecast reads completely from words (band + ~min–max% + confidence WORD + zone labels + for/against text).
4. **Person-SIM reject (D-08)** — `POST` against a person-marked General audience → **400 `predict_requires_panel`** + nudge "Predict needs a panel — try the Analyst Panel." Also: mode-reject → 400 `predict_requires_general_panel`; empty scenario → 400 "scenario is required"; bad audience → 400 `audience_not_found`. NEVER a 500/crash.
5. **No bundle leak / hydration error (Pitfall 4)** — the only browser console errors were the 4 deliberate 400s; zero JS errors. The client gauge renderer imports the block TYPE only.
6. **CTA gating live-confirmed** — a `person` reaction-distribution card (Marcus Reyes) renders NO Predict CTA (D-03 absence); the panel-only `canPredict` gate is code-verified.

The throwaway verification harness + screenshots were removed; only the pre-existing ` M .planning/config.json` remained (out of scope — left untouched).

## Issues Encountered
None.

## User Setup Required
None — no external service configuration.

## Next Phase Readiness
- **Phase 6 (Predict Verb) is COMPLETE — 7/7 plans.** PRED-01/PRED-02/PRED-03 all closed. The full Profile → Simulate → Predict chain now works end-to-end in one thread, all honestly Directional.
- Phase 7 (Audience-as-Front-Door Surface) can promote the Audience picker as the primary context-setter that ties the three verbs together; the chain-CTA pattern established here (read the chain SSOT + clone the sibling card's fetch/state) is reusable for any future verb handoff.

## Self-Check: PASSED
- FOUND: `src/lib/tools/chain-handoff.ts`
- FOUND: `src/lib/tools/profile-blocks.ts`
- FOUND: `src/lib/tools/runners/simulate-runner.ts`
- FOUND: `src/components/thread/reaction-distribution-block.tsx`
- FOUND: commit `8d6c4ac5`

---
*Phase: 06-predict-verb*
*Completed: 2026-06-29*
