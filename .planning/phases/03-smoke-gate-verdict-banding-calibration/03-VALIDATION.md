---
phase: 03
slug: smoke-gate-verdict-banding-calibration
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-12
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (`vitest.config.ts`) |
| **Config file** | `vitest.config.ts` (existing — no install needed) |
| **Quick run command** | `pnpm test src/lib/reading/__tests__/verdict.test.ts` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | quick ~3s; full suite ~25–45s (Vitest unit suite, no E2E) |

The unit surface (GATE-02 dead-band cases) runs in Vitest. The GATE-01 live gate and the
GATE-02 variance figure are **operational/manual** verifications (authenticated browser-fetch
against deployed Vercel) — see the Manual-Only table. `scripts/gate-assert.ts` provides the
automated GREEN/RED assertion over each captured `live-<id>.json`.

---

## Sampling Rate

- **After every task commit:** Run `pnpm test src/lib/reading/__tests__/verdict.test.ts` (~3s)
- **After every plan wave:** Run `pnpm test` (full Vitest suite — must stay GREEN; `identical-render.test.ts` guards the view-model contract)
- **Before `/gsd:verify-work`:** Full suite must be green + the GATE-01 `gate-assert.ts` line GREEN on a real capture + the D-08 go/no-go recorded
- **Max feedback latency:** ~45 seconds (full suite); ~3 seconds for the per-commit quick run

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | GATE-01 | T-03-01/02/03 | gate-assert.ts reads no engine env; echoes no credentials/cookies | unit (script self-check) | `pnpm tsx scripts/gate-assert.ts src/lib/reading/__tests__/fixtures/live-WEkihfOzJphv.json` | ✅ fixture exists; script authored in this task | ⬜ pending |
| 03-01-02 | 01 | 1 | GATE-01 (+ GATE-02 variance) | T-03-01/02 | session cookie stays in browser; fixtures PII-reviewed | E2E (manual gate) + scripted assert | `pnpm tsx scripts/gate-assert.ts <live-<id>.json>` per run (manual run-loop) | ✅ capture path exists | ⬜ pending |
| 03-02-01 | 02 | 2 | GATE-02 (calibration) | T-03-02a | pure presentation constant; no untrusted input | unit | `pnpm test src/lib/reading/__tests__/verdict.test.ts` | ✅ verdict.test.ts exists — ADD dead-band cases | ⬜ pending |
| 03-02-02 | 02 | 2 | GATE-02 (calibration) | T-03-02a | one-line OR into pure confidenceLanguage(); no new branch | unit | `pnpm test src/lib/reading/__tests__/verdict.test.ts && pnpm test src/lib/reading/__tests__/identical-render.test.ts` | ✅ exists | ⬜ pending |
| 03-03-01 | 03 | 3 | GATE-03 | T-03-03/03b | record permalink path only (no token/cookie); key in .env.local | E2E (local structural pass) | `pnpm tsx scripts/measure-pipeline.ts 2>&1 \| grep -E "OVERALL_SCORE="` | ✅ exists | ⬜ pending |
| 03-03-02 | 03 | 3 | GATE-03 | T-03-03 | PII-review permalink before commit | Manual-Only (dated go/no-go checkpoint) | — (human sign-off; composes prior automated evidence) | n/a — produces 03-GATE-DECISION.md | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

The automated verifications for GATE-02 are the dead-band unit cases in
`src/lib/reading/__tests__/verdict.test.ts` (71/69/41/39 → 'Mixed signals'; 85 → not Mixed);
for GATE-01 the `scripts/gate-assert.ts` GREEN/RED harness over each `live-<id>.json`. The
live-run batch (03-01-02) and the dated go/no-go (03-03-02) are Manual-Only (below).

---

## Wave 0 Requirements

The two real Wave-0 prerequisites (RESEARCH "Wave 0 Gaps") are each authored **inside their
consuming plan**, so Wave 0 is satisfied by those tasks rather than a separate scaffold wave:

- [x] Dead-band test cases in `src/lib/reading/__tests__/verdict.test.ts` — GATE-02 calibration
      (near-boundary 71/69/41/39 → 'Mixed signals'; clear-of-threshold → not Mixed).
      **Authored in Plan 02, Task 2** (03-02-02), the task that consumes them. File already
      exists; cases are additive.
- [x] `scripts/gate-assert.ts` — the thin GREEN/RED assertion helper over the captured
      `live-<id>.json` for GATE-01 D-06 (truncation / confidence_label / §-cites taxonomy-valid /
      score). **Authored in Plan 01, Task 1** (03-01-01), the task that consumes it.
- [ ] (Optional convenience) shell tally for max−min/stdev across the 3 variance runs — not
      required; the operator may compute by hand and record in 03-GATE-RUNS.md.

*Framework already installed (Vitest); no framework gap. No separate Wave-0 scaffold plan
needed — both prerequisites live in their consuming Wave-1/Wave-2 tasks.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live real-video E2E on deployed Vercel reaches `complete` with honest, non-truncated output | GATE-01 | `/api/analyze` returns 401 without a Supabase session; `--direct` cannot auth. Only an authenticated browser-fetch against deployed Vercel works (D-09: production = rig of record). Not a Vitest test. | Provision `e2e/create-test-user.ts`; Playwright-login on the DEPLOYED URL; in-browser authenticated `fetch('/api/analyze')` accumulating SSE into `window.__smokeCapture` until `complete`; pair via `scripts/capture-reading-fixture.ts`; assert via `scripts/gate-assert.ts <live-<id>.json>` (GATE_ASSERT=GREEN). |
| Same-video 3-run score-noise (variance) figure | GATE-02 (variance) | Requires repeated live deployed runs; the production latency (ENG-03) must be real, not local — inherently operational. | Run the same near-boundary video 3× SEQUENTIALLY (never parallel — D-10 429 safety); record overall_score + wall-clock latency + 429 events per run; compute max−min, stdev, and the explicit variance half-width. |
| Human honesty sign-off — verdict honest (not a confident lie), expert insight sane | D-07 (GATE-01) | Subjective editorial judgment of read quality; not automatable. Load-bearing per milestone human-in-the-loop rule. | Manual review of the produced Reading; record dated affirmative sign-off in 03-GATE-RUNS.md. |
| Dated go/no-go decision (composes all-GREEN ∧ honest/sane ∧ buffer>variance) | GATE-03 (D-08) | A human gate decision composing automated + subjective evidence; literally gates Phase 4. | Write `03-GATE-DECISION.md` with dated GO/NO-GO, all three D-08 conjuncts evaluated, F42 authenticated permalink, local measure-pipeline pass line, buffer-vs-variance half-width inequality. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (manual-only tasks listed + justified above)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (03-01-01, 03-02-01/02, 03-03-01 are automated; the two manual gates are isolated by automated tasks)
- [x] Wave 0 covers all MISSING references (both prerequisites authored in their consuming plans)
- [x] No watch-mode flags
- [x] Feedback latency < 45s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
