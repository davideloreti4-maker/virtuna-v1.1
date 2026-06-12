---
status: pending
created: 2026-06-12
resolves_phase: "03"
priority: high
tags: [gate, smoke-run, pre-ship, GATE-01, GATE-03, ENG-03]
---

# Phase 3 deployed smoke run + formal GO/NO-GO (deferred pre-ship gate)

**Decision (2026-06-12, Davide):** Phase 4 (Mobile Reading Thread) is authorized to
START against the existing proven-honest real fixture
(`src/lib/reading/__tests__/fixtures/live-WEkihfOzJphv.json`, score 71, gate-assert
GREEN). The formal Phase-3 GO is **deferred to a pre-ship gate**, NOT skipped.

## What is already done (committed)
- 03-01 Task 1 — `scripts/gate-assert.ts` honesty harness (GREEN on the real fixture).
- 03-02 — dead-band buffer (`DEAD_BAND_FLOOR=5` + `inDeadBand`), reading suite 37/37,
  build green. BUFFER_HALFWIDTH=5.

## Outstanding before Phase 4 SHIPS (this todo)
1. **03-01 Task 2** — live deployed-Vercel batch: same near-boundary video ≥3×
   sequentially via the authenticated browser-fetch path (see
   `~/.claude/projects/-Users-davideloreti-virtuna-v1-1/memory/numen-fixture-capture-auth.md`).
   Capture each `complete` payload, run `gate-assert.ts` on each, record:
   - run table (score, **production ENG-03 wall-clock latency**, DashScope-429 events)
   - variance figure: max-min + stdev + explicit `VARIANCE_HALFWIDTH=<n>`
   - **human honesty sign-off** (verdict honest? insight sane?)
   → `03-GATE-RUNS.md` + `03-01-SUMMARY.md`
2. **03-03** — dated GO/NO-GO (`03-GATE-DECISION.md`): all-GREEN ∧ honest/sane ∧
   `BUFFER_HALFWIDTH (5) > VARIANCE_HALFWIDTH`. Local `measure-pipeline` pass + F42
   permalink embedded. A NO-GO blocks Phase 4 from shipping.

## Resume
Run the deployed batch, then `/gsd-execute-phase 3` (skips 03-02, continues 03-01 → 03-03).
This todo auto-closes when Phase 03 is marked complete.
