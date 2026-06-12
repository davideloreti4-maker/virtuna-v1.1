# Phase 3: SMOKE GATE + Verdict-Banding Calibration - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

A **verification + calibration** phase — NOT a UI build. It clears the hard precondition that gates Phase 4. Three deliverables:

1. **SMOKE GATE (GATE-01):** one real-video E2E on **live infra** proving the engine returns sane/honest output (F46/F47 read-truncation, F22 confidence, F23 §-cites hold live) + the **real ENG-03 latency number** (DashScope-429 behavior documented).
2. **Variance figure (GATE-02 input):** a documented same-video-N-times **score-noise** number.
3. **Calibrated bands (GATE-02):** `VERDICT_BANDS` thresholds + a boundary **buffer zone** provably wider than that variance, with **"Mixed signals"** a first-class/common verdict.
4. **Recorded go/no-go (GATE-03):** F42 authenticated permalink + full measure-pipeline; a dated verdict-banding decision — **a fail blocks Phase 4.**

The engine (v4.1, `ENGINE_VERSION` **3.19.0**) is **FROZEN** — calibration touches **presentation constants only** (`src/lib/reading/verdict-bands.ts` + the verdict-derivation buffer logic). **No `lib/engine/` edits, no `ENGINE_VERSION` bump.**

**In scope:** the live smoke-gate run + assertions; the variance batch; calibrated `VERDICT_BANDS` + dead-band buffer logic; the recorded go/no-go.
**Out of scope:** any Reading/thread UI (Phase 4); ingestion/shell (Phase 5); engine internals (frozen); cross-video / per-archetype band calibration (gate uses single-fixed-video noise only).
</domain>

<decisions>
## Implementation Decisions

### A. Variance Measurement (GATE-02 input + GATE-01 latency, folded)
- **D-01:** **3 sequential runs of ONE near-boundary video on deployed Vercel.** The score-noise figure is run-to-run noise on a **fixed input** — one video run N times, NOT a spread across videos. Pick a video scoring **near a band threshold** (≈70 or ≈40) where variance actually threatens the verdict. Report **max−min spread + stdev** as the noise figure. **Folded with GATE-01:** each run is also an **ENG-03 latency sample** — one batch satisfies both. (User chose 3 over 5/10 — cheaper/lower-429-exposure; accepted as a thinner figure.)
- **D-01b:** **Escalation safeguard.** 3 points is statistically thin. If the runs come back **suspiciously identical** (→ variance ≈ 0, see D-03) OR **wildly spread** (e.g. >20pt), the planner may add runs (up to ~5–7) before locking the number — don't trust 3 points either way.
- **D-01c:** **Candidate video:** existing fixture **WEkihfOzJphv scored 71** — sits right on the 70 boundary, and its live+persisted pair is already captured. Strong primary candidate; else `scripts/urls-1.txt` (@areyoukiddingtv, ~112s). Final pick = planner/researcher.

### B. Band Buffer Mechanic (GATE-02 — the calibration)
- **D-02:** **Symmetric dead-band around each `VERDICT_BANDS` threshold** (70 and 40). Half-width = `max(measured_variance, floor)`, rounded up. A score **inside a dead-band → "Mixed signals"** verdict. OR'd with the existing `antiViralityGated` trigger. "Wider than variance" is **true by construction** (buffer ≥ variance; round up → strictly wider) and falsifiable.
- **D-03:** **Floor buffer — keep "Mixed signals" first-class even at variance ≈ 0.** Apply a minimum dead-band (~±5pt suggested) so boundary scores still read Mixed **regardless of engine determinism**. `buffer = max(measured_variance, floor)`. Rationale: the engine-opt determinism gate (`temp:0 + seed + maxRetries:0`) may be live in 3.19.0 → variance could measure ≈0, which would otherwise collapse "Mixed signals" back to only the `antiViralityGated` path and contradict the vision's "first-class/common" verdict. The floor prevents that. *(Whether 3.19.0 actually carries that determinism gate is a researcher question — see canonical refs.)*
- **D-04:** **Overlay verdict, NOT a 4th ordered band.** `VERDICT_BANDS` stays the clean 3-row descending-`min` table (`high`/`solid`/`needs-work`); the dead-band logic lives in the **verdict derivation** (`view-model.ts`, the `verdictTitle`/Mixed-signals branch ~L225-230 already flagged for "Phase 3 adds the boundary-buffer firing"). Confidence-gating (widen the buffer only when `confidence_label` is MED/LOW) = **optional refinement, planner discretion** — not core.
- **D-05:** **Edit surface is bounded.** Calibration edits ONLY `src/lib/reading/verdict-bands.ts` (the constant) + the verdict-derivation buffer logic. The legacy board copies (`verdict-constants.ts`, `verdict-derive.ts`) stay **byte-unchanged** — they already carry drift-redirect comments pointing to `verdict-bands.ts` (Phase 2 Pitfall-4 / T-02-04).

### C. Gate Pass/Fail (GATE-01 + GATE-03)
- **D-06:** **Automated assertions** in the gate script → deterministic GREEN/RED: output **not truncated** (F46/F47), `confidence_label` present ∈ {HIGH, MED, LOW} (F22), apollo §-cites **present + taxonomy-valid** (F23), `overall_score` **non-null**, latency captured.
- **D-07:** **Human honesty sign-off** — manual review of the produced Reading: is the verdict **honest** (not a confident lie), is the expert insight **sane**? Required by the milestone's human-in-the-loop rule; not automatable, complements D-06.
- **D-08:** **Go/no-go = (all automated GREEN) ∧ (human: honest/sane) ∧ (buffer provably > variance).** Any RED **blocks Phase 4.** Recorded as a **dated decision** (a GATE-DECISION note / verification record).

### D. Live Rig + DashScope-429 (GATE-01)
- **D-09:** **Deployed Vercel = rig of record.** The ENG-03 latency must be **production-real**, so run against the deployed URL (not local). Use the authenticated-browser-`fetch` capture path (smoke `--direct` 401s — see canonical refs) pointed at the deployed URL. **⚠ Landmine for the researcher:** the ~112s pipeline vs Vercel function `maxDuration` — confirm the deployed function can run that long (Pro cap = 300s) before assuming the gate can even complete on Vercel.
- **D-10:** **429 policy = document-and-retry, never gate.** A DashScope 429 is an **infra signal, not an output-honesty failure.** On hit: bounded retry/backoff, runs **sequential** (not parallel). Document frequency + behavior (roadmap: "429 behavior documented"). Only a **total inability to ever get one clean E2E** blocks.

### Claude's Discretion
- Exact **floor value** (~±5pt suggested, D-03) and whether the reported figure leads with stdev or max−min spread.
- Whether to **reuse/extend** `scripts/capture-reading-fixture.ts` + `scripts/smoke-tiktok-pipeline.ts` + `scripts/measure-pipeline.ts` vs author a thin variance-runner — researcher/planner call.
- Exact placement of the **dead-band logic** (inline in `view-model.ts` verdict branch vs a dedicated band-resolver helper in `lib/reading/`).
- The **confidence-gating refinement** (D-04) — adopt or defer.
- Final **near-boundary video** choice (D-01c).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- `.planning/ROADMAP.md` → Phase 3 (goal + 4 success criteria) and the Phase 4 build that this gate blocks on a fail
- `.planning/REQUIREMENTS.md` → GATE-01, GATE-02, GATE-03 (3 requirements, all Phase 3)

### Authoritative vision (the WHY — locked, do not relitigate)
- `.planning/NUMEN-SURFACE-VISION.md` §7b "SMOKE GATE (hard precondition)" — non-negotiable; the stage-reveal + verdict premise rests on the contract being real; watch DashScope-429; grounds D-06…D-10
- `.planning/NUMEN-SURFACE-VISION.md` §"What the verdict says" — calibrated band + one-sentence why; honest about uncertainty; survives engine noise; grounds D-02…D-04
- `.planning/NUMEN-SURFACE-VISION.md` §7a F-table — F36/F41/F45 (collapse to ONE calibrated verdict, number demoted)

### The calibration target (the OUTPUT this phase tunes)
- `src/lib/reading/verdict-bands.ts` — `VERDICT_BANDS` + `bandFor()`; **the SINGLE Phase-3 calibration target** (Phase 2 D-04). Header comment already states Phase 3 tunes THIS array + adds the buffer zone.
- `src/lib/reading/view-model.ts` (~L225-230) — verdict derivation; the `Mixed signals` branch already fires on `antiViralityGated`; the comment flags "Phase 3 adds the boundary-buffer firing." This is where D-02/D-03 land.
- `src/components/board/verdict/verdict-derive.ts` + `verdict-constants.ts` — **legacy board copies — DO NOT EDIT** (frozen, drift-redirect comments point to `verdict-bands.ts`; D-05)

### Existing rig tooling (reuse, don't rebuild — researcher/planner picks)
- `scripts/capture-reading-fixture.ts` — pairs a live SSE `complete` payload with the settled persisted row; the gate's capture/settle helper
- `scripts/smoke-tiktok-pipeline.ts` — existing E2E smoke harness (**`--direct` mode 401s — cannot auth**, see auth recipe below)
- `scripts/measure-pipeline.ts` — latency / measure-pipeline (GATE-03 "full measure-pipeline pass")
- `scripts/urls-1.txt` — test URL (@areyoukiddingtv, ~112s pipeline)

### The live path the gate exercises
- `src/app/api/analyze/route.ts` — live `complete` SSE path: `aggregateScores` → `send("complete", finalResult)` (~L1101); the racing `variants` merges. The gate POSTs here (authenticated).

### Auth-capture recipe (THE working path — critical, non-obvious)
- Memory `numen-fixture-capture-auth` (`~/.claude/projects/-Users-davideloreti-virtuna-v1-1/memory/`) — smoke `--direct` 401s (no cookie); UI mode writes wrong-shape live half. **Working path:** `pnpm dev` (or deployed URL) → Playwright login (`e2e/create-test-user.ts`, e2e-test@virtuna.local) → in-browser authenticated `fetch('/api/analyze', …)` accumulating SSE into `window.__smokeCapture` → `capture-reading-fixture.ts`. **Point the browser at the deployed Vercel URL for the gate (D-09).**

### Engine-finding provenance (F-numbers the gate asserts)
- `~/virtuna-mvp-ready/.planning/phases/01-engine-pipeline/01-WALKTHROUGH-LOG.md` — canonical F1–F47 catalog; defines F22 (confidence), F23 (§-cites), F46/F47 (read truncation) — the assertions of D-06
- Memory `engine-determinism-gate` — the `temp:0 + seed + maxRetries:0` determinism gate (engine-opt milestone). **Open question for the researcher: is it live in 3.19.0?** Determines whether variance ≈ 0 (→ D-03 floor) or ~±15pt.

### Hard constraints
- `CLAUDE.md` (project root) — engine FROZEN at 3.19.0; no `lib/engine/` edits; Tailwind v4 / Lightning CSS notes
- `.planning/phases/02-view-model-data-contract-eng-06-d-12/02-CONTEXT.md` — Phase 2 contract; D-04 (band extraction), D-07 (Mixed signals + number demoted) — the substrate this phase calibrates

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`scripts/capture-reading-fixture.ts`** — already pairs live SSE payload + settled persisted row; the gate run's capture/settle step.
- **`scripts/measure-pipeline.ts` + `scripts/smoke-tiktok-pipeline.ts`** — existing latency + E2E scaffolding (smoke `--direct` can't auth — wrap with the authenticated-browser-fetch path).
- **`src/lib/reading/verdict-bands.ts` `bandFor()`** — the band resolver; calibration adjusts the array + adds the dead-band overlay around it.
- **`view-model.ts` verdict branch** — already returns `'Mixed signals'` on `antiViralityGated`; Phase 3 OR's in the boundary-buffer firing (D-02).
- **Fixture `WEkihfOzJphv` (score 71)** — already-captured near-boundary pair; ideal variance subject (D-01c).

### Established Patterns
- **Authenticated browser-fetch capture** (memory `numen-fixture-capture-auth`) — the only path that yields a correctly-shaped live `complete` payload with a session; reuse against the deployed URL.
- **Sequential SSE accumulation** into a `window.__smokeCapture` global, polled until `complete` (a tiktok_url run ~112s) — the gate run shape; keep runs sequential for 429 mitigation (D-10).
- **Single-source band constant + drift-redirect** — `verdict-bands.ts` is canonical; board copies frozen (D-05).

### Integration Points
- **Output → Phase 4:** the calibrated `VERDICT_BANDS` + dead-band logic feed the throne verdict (READ-03/04); the recorded go/no-go (D-08) is the literal gate on starting Phase 4.
- **Gate run → `src/app/api/analyze/route.ts`** (authenticated POST) → `capture-reading-fixture.ts` → assertions (D-06) + latency sample (D-01).

</code_context>

<specifics>
## Specific Ideas

- **Fold GATE-01 latency into the variance batch** — the same 3 runs that establish score-noise also yield 3 ENG-03 latency samples; don't run two separate batches (D-01).
- **"Mixed signals" must stay common even if the engine is deterministic** — the floor buffer (D-03) is a deliberate guard so the vision's "first-class/common Mixed verdict" survives a variance-≈-0 measurement; it is NOT optional polish.
- **The gate is a human sign-off, not just a green script** — D-07 is load-bearing per the milestone's human-in-the-loop rule; a structurally-valid "confident lie" must be catchable by eyeball.
- **Confirm Vercel `maxDuration` before assuming the gate runs on Vercel** — a ~112s pipeline can silently exceed the function limit (D-09); this is a precondition, not an afterthought.

</specifics>

<deferred>
## Deferred Ideas

- **Confidence-gated buffer widening** (widen the dead-band only when `confidence_label` is MED/LOW) — a refinement on D-02, deferred unless planner adopts; not core to the gate.
- **Cross-video / per-archetype band calibration** — the gate uses single-fixed-video run-to-run noise only; tuning bands per content-archetype is a future analytics concern, not this gate.
- **Heatmap-persistence migration** — carried from Phase 2 deferred; only relevant if a later phase needs a faithful persisted heatmap. Out of scope here.
- **Prompt accuracy / token tuning** (ENG-06 surface-independent sliver) — vision §7b says it can ride a later pass, not this gate.

None of the above is scope creep into Phase 3 — all are correctly downstream.

</deferred>

---

*Phase: 3-SMOKE GATE + Verdict-Banding Calibration*
*Context gathered: 2026-06-12*
