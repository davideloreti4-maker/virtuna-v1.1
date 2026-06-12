# Phase 3: SMOKE GATE + Verdict-Banding Calibration - Research

**Researched:** 2026-06-12
**Domain:** Live E2E verification + presentation-constant calibration (NOT a UI build)
**Confidence:** HIGH (all 4 critical unknowns resolved against live code; no external libs)

<user_constraints>
## User Constraints (from 03-CONTEXT.md)

### Locked Decisions (D-01..D-10 — authoritative, do not relitigate)
- **D-01:** 3 sequential runs of ONE near-boundary video on **deployed Vercel**. Noise = run-to-run on a FIXED input (max−min spread + stdev). Folded with GATE-01 — each run is also an ENG-03 latency sample.
- **D-01b:** Escalation safeguard — if 3 runs are suspiciously identical (variance ≈ 0) OR wildly spread (>20pt), add runs (up to ~5–7) before locking.
- **D-01c:** Candidate video = existing fixture `WEkihfOzJphv` (scored 71, on the 70 boundary, pair already captured). Else `scripts/urls-1.txt` (@areyoukiddingtv, ~112s). Final pick = planner.
- **D-02:** Symmetric dead-band around each `VERDICT_BANDS` threshold (70 and 40). Half-width = `max(measured_variance, floor)`, rounded up. Score inside dead-band → "Mixed signals". OR'd with existing `antiViralityGated`.
- **D-03:** Floor buffer (~±5pt suggested) so boundary scores read Mixed even at variance ≈ 0. `buffer = max(measured_variance, floor)`.
- **D-04:** Overlay verdict, NOT a 4th ordered band. `VERDICT_BANDS` stays the clean 3-row table; dead-band logic lives in verdict derivation (`view-model.ts` ~L229-241 confidenceLanguage). Confidence-gating = optional refinement, planner discretion.
- **D-05:** Edit surface bounded — ONLY `src/lib/reading/verdict-bands.ts` + verdict-derivation buffer logic. Legacy board copies (`verdict-constants.ts`, `verdict-derive.ts`) stay byte-unchanged.
- **D-06:** Automated assertions → GREEN/RED: not-truncated (F46/F47), `confidence_label` ∈ {HIGH,MED,LOW} (F22), apollo §-cites present + taxonomy-valid (F23), `overall_score` non-null, latency captured.
- **D-07:** Human honesty sign-off — manual review: verdict honest? expert insight sane? Not automatable.
- **D-08:** Go/no-go = (all automated GREEN) ∧ (human honest/sane) ∧ (buffer > variance). Any RED blocks Phase 4. Dated decision record.
- **D-09:** Deployed Vercel = rig of record. Authenticated-browser-fetch capture pointed at deployed URL. ⚠ Confirm Vercel maxDuration ≥ pipeline length.
- **D-10:** 429 policy = document-and-retry, never gate. Sequential runs. Only total inability to get ONE clean E2E blocks.

### Claude's Discretion
- Exact floor value (~±5pt) + whether to lead with stdev or max−min.
- Reuse/extend existing scripts vs author thin variance-runner.
- Dead-band logic placement (inline in `view-model.ts` vs dedicated helper in `lib/reading/`).
- Confidence-gating refinement (adopt or defer).
- Final near-boundary video choice.

### Deferred Ideas (OUT OF SCOPE)
- Confidence-gated buffer widening (refinement on D-02).
- Cross-video / per-archetype band calibration (gate uses single-fixed-video noise only).
- Heatmap-persistence migration.
- Prompt accuracy / token tuning (ENG-06 sliver).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GATE-01 | One real-video E2E on live infra returns sane/honest output (F46/F47, F22, F23 hold live) + real ENG-03 latency + DashScope-429 documented | Auth-capture recipe verified (browser fetch → `window.__smokeCapture`); route auth gate at route.ts L405-408 (401 on no session); maxDuration=300 confirmed; assertions map to verified fixture fields |
| GATE-02 | Band buffers WIDER than measured variance; "Mixed signals" first-class | Determinism gate IS live (variance likely ≈ 0 → D-03 floor load-bearing); exact insertion point `confidenceLanguage()` view-model.ts L229-241; `verdict-bands.ts` thresholds 70/40 confirmed |
| GATE-03 | F42 authenticated permalink + full measure-pipeline pass + recorded go/no-go | `measure-pipeline.ts` runs engine LOCALLY (not Vercel) — caveat documented; reuse for the local measure pass, NOT the production latency number |
</phase_requirements>

## Summary

This is a **verification + tiny-calibration** phase, not a build. The engine (ENGINE_VERSION 3.19.0) is frozen; the only code edits are presentation constants in two files. The bulk of the work is operational: run a real video through the deployed pipeline, assert the output is honest, measure run-to-run noise, then set band-buffer constants wider than that noise.

**All four critical unknowns are resolved with code evidence:**

1. **Determinism gate IS LIVE in 3.19.0.** `temperature: 0` + `seed: QWEN_SEED (=7)` on every scoring-critical Qwen call (omni-analysis, wave3 persona, fold, deepseek/Apollo) and `maxRetries: 0` on the Qwen client. **Implication: measured same-video variance will very likely be ≈ 0 (or near it).** This makes **D-03's floor buffer LOAD-BEARING, not optional** — without it, "Mixed signals" collapses to the `antiViralityGated`-only path and contradicts the vision's "first-class/common verdict."

2. **Vercel maxDuration is NOT a blocker.** Both `vercel.json` (`maxDuration: 300, memory: 3008`) AND the route file (`export const maxDuration = 300; export const runtime = "nodejs"`) cap at the Pro maximum 300s. A ~112s pipeline fits with ~188s headroom. The D-09 landmine is cleared.

3. **Auth-capture recipe holds.** Route requires a Supabase session (401 at route.ts L405-408 with no cookie → confirms smoke `--direct` 401s). The working path is unchanged: Playwright login as `e2e-test@virtuna.local` (created by `e2e/create-test-user.ts`) → in-browser authenticated `fetch('/api/analyze')` accumulating SSE into `window.__smokeCapture` → `scripts/capture-reading-fixture.ts` pairs the live payload with the settled persisted row.

4. **Reuse vs author:** `capture-reading-fixture.ts` reuses AS-IS (capture/settle). `measure-pipeline.ts` runs the engine LOCALLY (imports `runPredictionPipeline` directly) — it is NOT a production-Vercel measurement; reuse it for the GATE-03 "measure-pipeline pass" but DO NOT source the D-09 production latency from it. **A thin variance-runner is NOT needed** — the variance batch is 3 manual authenticated browser-fetch runs against the deployed URL (the same capture path), each yielding a score + latency sample.

**Primary recommendation:** Treat this as 4 sequenced tasks: (1) live gate run + assertions, (2) 3-run variance batch on deployed Vercel (folded latency), (3) set `verdict-bands.ts` buffer constant + add the dead-band firing in `confidenceLanguage()`, (4) record dated go/no-go. Plan the floor buffer (D-03) as mandatory because the engine is deterministic.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Live E2E run (the engine work) | API / Backend (`/api/analyze` on Vercel) | — | The pipeline runs server-side; the gate POSTs here authenticated |
| Auth + SSE capture | Browser / Client (Playwright session + in-browser fetch) | API | Only an authenticated browser yields the correctly-shaped live `complete` payload (route gates on Supabase cookie) |
| Score-noise measurement | Operational (script + manual runs) | — | Run-to-run noise is an empirical measurement, not code |
| Verdict band calibration | Presentation (`lib/reading/`) | — | `VERDICT_BANDS` constant + verdict-derivation buffer — pure, no engine, no React |
| Persisted-row settle | Database / Storage (Supabase service-role read) | — | `capture-reading-fixture.ts` polls `analysis_results` until `variants.apollo` settles |

## Standard Stack

No new packages. This phase uses only existing tooling.

### Core (all present)
| Tool | Purpose | Location |
|------|---------|----------|
| `scripts/capture-reading-fixture.ts` | Pairs live SSE `complete` payload with settled persisted row | exists, 114 LOC |
| `scripts/smoke-tiktok-pipeline.ts` | E2E smoke harness (UI + `--direct` modes); `--direct` 401s | exists, 790 LOC |
| `scripts/measure-pipeline.ts` | LOCAL engine latency probe (runs `runPredictionPipeline` directly) | exists, 178 LOC |
| `e2e/create-test-user.ts` | Creates `e2e-test@virtuna.local` + completed onboarding profile | exists |
| Playwright | Browser login + authenticated in-browser fetch | `e2e/playwright.config.ts`, `pnpm e2e` |
| Vitest | Calibration unit tests (`verdict.test.ts`) | `vitest.config.ts`, `pnpm test` |

**Installation:** none — `pnpm install` already covers everything. [VERIFIED: codebase]

## Package Legitimacy Audit

Not applicable — this phase installs NO external packages. All tooling is in-repo. [VERIFIED: package.json scripts grep — no new deps]

## Critical Unknowns — Resolved

### Unknown 1: Determinism gate live in 3.19.0? — **YES** [VERIFIED: codebase]

Grep of `src/lib/engine/` confirms the engine-opt determinism gate is fully live:

| Call site | Config | File:line |
|-----------|--------|-----------|
| Qwen client (all calls) | `maxRetries: 0` | `qwen/client.ts:15` |
| Omni read/analysis | `temperature: 0, seed: QWEN_SEED` | `qwen/omni-analysis.ts:258-259` |
| Wave3 persona scores | `temperature: 0, seed: QWEN_SEED` | `wave3.ts:164-165` |
| Fold (audience sim) | `temperature: 0, seed: QWEN_SEED` (R8) | `wave3/fold.ts:341-344` |
| DeepSeek/Apollo judge | `temperature: 0, seed: QWEN_SEED` (D-10) | `deepseek.ts:545-546` |

`QWEN_SEED = 7` (`qwen/client.ts:28`). The header comment states this is "the precondition for a trustworthy eval/weight-fit number… same input yields the same score run-to-run. Greedy decoding (temp 0) is the primary lever; the seed pins residual nondeterminism (notably thinking-mode stages)."

**Implication for D-03:** Measured same-video variance will very likely be ≈ 0 or near-0. **The floor buffer is mandatory, not polish** — it is the ONLY thing keeping "Mixed signals" first-class. Caveat: DashScope thinking-mode stages and any non-seeded server-side jitter can still introduce small drift; the variance batch MEASURES this rather than assuming. The D-01b escalation ("suspiciously identical → variance ≈ 0") is the expected outcome here and is by-design, not a red flag.

### Unknown 2: Vercel maxDuration vs ~112s pipeline — **NOT A BLOCKER** [VERIFIED: codebase]

Two independent declarations both set 300s (Pro cap):
- `vercel.json`: `"src/app/api/analyze/route.ts": { "maxDuration": 300, "memory": 3008 }`
- `route.ts:373-375`: `export const runtime = "nodejs"; export const maxDuration = 300;`

A ~112s pipeline has ~188s headroom. Route comment (L31) notes "bump to 800 on Pro if needed" — not needed at current latency. **No precondition task required for maxDuration.** (Plan should still treat a slow-tail run that approaches 300s as a possible 429-adjacent failure mode under D-10, but the function limit itself is cleared.)

### Unknown 3: Auth-capture recipe verified — **HOLDS** [VERIFIED: codebase]

- Route requires a Supabase session: `route.ts:403-409` → `supabase.auth.getUser()`; `if (!user) return 401`. Confirms smoke `--direct` 401s (no cookie).
- `capture-reading-fixture.ts` header documents exactly this: `--direct` can't auth; UI mode writes the RAW row as the "live" half (wrong shape for `canonicalFromLive`, which reads `result.hero`/`result.apollo_reasoning` top-level). So the genuine live `complete` SSE payload must come from an authenticated browser fetch (top-level shape intact).
- Capture interface: `pnpm tsx scripts/capture-reading-fixture.ts <live-payload.json> <user-id>`. It (1) reads the captured live payload, (2) polls `analysis_results` for the most-recent row for `user-id`, retrying up to 6× / 2s until `variants.apollo` settles, (3) writes `live-<id>.json` + `persisted-<id>.json` to `src/lib/reading/__tests__/fixtures/`.
- `e2e/create-test-user.ts` creates/ensures `e2e-test@virtuna.local` (pw `e2e-test-password-2026`) with `onboarding_completed_at` set. Run `npx tsx e2e/create-test-user.ts` first.
- **For D-09: point the browser at the deployed Vercel URL** (not localhost). The session cookie comes from logging into the deployed app; the in-browser `fetch('/api/analyze', …)` then carries it.

### Unknown 4: Reuse vs author — **REUSE, no new runner needed** [VERIFIED: codebase]

| Need | Tool | Verdict |
|------|------|---------|
| Live gate run + capture | Authenticated browser fetch → `window.__smokeCapture` → `capture-reading-fixture.ts` | **Reuse as-is.** The capture script needs no change. |
| 3-run variance batch (sequential, 429-safe) | Repeat the same authenticated browser-fetch run 3× against deployed URL, record `overall_score` + wall-clock each time | **No new script.** Each run is one manual capture; sequential = inherent 429-safety (D-10). A thin shell wrapper to tally max−min/stdev is optional convenience, not required. |
| Measure-pipeline pass (GATE-03) | `measure-pipeline.ts` | **Reuse — but it runs the engine LOCALLY** (imports `runPredictionPipeline`/`aggregateScores` directly at L24-25). It prints a greppable `OVERALL_SCORE=… CONFIDENCE=… LABEL=…` line + per-stage durations. ⚠ **This is a LOCAL latency, not the production D-09 number.** Use it for the structural "measure-pipeline pass" (GATE-03) and as a sanity cross-check, NOT as the ENG-03 production latency. |

`smoke-tiktok-pipeline.ts` flags: `<urls.txt> [--direct] [--json-out <path>] [--user-id <uuid>]`. `--direct` is unusable for the gate (401). Its UI mode polls Supabase but writes wrong-shape live half. **Net: the browser-fetch path is the only correct capture; the smoke script is not the gate driver.**

## The Calibration Target (exact current state)

### `src/lib/reading/verdict-bands.ts` [VERIFIED: codebase]
Current `VERDICT_BANDS` (descending `min`):
```ts
export const VERDICT_BANDS: readonly VerdictBand[] = [
  { id: 'high',       label: 'High potential', min: 70 },
  { id: 'solid',      label: 'Solid contender', min: 40 },
  { id: 'needs-work', label: 'Needs work',      min: 0 },
] as const;

export function bandFor(score: number): VerdictBand {
  return VERDICT_BANDS.find((b) => score >= b.min) ?? VERDICT_BANDS[VERDICT_BANDS.length - 1]!;
}
```
Thresholds = **70 and 40**. The header comment already states "Phase 3 calibration tunes THIS array (and only this array): it adjusts the thresholds against measured same-video score variance and adds the buffer zone." This is the SINGLE calibration target.

### `src/lib/reading/view-model.ts` — the Mixed-signals seam [VERIFIED: codebase]
The verdict block is built at **L134-139**:
```ts
blocks.push({
  kind: 'verdict',
  band: bandFor(c.overallScore),       // L136
  why: deriveWhy(c),
  confidenceLanguage: confidenceLanguage(c),  // L138 — the seam
  score: c.overallScore,
});
```
The Mixed-signals branch is **`confidenceLanguage()` at L229-241**:
```ts
function confidenceLanguage(c: CanonicalReading): string {
  if (c.antiViralityGated) return 'Mixed signals';     // L230 — existing trigger
  switch (c.confidenceLabel) {
    case 'HIGH':   return 'Confident read';
    case 'MEDIUM': return 'Reasonably confident';
    case 'LOW':    return 'Tentative read';
    default:       return 'Tentative read';
  }
}
```
The header comment (L223-228) explicitly flags: *"Phase 3 adds the boundary-buffer firing (the gate already routes here — a clear seam, no new branch needed)."*

**Insertion point for D-02/D-03:** OR the dead-band test into L230, e.g. `if (c.antiViralityGated || inDeadBand(c.overallScore)) return 'Mixed signals';`. `inDeadBand` checks whether `overallScore` is within `buffer` of any `VERDICT_BANDS` threshold (70, 40). Per D-04 the buffer logic can live inline here OR in a dedicated `lib/reading/` helper (planner discretion) — but it must NOT add a 4th band to `VERDICT_BANDS`. `antiViralityGated` is computed at view-model.ts L71 (`r.anti_virality_gated ?? confidence < 0.4`).

### Legacy board copies — FROZEN, DO NOT EDIT (D-05) [VERIFIED: codebase]
- `src/components/board/verdict/verdict-constants.ts` `BAND_THRESHOLDS = { STRONG: 70, MID: 40 }` — carries the drift-redirect comment: *"LEGACY board-only copy. The single source of truth for verdict bands is now VERDICT_BANDS… Phase 3 verdict-band CALIBRATION edits VERDICT_BANDS, NOT this constant — do not re-tune the numbers here."*
- `src/components/board/verdict/verdict-derive.ts` — board-only pure derivations. Leave byte-unchanged.

## The Gate Assertions (D-06) — verified against the real fixture

The existing fixture `live-WEkihfOzJphv.json` (the captured near-boundary pair, score 71) is the concrete proof these assertions are satisfiable [VERIFIED: codebase via node inspection]:

| Assertion (F-number) | Field | WEkihfOzJphv value | Verdict |
|----------------------|-------|--------------------|---------|
| Not truncated (F46/F47) | full read fields present | hero + apollo_reasoning both present | structural check passes |
| Confidence present (F22) | `confidence_label` ∈ {HIGH,MED,LOW} | `"HIGH"` (confidence 0.8) | present + valid |
| §-cites present + taxonomy-valid (F23) | apollo `§N.N` citations | `§2.1 §2.2 §2.3 §2.5` (9 cites total) | present + KNOWLEDGE-CORE §2.x taxonomy |
| `overall_score` non-null (F45) | `overall_score` | `71` | non-null |
| Latency captured (ENG-03) | wall-clock per run | (measured live) | captured per run |

**F-number provenance:** F22/F23/F46/F47 defined in `~/virtuna-mvp-ready/.planning/phases/01-engine-pipeline/01-WALKTHROUGH-LOG.md` (canonical F1–F47 catalog). The gate script should assert these as deterministic GREEN/RED, then D-07 human sign-off reviews the produced Reading for honesty.

## DashScope-429 behavior (D-10) [VERIFIED: codebase]

- **DashScope retry lives in the engine, not the route.** `deepseek.ts` has a circuit breaker (INFRA-03): backoff schedule 1s/3s/9s (`BACKOFF_SCHEDULE_MS`, L38-99), half-open probe, and explicit `429` handling at L606 (`lastError.message.includes("429")`) with exponential backoff 1s/3s (L611). On open circuit it returns `null` and the caller degrades gracefully — Apollo can come back absent rather than crash.
- **The route's own `429` (route.ts:538) is an internal per-user rate limiter**, NOT DashScope. The gate's single sequential runs won't trip it, but note it exists.
- `maxRetries: 0` on the Qwen client (client.ts:15) means each engine stage owns its own retry loop — DashScope 429s surface to those manual loops, not the SDK.
- **Gate behavior (D-10):** runs sequential (never parallel) → minimizes 429 exposure. On a 429, the engine's own backoff handles it; the gate documents frequency + whether Apollo degraded. Only total inability to ever get one clean E2E blocks.

## Architecture Patterns

### The gate run shape (data flow)
```
[deployed Vercel app] ──Playwright login──> [authenticated browser session + cookie]
        │
        │  in-browser fetch('/api/analyze', { tiktok_url | video }) — carries cookie
        ▼
[/api/analyze route.ts]  auth ✓ (L405) → runPredictionPipeline → aggregateScores (L977)
        │                                      │ (engine FROZEN 3.19.0, deterministic)
        │  SSE stream: stage_start/end … send("complete", finalResult)  (L1101)
        ▼
[browser] accumulate SSE events into window.__smokeCapture until "complete"
        │
        │  dump window.__smokeCapture.complete → live-payload.json
        ▼
[capture-reading-fixture.ts <live.json> <user-id>]
        │  poll analysis_results (service-role) until variants.apollo settles (≤6×/2s)
        ▼
[live-<id>.json + persisted-<id>.json]  →  ASSERTIONS (D-06)  +  latency sample (D-01)
```

### Pattern: buffer is "wider than variance" BY CONSTRUCTION (D-02/D-03)
`buffer = ceil(max(measured_variance_halfwidth, floor))`. Because `buffer ≥ variance` and we round up, `buffer > variance` is strictly true and falsifiable. A score within `buffer` of 70 or 40 → "Mixed signals". With a deterministic engine, `measured_variance ≈ 0` → `buffer = floor` (~5pt suggested) — which is exactly why the floor must exist.

### Anti-patterns to avoid
- **Sourcing the production latency from `measure-pipeline.ts`** — it runs the engine locally; the D-09 number must come from the deployed-Vercel browser-fetch run.
- **Editing the legacy board copies** (`verdict-constants.ts`/`verdict-derive.ts`) — D-05 forbids; they are frozen with redirect comments.
- **Adding a 4th band to `VERDICT_BANDS`** — D-04 requires Mixed-signals as an OVERLAY in derivation, not an ordered band row.
- **Running variance batch in parallel** — D-10 mandates sequential for 429 safety.
- **Trusting 3 identical runs as "zero variance, locked"** without the D-01b sanity (identical is EXPECTED given determinism, but verify the runs actually reached `complete`, not cached/failed-identical).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Live payload capture/settle | A new SSE poller + Supabase settle loop | `capture-reading-fixture.ts` (exists) | Already handles the `variants.apollo` settle race (Pitfall 2) + MCP double-encoding |
| Authenticated session for the gate | A token-injection hack | Playwright login as `e2e-test@virtuna.local` + in-browser fetch | The only path yielding correctly-shaped top-level live payload (route gates on cookie) |
| Test user provisioning | Manual Supabase row inserts | `e2e/create-test-user.ts` | Ensures profile + onboarding flag so `/api/analyze` doesn't reject |
| Stage-timeline measurement | New timing harness | `measure-pipeline.ts` (local) | Already reconstructs wall-clock from StageEvents + greppable score line |
| Engine determinism | Anything | Already live (temp:0+seed:7+maxRetries:0) | Do NOT touch engine — it's frozen and already deterministic |

## Common Pitfalls

### Pitfall 1: Mistaking local latency for production latency (D-09)
**What goes wrong:** Using `measure-pipeline.ts` output as the ENG-03 number. It runs the pipeline in-process on the dev machine — different network, cold-start, and compute than Vercel.
**How to avoid:** The D-09 production latency MUST be the wall-clock of the deployed-Vercel browser-fetch run. Use `measure-pipeline.ts` only for the GATE-03 structural "measure-pipeline pass" + a sanity cross-check.

### Pitfall 2: Variance ≈ 0 collapses Mixed-signals (the D-03 reason)
**What goes wrong:** Engine is deterministic → 3 runs return the identical score → `measured_variance = 0` → if buffer = variance, no boundary score ever reads Mixed → contradicts the vision's first-class Mixed verdict.
**Why it happens:** temp:0+seed:7 is live in 3.19.0 (verified).
**How to avoid:** `buffer = max(variance, floor)` with floor ~±5pt. The floor is load-bearing.
**Warning sign:** 3 identical scores (expected) — do NOT set buffer to 0.

### Pitfall 3: `variants.apollo` not yet settled when capturing
**What goes wrong:** The persisted row is written before the post-`complete` `variants.apollo` async write lands → fixture missing Apollo half.
**How to avoid:** `capture-reading-fixture.ts` already retries 6×/2s until `variants.apollo` present, then aborts if it never settles. Don't bypass it.

### Pitfall 4: Editing the wrong band file
**What goes wrong:** Tuning `BAND_THRESHOLDS` in `verdict-constants.ts` (board) instead of `VERDICT_BANDS` in `verdict-bands.ts` (Reading).
**How to avoid:** Both legacy files carry drift-redirect comments. D-05 bounds the edit surface to `verdict-bands.ts` + the derivation. Calibration tests live in `src/lib/reading/__tests__/verdict.test.ts`.

## Code Examples

### Existing verdict test harness (extend for the buffer) [VERIFIED: codebase]
```ts
// src/lib/reading/__tests__/verdict.test.ts — the calibration test surface
// Existing assertions already lock: bandFor(77)='High potential', bandFor(50)='Solid contender',
// bandFor(20)='Needs work', confidence in LANGUAGE not number, /100 demoted.
// Phase 3 ADDS: a near-boundary score (e.g. 71, 69, 41, 39) → confidenceLanguage === 'Mixed signals'.
const verdictBlock = (over: Partial<PredictionResult> = {}): VerdictBlock => {
  const blocks = toReadingBlocks(canonicalFromLive(result(over)));
  return blocks.find((b): b is VerdictBlock => b.kind === "verdict")!;
};
// New test shape:
// expect(verdictBlock({ overall_score: 71 }).confidenceLanguage).toBe('Mixed signals'); // within +5 of 70
// expect(verdictBlock({ overall_score: 85 }).confidenceLanguage).not.toBe('Mixed signals'); // clear of any threshold
```

### Dead-band insertion seam [VERIFIED: codebase — view-model.ts L229-241]
```ts
// Phase 3 (D-02/D-03): OR the boundary buffer into the existing seam.
function confidenceLanguage(c: CanonicalReading): string {
  if (c.antiViralityGated || inDeadBand(c.overallScore)) return 'Mixed signals';
  switch (c.confidenceLabel) { /* … unchanged … */ }
}
// inDeadBand: true if overallScore within `buffer` of any VERDICT_BANDS threshold (70, 40).
// buffer = Math.ceil(Math.max(measuredVarianceHalfwidth, FLOOR /* ~5 */));
```

## State of the Art

| Old Approach | Current Approach | When | Impact |
|--------------|------------------|------|--------|
| `--direct` smoke POST | Authenticated browser-fetch capture | Phase 2 (DATA-02) | `--direct` 401s; browser fetch is the only correct path |
| Non-deterministic scorer | temp:0 + seed:7 + maxRetries:0 | engine-opt milestone | Same video → same score; variance ≈ 0 → D-03 floor mandatory |
| Duplicated band thresholds (2 board files) | Single `VERDICT_BANDS` + drift-redirect comments | Phase 2 (D-04) | Calibration edits ONE file |

## Runtime State Inventory

Not a rename/refactor/migration phase. **N/A — this phase writes NO stored data renames; the only persisted artifacts are the captured fixtures (`live-<id>.json`/`persisted-<id>.json`) which are test fixtures, not runtime state.**

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Measured same-video variance will be ≈ 0 (because temp:0+seed live) | Critical Unknown 1 | LOW — the variance batch MEASURES it; if it's non-zero, `buffer=max(variance,floor)` still holds. Assumption only affects expectations, not correctness. |
| A2 | ~112s pipeline length (from vision/CONTEXT) is current | Critical Unknown 2 | LOW — even at 2× (224s) it fits under 300s; `measure-pipeline.ts` will give the real local number |
| A3 | F22/F23/F46/F47 definitions match the WALKTHROUGH-LOG catalog | Gate Assertions | LOW — verified against the real fixture's actual field shapes |
| A4 | Floor ~±5pt is adequate (D-03 suggestion) | Calibration | LOW — planner/Davide discretion per CONTEXT; tunable constant |

## Open Questions

1. **Exact floor value (±5pt suggested).** Planner/Davide discretion (D-03). Recommendation: ±5pt as a starting constant in `verdict-bands.ts`; the variance figure will confirm it's safely above measured noise.
2. **Lead with stdev or max−min spread?** Claude's discretion (D-01). Recommendation: report BOTH; lead with max−min (more conservative, directly comparable to the buffer half-width).
3. **Confidence-gated buffer widening — adopt or defer?** D-04 says optional. Recommendation: DEFER (CONTEXT lists it under Deferred Ideas as a refinement); the floor + variance buffer is sufficient for the gate.
4. **Which near-boundary video?** D-01c. Recommendation: `WEkihfOzJphv` (score 71, pair already captured, sits on the 70 boundary) as primary — minimizes a fresh capture and directly stresses the dead-band.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Deployed Vercel app | D-09 production rig | assumed (CLAUDE.md: "Deployed: Vercel") | — | none — D-09 mandates production rig |
| `DASHSCOPE_API_KEY` | engine runs | env (`.env.local`) | — | none — gate needs real engine |
| Supabase service-role key | capture settle + test user | env (`.env.local`) | — | none |
| Playwright | browser login + fetch | in repo (`pnpm e2e`) | — | manual browser login + devtools fetch |
| `e2e-test@virtuna.local` | authenticated session | created via `e2e/create-test-user.ts` | — | re-run create-test-user.ts |

**Missing dependencies with no fallback:** none identified — all are env/credentials the project already has for prior captures (the WEkihfOzJphv pair was already captured this way).

## Validation Architecture

> nyquist_validation not explicitly false in config → included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (`vitest.config.ts`) |
| Quick run command | `pnpm test src/lib/reading/__tests__/verdict.test.ts` |
| Full suite command | `pnpm test` |
| Gate/E2E | Manual authenticated browser-fetch run (not a Vitest test) + `pnpm tsx scripts/measure-pipeline.ts` (local cross-check) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GATE-01 | Live output honest (F22/F23/F46/F47, score non-null) | E2E (manual gate, scripted assertions) | authenticated browser fetch → assert script over `live-<id>.json` | ✅ capture exists; ❌ assertion script (Wave 0) |
| GATE-02 (calibration) | Near-boundary score → 'Mixed signals'; buffer > variance | unit | `pnpm test src/lib/reading/__tests__/verdict.test.ts` | ✅ verdict.test.ts exists — ADD dead-band cases |
| GATE-02 (variance) | 3-run same-video noise figure | manual (operational) | 3× browser-fetch on deployed URL, record score+latency | ✅ capture path exists |
| GATE-03 | measure-pipeline pass + F42 permalink | E2E (manual) | `pnpm tsx scripts/measure-pipeline.ts` (local) + open authenticated permalink | ✅ exists |

### Sampling Rate
- **Per task commit:** `pnpm test src/lib/reading/__tests__/verdict.test.ts`
- **Per wave merge:** `pnpm test` (full Vitest suite — must stay GREEN; identical-render.test.ts guards the view-model contract)
- **Phase gate:** all automated GREEN + human honesty sign-off (D-07) + recorded dated go/no-go (D-08)

### Wave 0 Gaps
- [ ] Dead-band test cases in `src/lib/reading/__tests__/verdict.test.ts` — covers GATE-02 calibration (near-boundary 71/69/41/39 → 'Mixed signals'; clear-of-threshold → not Mixed)
- [ ] A thin assertion helper/script over the captured `live-<id>.json` for GATE-01 D-06 GREEN/RED (truncation/confidence_label/§-cites/score) — OR fold into the gate run checklist
- [ ] (Optional) shell tally for max−min/stdev across the 3 variance runs — convenience only

*Framework already installed; no framework gap.*

## Security Domain

This is a presentation-constant + operational verification phase touching no auth/crypto/data boundaries beyond REUSING the existing authenticated path.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | reused | `/api/analyze` gates on `supabase.auth.getUser()` (route.ts L405) — unchanged |
| V5 Input Validation | reused | route already validates body size (287MB, L415) + tiktok_url — unchanged |
| V6 Cryptography | no | no crypto in scope |

**Note:** the test user (`e2e-test@virtuna.local`, pw in `create-test-user.ts`) is a non-secret fixture credential for a local/dev Supabase user — acceptable per existing pattern; do not promote to production secrets. No new secrets introduced.

## Sources

### Primary (HIGH confidence — codebase)
- `src/lib/engine/qwen/client.ts`, `qwen/omni-analysis.ts`, `wave3.ts`, `wave3/fold.ts`, `deepseek.ts` — determinism gate live (temp:0+seed:7+maxRetries:0)
- `vercel.json` + `src/app/api/analyze/route.ts` L373-375, L405-408 — maxDuration=300, runtime=nodejs, auth gate
- `src/lib/reading/verdict-bands.ts` — VERDICT_BANDS 70/40 + bandFor
- `src/lib/reading/view-model.ts` L71, L134-139, L229-241 — verdict block + confidenceLanguage seam + antiViralityGated
- `src/components/board/verdict/verdict-constants.ts` / `verdict-derive.ts` — frozen legacy copies + drift comments
- `scripts/capture-reading-fixture.ts`, `measure-pipeline.ts`, `smoke-tiktok-pipeline.ts`, `e2e/create-test-user.ts` — rig tooling
- `src/lib/reading/__tests__/fixtures/live-WEkihfOzJphv.json` (node inspection: score 71, confidence_label HIGH, §2.1-2.5 cites) + `verdict.test.ts`

### Secondary (referenced, not re-read this session)
- `~/virtuna-mvp-ready/.planning/phases/01-engine-pipeline/01-WALKTHROUGH-LOG.md` — F22/F23/F46/F47 catalog
- Memory `numen-fixture-capture-auth`, `engine-determinism-gate` — recipe + determinism claim (now VERIFIED in code)

## Metadata

**Confidence breakdown:**
- Critical unknowns: HIGH — all 4 resolved with direct code evidence
- Standard stack: HIGH — no new packages, all tooling verified present
- Calibration target: HIGH — exact lines, thresholds, seam, frozen files all confirmed
- Pitfalls: HIGH — derived from verified code (local-vs-prod latency, determinism, settle race)
- Variance prediction (≈0): MEDIUM — code says deterministic; thinking-mode/server jitter unmeasured until the batch runs (by design)

**Research date:** 2026-06-12
**Valid until:** 2026-07-12 (stable — engine frozen, no fast-moving external deps)
