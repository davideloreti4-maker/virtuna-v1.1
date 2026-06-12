# Phase 03: SMOKE GATE + Verdict-Banding Calibration - Pattern Map

**Mapped:** 2026-06-12
**Files analyzed:** 5 (2 MODIFIED, 1 MODIFIED-test, 1 OPTIONAL-NEW helper, 1 OPTIONAL-NEW script) + 3 REUSED-as-is
**Analogs found:** 4 / 4 (every new/modified file has an in-file or sibling analog)

> **Phase nature:** verification + presentation-constant calibration. Engine FROZEN at `ENGINE_VERSION 3.19.0` — NO `src/lib/engine/` edits, NO version bump (CLAUDE.md + D-05). The only production-code edits are two `src/lib/reading/` files; everything else is operational (live runs) or test.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/reading/verdict-bands.ts` | utility (pure constant + resolver) | transform | self (in-file `bandFor`) — adds `inDeadBand`/`DEAD_BAND_FLOOR` | exact (extend existing module) |
| `src/lib/reading/view-model.ts` | utility (pure selector) | transform | self (in-file `confidenceLanguage` L229-241 seam) | exact (one-line OR into existing branch) |
| `src/lib/reading/__tests__/verdict.test.ts` | test | request-response (assert) | self (existing `verdictBlock()` factory + describe blocks) | exact (add cases) |
| *(OPTIONAL, D-04 discretion)* `src/lib/reading/dead-band.ts` helper | utility | transform | `verdict-bands.ts` `bandFor` | role-match — only if planner extracts `inDeadBand` out of view-model |
| *(OPTIONAL, D-06 discretion)* `scripts/gate-assert.ts` | script (CLI assertion) | batch / file-I/O | `scripts/capture-reading-fixture.ts` + `scripts/measure-pipeline.ts` | role-match |

**REUSED as-is (NOT new code — skip analog hunt, do NOT modify):**
- `scripts/capture-reading-fixture.ts` — capture/settle (live SSE payload ↔ persisted row). Reuse verbatim.
- `scripts/smoke-tiktok-pipeline.ts` — `--direct` 401s; NOT the gate driver. Reference only.
- `scripts/measure-pipeline.ts` — LOCAL engine probe; reuse for GATE-03 structural pass + cross-check ONLY (NOT the D-09 production latency).
- `e2e/create-test-user.ts` — provisions `e2e-test@virtuna.local`. Run before capture; no edit.

**FROZEN — DO NOT EDIT (D-05):**
- `src/components/board/verdict/verdict-constants.ts` (`BAND_THRESHOLDS = { STRONG: 70, MID: 40 }`) — carries drift-redirect comment to `verdict-bands.ts`.
- `src/components/board/verdict/verdict-derive.ts` — board-only derivations, byte-unchanged.
- All `src/lib/engine/**` — frozen at 3.19.0.

---

## Pattern Assignments

### `src/lib/reading/verdict-bands.ts` (utility, transform) — MODIFIED

**Analog:** self. The module already declares (header L10-16) that "Phase 3 calibration tunes THIS array … and adds the buffer zone." Extend it; do NOT add a 4th band row (D-04).

**Current constant + resolver** (lines 34-50, unchanged shape):
```ts
export const VERDICT_BANDS: readonly VerdictBand[] = [
  { id: 'high', label: 'High potential', min: 70 },
  { id: 'solid', label: 'Solid contender', min: 40 },
  { id: 'needs-work', label: 'Needs work', min: 0 },
] as const;

export function bandFor(score: number): VerdictBand {
  return (
    VERDICT_BANDS.find((b) => score >= b.min) ??
    VERDICT_BANDS[VERDICT_BANDS.length - 1]!
  );
}
```

**Phase-3 additions (mirror `bandFor`'s pure-total style):**
- A `DEAD_BAND_FLOOR` constant (~5pt, D-03 — load-bearing because the engine is deterministic, variance likely ≈ 0). Document the measured-variance source in a comment.
- An `inDeadBand(score: number, buffer = DEAD_BAND_FLOOR): boolean` resolver. The thresholds it tests are the SAME `VERDICT_BANDS[].min` values that are NOT the terminal `0` (i.e. 70 and 40) — derive them from the array, don't hard-code, so they track any threshold re-tune. Pattern: `buffer = Math.ceil(Math.max(measuredVarianceHalfwidth, DEAD_BAND_FLOOR))`; `buffer > variance` is true by construction (round up).

**Match quality:** exact — extend the canonical module, no new file required. (D-04 permits a dedicated helper instead; see OPTIONAL row.)

---

### `src/lib/reading/view-model.ts` (utility, transform) — MODIFIED

**Analog:** self. The `confidenceLanguage()` seam already routes 'Mixed signals' and the header (L223-227) flags Phase 3 as "a clear seam, no new branch needed."

**Imports pattern** (lines 32-34 — extend the existing band import):
```ts
import type { PredictionResult } from '@/lib/engine/types';
import type { CanonicalReading, Fix, ReadingBlock } from './block-types';
import { bandFor } from './verdict-bands';
```
Phase 3: add `inDeadBand` (and any buffer constant) to the `./verdict-bands` import — keep the single-import-from-canonical pattern.

**Verdict block construction** (lines 134-140 — UNCHANGED; the seam is `confidenceLanguage(c)`):
```ts
blocks.push({
  kind: 'verdict',
  band: bandFor(c.overallScore),
  why: deriveWhy(c),
  confidenceLanguage: confidenceLanguage(c),   // ← the seam D-02/D-03 land in
  score: c.overallScore,
});
```

**Core pattern — the exact one-line edit** (lines 229-241, the `confidenceLanguage` branch):
```ts
function confidenceLanguage(c: CanonicalReading): string {
  if (c.antiViralityGated) return 'Mixed signals';   // L230 — OR the dead-band test in HERE
  switch (c.confidenceLabel) {
    case 'HIGH':   return 'Confident read';
    case 'MEDIUM': return 'Reasonably confident';
    case 'LOW':    return 'Tentative read';
    default:       return 'Tentative read';
  }
}
```
Phase-3 edit (D-02): `if (c.antiViralityGated || inDeadBand(c.overallScore)) return 'Mixed signals';`. The `antiViralityGated` input is computed at L71 (`r.anti_virality_gated ?? confidence < 0.4`). Pure function, no I/O, no new branch — preserves the existing omit-discipline doctrine (file header L9-30).

**Match quality:** exact — single OR clause into an existing branch.

---

### `src/lib/reading/__tests__/verdict.test.ts` (test) — MODIFIED

**Analog:** self. Reuse the existing `result()` override-factory + `verdictBlock()` helper and the `describe` structure verbatim.

**Factory + accessor pattern to reuse** (lines 30-48):
```ts
const result = (over: Partial<PredictionResult> = {}): PredictionResult =>
  ({ overall_score: 77, confidence: 0.6, confidence_label: "MEDIUM",
     anti_virality_gated: false, /* … */ ...over }) as unknown as PredictionResult;

const verdictBlock = (over: Partial<PredictionResult> = {}): VerdictBlock => {
  const blocks = toReadingBlocks(canonicalFromLive(result(over)));
  const v = blocks.find((b): b is VerdictBlock => b.kind === "verdict");
  if (!v) throw new Error("verdict block missing — it must never be omitted");
  return v;
};
```

**Existing assertion style to mirror** (lines 80-84):
```ts
it("expresses confidence in band language, NOT a number", () => {
  const v = verdictBlock({ confidence_label: "HIGH" });
  expect(typeof v.confidenceLanguage).toBe("string");
  expect(v.confidenceLanguage).not.toMatch(/\d/);
});
```

**Phase-3 cases to ADD (GATE-02 calibration coverage):**
```ts
// within FLOOR of 70 → Mixed; within FLOOR of 40 → Mixed
expect(verdictBlock({ overall_score: 71 }).confidenceLanguage).toBe('Mixed signals');
expect(verdictBlock({ overall_score: 69 }).confidenceLanguage).toBe('Mixed signals');
expect(verdictBlock({ overall_score: 41 }).confidenceLanguage).toBe('Mixed signals');
expect(verdictBlock({ overall_score: 39 }).confidenceLanguage).toBe('Mixed signals');
// clear of any threshold → NOT Mixed
expect(verdictBlock({ overall_score: 85, confidence_label: 'HIGH' }).confidenceLanguage).not.toBe('Mixed signals');
```
Note the override factory defaults `anti_virality_gated: false` so these cases isolate the dead-band trigger from the existing `antiViralityGated` path.

**Run command:** `pnpm test src/lib/reading/__tests__/verdict.test.ts` (per-commit); `pnpm test` per wave merge (keep `identical-render.test.ts` GREEN).

**Match quality:** exact — additive, same file, same helpers.

---

### `src/lib/reading/dead-band.ts` — OPTIONAL NEW (D-04 placement discretion)

Only if the planner chooses a dedicated helper over inline `inDeadBand` in view-model. If created, it copies the `verdict-bands.ts` pure-total style (no React, no I/O, derive thresholds from `VERDICT_BANDS`). Recommendation: keep it IN `verdict-bands.ts` (fewer files, the constant + its buffer logic co-located) unless the buffer math grows beyond ~10 lines.

**Analog:** `src/lib/reading/verdict-bands.ts` `bandFor` (lines 45-50) — same module conventions.

---

### `scripts/gate-assert.ts` — OPTIONAL NEW (D-06 discretion; may instead be a checklist)

RESEARCH (Unknown 4) says NO new variance-runner is needed. A thin GREEN/RED assertion over the captured `live-<id>.json` is the only candidate new script, and even that may fold into the gate checklist. If authored, copy the dotenv + tsconfig-paths bootstrap and Supabase-service-role client setup from the two rig scripts.

**Analog A — bootstrap + CLI-arg + fixtures-dir pattern** from `scripts/capture-reading-fixture.ts` (lines 23-38):
```ts
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { createClient } from "@supabase/supabase-js";
config({ path: resolve(__dirname, "../.env.local") });

const [livePayloadPath, userId] = process.argv.slice(2);
if (!livePayloadPath || !userId) { console.error("Usage: …"); process.exit(1); }
const FIXTURES_DIR = resolve(__dirname, "../src/lib/reading/__tests__/fixtures");
```

**Analog B — tsconfig-paths register + env guards + greppable output line** from `scripts/measure-pipeline.ts` (lines 14-21, 36-40):
```ts
import { register } from "tsconfig-paths";
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });
// …
if (!process.env.DASHSCOPE_API_KEY) throw new Error("DASHSCOPE_API_KEY missing");
```
The script should print a greppable verdict line (mirror measure-pipeline's `OVERALL_SCORE=… CONFIDENCE=… LABEL=…`) so the gate decision is machine-readable.

**Assertions to encode (D-06), each GREEN/RED, validated against `live-WEkihfOzJphv.json` (score 71, confidence_label HIGH, §2.1-2.5 cites):**
- not truncated (F46/F47): `hero` + `apollo_reasoning` both present (top-level).
- `confidence_label` ∈ {HIGH, MED, LOW} (F22).
- apollo `§N.N` citations present + KNOWLEDGE-CORE §2.x taxonomy-valid (F23).
- `overall_score` non-null (F45).
- latency captured per run (ENG-03).

**Match quality:** role-match — assembles two existing script idioms.

---

## Shared Patterns

### Pure-selector / omit-discipline doctrine
**Source:** `src/lib/reading/view-model.ts` header (L1-30) + `deriveWhy` (L215-221).
**Apply to:** all `src/lib/reading/` edits.
Every value traces to a real engine field; absence → omit or empty, NEVER fabricate. `confidenceLanguage` and `inDeadBand` stay pure (no React, no fetch). The dead-band overlay is wording-level (D-02), not a fabricated block.

### Single-source band constant + drift-redirect
**Source:** `src/lib/reading/verdict-bands.ts` header (L10-16) + the two frozen board copies' redirect comments.
**Apply to:** ALL band/threshold edits.
`VERDICT_BANDS` is canonical. Tune thresholds and add the buffer HERE only. `verdict-constants.ts` (`BAND_THRESHOLDS = { STRONG: 70, MID: 40 }`) and `verdict-derive.ts` stay byte-unchanged (D-05, Pitfall 4).

### Authenticated browser-fetch capture (the gate run shape)
**Source:** `scripts/capture-reading-fixture.ts` header (L1-22) + memory `numen-fixture-capture-auth`.
**Apply to:** GATE-01 live run + GATE-02 variance batch.
`--direct` 401s (no cookie); UI mode writes wrong-shape live half. ONLY correct path: Playwright login as `e2e-test@virtuna.local` → in-browser authenticated `fetch('/api/analyze')` accumulating SSE into `window.__smokeCapture` → `capture-reading-fixture.ts <live.json> <user-id>` (polls `analysis_results` 6×/2s until `variants.apollo` settles). Point the browser at the **deployed Vercel URL** (D-09). Runs **sequential** (D-10, 429 safety).

### Script bootstrap (dotenv + tsconfig-paths + service-role client + env guards)
**Source:** `scripts/measure-pipeline.ts` (L14-40) and `scripts/capture-reading-fixture.ts` (L23-40).
**Apply to:** any optional new gate script.
`config({ path: "../.env.local" })`; `register({ paths: tsconfig.compilerOptions.paths })`; `createClient(url, serviceKey, { auth: { persistSession: false } })`; throw early on missing `DASHSCOPE_API_KEY` / Supabase env.

---

## No Analog Found

None. Every new or modified file has an exact in-file analog (the two `lib/reading/` modules + the test) or a role-match sibling script. The phase introduces no novel role or data flow.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| — | — | — | All files covered by existing analogs. |

---

## Metadata

**Analog search scope:** `src/lib/reading/`, `src/lib/reading/__tests__/`, `scripts/`, `src/components/board/verdict/` (frozen — read-only reference).
**Files scanned:** `verdict-bands.ts`, `view-model.ts` (L1-100, L120-249), `verdict.test.ts`, `measure-pipeline.ts` (L1-60), `capture-reading-fixture.ts` (L1-40); directory listings of `src/lib/reading/` + `scripts/`.
**Frozen-edit boundary verified:** engine 3.19.0 + board copies confirmed out of edit surface.
**Pattern extraction date:** 2026-06-12
