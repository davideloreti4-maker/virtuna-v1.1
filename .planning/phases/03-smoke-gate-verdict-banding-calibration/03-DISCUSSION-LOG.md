# Phase 3: SMOKE GATE + Verdict-Banding Calibration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-12
**Phase:** 3-SMOKE GATE + Verdict-Banding Calibration
**Areas discussed:** Variance methodology, Buffer-zone & Mixed signals, Gate pass/fail criteria, Live rig & 429 policy, Zero-variance contingency

---

## Variance methodology

| Option | Description | Selected |
|--------|-------------|----------|
| 5 runs, 1 boundary video, Vercel (Rec) | 5 sequential runs of one near-boundary video on deployed Vercel; max−min + stdev; each run a latency sample | |
| 3 runs (cheaper) | 3 runs — lower cost/429 exposure, thinner noise figure | ✓ |
| 10 runs (max confidence) | 10 runs for a tight figure — highest cost + 429 exposure; gold-plating | |

**User's choice:** 3 runs (cheaper)
**Notes:** Accepted as a thinner figure. CONTEXT D-01b adds an escalation safeguard — if 3 runs are suspiciously identical or wildly spread (>20pt), planner may add runs (up to ~5–7). Fixture WEkihfOzJphv (score 71, near the 70 boundary, already captured) flagged as primary video candidate. Variance batch folded with GATE-01 latency (one batch, both numbers).

---

## Buffer-zone & Mixed signals

| Option | Description | Selected |
|--------|-------------|----------|
| Symmetric dead-band = variance (Rec) | Dead-band around each threshold, half-width = measured variance (round up), OR'd with antiViralityGated; not a 4th band | ✓ |
| Dead-band + confidence-gated | Same dead-band but widen only when confidence_label MED/LOW; two-axis, harder to prove | |
| Insert a 4th 'Mixed' band | Mixed as its own ordered score range in VERDICT_BANDS; breaks the descending-min table | |

**User's choice:** Symmetric dead-band = variance (Rec)
**Notes:** Overlay verdict, not a 4th ordered band — VERDICT_BANDS stays the clean 3-row table; dead-band logic lives in the view-model verdict branch. Confidence-gating retained as an optional refinement (deferred).

---

## Gate pass/fail criteria

| Option | Description | Selected |
|--------|-------------|----------|
| Automated + human sign-off (Rec) | Script asserts truncation/confidence/§-cites/latency (GREEN/RED); human judges honesty/sanity; go/no-go = all green ∧ honest ∧ buffer>variance | ✓ |
| Automated assertions only | Pure script checklist; can't catch a structurally-valid "confident lie" | |
| Human eyeball only | Manual review only; F46/F47/F22/F23 not machine-verified | |

**User's choice:** Automated + human sign-off (Rec)
**Notes:** Human sign-off is load-bearing per the milestone's human-in-the-loop rule. Go/no-go recorded as a dated decision; any RED blocks Phase 4.

---

## Live rig & DashScope-429 policy

| Option | Description | Selected |
|--------|-------------|----------|
| Vercel rig + 429 doc-and-retry (Rec) | Deployed Vercel for real ENG-03 latency (verify maxDuration vs ~112s); 429 → bounded retry + document, never gates | ✓ |
| Local→live DashScope rig | Run locally against live DashScope; misses production serverless overhead — less faithful latency | |
| Vercel + 429 treated as fail | A 429 counts as a fail; over-strict for a rate-limit signal | |

**User's choice:** Vercel rig + 429 doc-and-retry (Rec)
**Notes:** ⚠ Researcher landmine flagged — confirm Vercel function maxDuration supports ~112s (Pro cap 300s) before assuming the gate runs on Vercel. A 429 is an infra signal, not an output-honesty failure.

---

## Zero-variance contingency

| Option | Description | Selected |
|--------|-------------|----------|
| Floor buffer + keep Mixed common (Rec) | Apply a minimum dead-band (~±5pt) even at variance≈0; buffer = max(measured, floor); Mixed stays first-class regardless of determinism | ✓ |
| Buffer = measured only; Mixed via gate | If variance≈0, buffer≈0, Mixed fires only on antiViralityGated; Mixed becomes rare, contradicts vision | |
| Escalate runs to resolve it | Add runs (up to ~5–7) if 3 are identical/spread before locking | |

**User's choice:** Floor buffer + keep Mixed common (Rec)
**Notes:** Raised because the engine-opt determinism gate (temp:0+seed+maxRetries:0) may be live in 3.19.0 → variance could measure ≈0, collapsing "Mixed signals." Whether 3.19.0 carries that gate is an open researcher question. Floor (~±5pt) guards the vision's "first-class/common Mixed" verdict. Escalation (D-01b) remains available if the figure looks unstable.

---

## Claude's Discretion

- Exact floor value (~±5pt suggested) and whether the reported figure leads with stdev or max−min.
- Reuse/extend `capture-reading-fixture.ts` / `smoke-tiktok-pipeline.ts` / `measure-pipeline.ts` vs a thin variance-runner.
- Placement of the dead-band logic (inline view-model verdict branch vs dedicated band-resolver helper).
- Confidence-gating refinement — adopt or defer.
- Final near-boundary video choice (WEkihfOzJphv vs urls-1.txt).

## Deferred Ideas

- Confidence-gated buffer widening (refinement on the dead-band).
- Cross-video / per-archetype band calibration (gate uses single-fixed-video noise only).
- Heatmap-persistence migration (carried from Phase 2 deferred).
- Prompt accuracy / token tuning (ENG-06 surface-independent sliver — later pass).
