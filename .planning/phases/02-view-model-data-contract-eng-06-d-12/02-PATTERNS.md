# Phase 2: View-Model + Data Contract (ENG-06 D-12) - Pattern Map

**Mapped:** 2026-06-12
**Files analyzed:** 8 new (5 modules + 3 test files + fixtures) + 1 modified (`[id]/route.ts`)
**Analogs found:** 8 / 8 (every new file has a strong in-repo analog — this is a consolidation phase, not greenfield)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/reading/block-types.ts` (new) | model (type contract) | transform | `src/lib/engine/types.ts` (`CounterfactualResult` discriminated union ~L589; `HeroBlock` L285) | role-match (type-defs file) |
| `src/lib/reading/verdict-bands.ts` (new) | config (constant) | transform | `src/components/board/verdict/verdict-constants.ts` (`BAND_THRESHOLDS` L4, `bandFromScore` L61) | exact |
| `src/lib/reading/from-persisted-row.ts` (new) | utility (normalizer) | transform | `src/app/api/analysis/[id]/route.ts` (the inline reload shims L56-194) | exact (this IS the source being consolidated) |
| `src/lib/reading/view-model.ts` (new) | utility (pure selector) | transform | `src/components/board/verdict/verdict-derive.ts` (whole file — pure `PredictionResult` → view shapes) | exact |
| `src/lib/reading/__tests__/view-model.test.ts` (new) | test | transform | `src/components/board/verdict/__tests__/verdict-derive.test.ts` | exact |
| `src/lib/reading/__tests__/verdict.test.ts` (new) | test | transform | `src/components/board/verdict/__tests__/verdict-derive.test.ts` | exact |
| `src/lib/reading/__tests__/identical-render.test.ts` (new) | test (contract/deep-equal) | transform | (no exact analog — pattern in RESEARCH §"DATA-02 identical-render contract test") | role-match |
| `src/lib/reading/__tests__/fixtures/{live,persisted}-<id>.json` (new) | test fixture (REAL) | — | `scripts/validations/video-NN.json` (live) + `/api/analysis/[id]` JSON (persisted) | role-match — NO existing analog is acceptable (all current fixtures are hand-authored mocks) |
| `src/app/api/analysis/[id]/route.ts` (MODIFIED) | route | request-response | self (becomes thin caller of `fromPersistedRow`) | exact |

---

## Pattern Assignments

### `src/lib/reading/verdict-bands.ts` (config, transform)

**Analog:** `src/components/board/verdict/verdict-constants.ts`

**Constant pattern to consolidate** (`verdict-constants.ts` L4-8 + L61-65) — two band definitions exist today (this one + `verdict-derive.ts` L25-29 `bandLabel`, same numbers, different labels). D-04: extract ONE.

```typescript
// verdict-constants.ts L4-8 (numbers) + L61-65 (lookup):
export const BAND_THRESHOLDS = {
  STRONG: 70, // >=70 -> 'Strong' + coral percentile
  MID: 40,    // 40-69 -> 'Mid'
  // < 40 -> 'Low'
} as const;

export function bandFromScore(score: number): 'Strong' | 'Mid' | 'Low' {
  if (score >= BAND_THRESHOLDS.STRONG) return 'Strong';
  if (score >= BAND_THRESHOLDS.MID) return 'Mid';
  return 'Low';
}
```

**And the labels from** `verdict-derive.ts` L25-29:
```typescript
export function bandLabel(score: number): string {
  if (score >= 70) return 'High potential';
  if (score >= 40) return 'Solid contender';
  return 'Needs work';
}
```

**New shape (from RESEARCH §Code Examples — use the Reading labels, not the board's `Strong/Mid/Low`):**
```typescript
export interface VerdictBand { id: 'high' | 'solid' | 'needs-work'; label: string; min: number; }
export const VERDICT_BANDS: readonly VerdictBand[] = [
  { id: 'high',       label: 'High potential',  min: 70 },
  { id: 'solid',      label: 'Solid contender', min: 40 },
  { id: 'needs-work', label: 'Needs work',      min: 0  },
] as const;
export function bandFor(score: number): VerdictBand {
  return VERDICT_BANDS.find((b) => score >= b.min) ?? VERDICT_BANDS[VERDICT_BANDS.length - 1]!;
}
```
**Note for planner:** Leave the two legacy board copies in place (board-only; freeze is on engine, not these). Add a comment in both legacy files pointing at `VERDICT_BANDS` so Phase 3 calibration edits the new constant, not a board file (Pitfall 4). This is the Phase 3 calibration target.

---

### `src/lib/reading/view-model.ts` (utility, pure selector)

**Analog:** `src/components/board/verdict/verdict-derive.ts` — copy its purity discipline wholesale.

**Header / purity contract** (`verdict-derive.ts` L6-9) — the doctrine to inherit verbatim:
```typescript
// Pure derivations for the redesigned Score frame. No fabricated numbers — every
// value traces to a real engine field; tiles/banner omit what isn't present.
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
```

**"Omit what isn't present, never fabricate" loop** (`verdict-derive.ts` L102-124 `deriveBehavioralTiles`) — the exact pattern for the `audience` block (D-14 individual-null omit):
```typescript
export function deriveBehavioralTiles(result: PredictionResult): StatTileData[] {
  const bp = result.behavioral_predictions;
  if (!bp) return [];                         // whole block absent → []
  const rows = [
    { k: 'Share', intent: bp.share_percentile, abs: bp.share_pct },
    { k: 'Completion', intent: bp.completion_percentile, abs: bp.completion_pct },
    /* … */
  ];
  const tiles: StatTileData[] = [];
  for (const r of rows) {
    if (typeof r.abs !== 'number' || !Number.isFinite(r.abs)) continue;  // per-tile omit
    tiles.push({ k: r.k, v: pctValue(r.abs), u: '%', s: intentChip(r.intent) });
  }
  return tiles;
}
```

**The "why" fallback chain** (D-05) — sourced from `hero.verdict_line` (types.ts L289) preferred, fallback mirrors `deriveVerdictSummary` (`verdict-constants.ts` L81-92):
```typescript
// deriveVerdictSummary precedent — sort factors, take top/bottom, gate on score>=6:
export function deriveVerdictSummary(factors: ReadonlyArray<Factor>): VerdictSummary {
  if (!factors.length) return { driver: null, risk: null };
  const sorted = [...factors].sort((a, b) => b.score - a.score);
  const top = sorted[0]!;
  const driver = top.score >= 6 ? { name: top.name, rationale: top.rationale } : null;
  /* … */
}
```
**Reading `deriveWhy` (RESEARCH §Code Examples) — apply this chain, NEVER a generic string (D-05):**
```typescript
function deriveWhy(c: CanonicalReading): string {
  if (c.hero?.verdict_line) return c.hero.verdict_line;   // engine-authored, grounded
  if (c.hero?.the_one_fix)  return c.hero.the_one_fix;
  const top = [...(c.factors ?? [])].sort((a, b) => b.score - a.score)[0];
  if (top?.rationale) return top.rationale;
  return '';   // band-only verdict when nothing grounds the why
}
```

**Confidence-in-language map** (D-06) — derive from `confidence_label` HIGH/MED/LOW; do NOT emit a `/100`. Precedent for honest uncertainty = `confidenceRange` (`verdict-derive.ts` L19-23) but D-06 wants words, not a band.

**Gated-state fold** (D-07 "Mixed signals") — precedent `deriveGatedHero` (`verdict-derive.ts` L136-144): fires off `anti_virality_gated`, folds first fix headline. The `/100` is demoted to in-body evidence only.

**CRITICAL — `toReadingBlocks` consumes `CanonicalReading`, NOT raw `PredictionResult`** (D-09, RESEARCH Anti-Pattern 1). The board analogs all read `PredictionResult` directly; the view-model must read the narrow canonical shape so live-only fields physically cannot enter.

---

### `src/lib/reading/block-types.ts` (model, type contract)

**Analog:** `src/lib/engine/types.ts` — discriminated-union convention + the `HeroBlock` per-field-nullable doctrine.

**`HeroBlock` shape** (types.ts L285-300) — the source for the verdict + expert-insight blocks; note "each field individually nullable + non-throwing":
```typescript
export interface HeroBlock {
  verdict_line: string;           // never null (overall_score always present)
  ceiling: string | null;         // null when Apollo unavailable
  the_one_fix: string | null;     // null when Apollo unavailable / no rewrites
  go_no_go: "go" | "no-go";
  post_window: OptimalPostWindow | null;
}
```

**Discriminated `ReadingBlock` union** (D-13, RESEARCH Pattern 1 — pure data, NO presentation hints):
```typescript
export type ReadingBlock =
  | { kind: 'verdict'; band: VerdictBand; why: string; confidenceLanguage: string; score: number }
  | { kind: 'expert-insight'; ceiling: string | null; theOneFix: string | null; rewrites: ApolloRewrite[] }
  | { kind: 'hook'; /* … */ }
  | { kind: 'retention'; segments: RetentionSegment[]; weightedCurve: number[] }
  | { kind: 'retention-degraded'; reason: 'heatmap_unavailable' }
  | { kind: 'audience'; share: number; completion: number; comment: number; save: number; intents: string[] }
  | { kind: 'fixes'; items: Fix[] }
  | { kind: 'drivers'; factors: Factor[] }
  | { kind: 'persona-read'; aggregate: PersonaBehavioralAggregate }
  | { kind: 'content-summary'; text: string }
  | { kind: 'audio'; soundName: string; trendPhase: string | null }  // SEE D-09 RULING BELOW
  | { kind: 'analysis-degraded'; tier: 'unavailable' | 'partial'; have: string[] };
```
**`CanonicalReading` (RESEARCH Pattern 2 — the intersection enforcer):** the narrow shape with ONLY live∩persisted fields. Both `fromPersistedRow` and `canonicalFromLive` produce it. `predicted_engagement` MUST NOT appear on it (D-09 — it's persisted under a different key `variants.engagement_range`; exclude by decision).

---

### `src/lib/reading/from-persisted-row.ts` (utility, normalizer)

**Analog:** `src/app/api/analysis/[id]/route.ts` L56-194 — the shims to ABSORB and replace (D-11). Copy the deterministic parts, DROP the non-deterministic ones.

**KEEP — numeric coercion** (L56-61, Pitfall 5 — rows store `confidence`/`overall_score` as strings):
```typescript
const confidence = typeof data.confidence === "string"
  ? Number.parseFloat(data.confidence) : data.confidence;
const overall = typeof data.overall_score === "string"
  ? Number.parseFloat(data.overall_score) : data.overall_score;
```

**KEEP — deterministic degradation derive** (L141-144, safe per RESEARCH):
```typescript
const sa = extras.signal_availability ?? null;
const analysis_unavailable =
  extras.analysis_unavailable ?? (sa ? !sa.gemini && !sa.behavioral : false);
// ADD partial_analysis (NOT in route today): sa ? sa.gemini !== sa.behavioral : false
```

**KEEP — defensive `variants.*` reads** (Pitfall 2 / RESEARCH Runtime Inventory). Persisted half reads `row.variants.hero` / `row.variants.apollo` / `row.variants.craft`; any can be absent if its async writer raced/failed → degrade the block, never throw.

**DROP — `synthHeatmap()` (L76-124)** — NON-DETERMINISTIC (`Math.random()` persona ids L102, synthetic curves). Pitfall 3 / D-14: read the persisted `heatmap` column ONLY (L145 `extras.heatmap`); if null → emit `retention-degraded`. NEVER synth.
```typescript
// route.ts L145 — KEEP the column read, DROP the `?? synthHeatmap()`:
const heatmap = extras.heatmap ?? synthHeatmap();   // ← strip the synth fallback
```

**DROP — `optimal_post_window` recompute (L153-172)** — TIME + DB-dependent (`computeOptimalPostWindow` at load). Not in D-01's ~10 blocks → drop from contract entirely. Do NOT replicate the `creator_profiles` lookup in the normalizer.

**DROP — threshold-fallback re-derives that drift** (L178-190 `confidence_label` `>=0.7/0.4`, `anti_virality_gated` `<0.4`): prefer the persisted column; only derive when genuinely null on old rows, using the engine's own thresholds.

---

### Test files (`__tests__/*.test.ts`)

**Analog:** `src/components/board/verdict/__tests__/verdict-derive.test.ts`

**Imports + factory pattern** (L1-30) — `vitest` globals, a `(over = {}) => ({...}) as PredictionResult` minimal-fixture helper, table-style `expect`:
```typescript
import { describe, it, expect } from 'vitest';
import type { PredictionResult } from '@/lib/engine/types';
import { bandLabel, /* … */ } from '../verdict-derive';

const result = (over: Partial<PredictionResult> = {}): PredictionResult =>
  ({ overall_score: 77, confidence: 0.6, has_video: true, factors: [], ...over }) as unknown as PredictionResult;

describe('bandLabel', () => {
  it('maps score to honest verdict band', () => {
    expect(bandLabel(70)).toBe('High potential');
    expect(bandLabel(39)).toBe('Needs work');
  });
});
```
**Use this `(over) => ({...})` minimal-override factory for `view-model.test.ts` and `verdict.test.ts`** (DATA-01/03/04, D-14 degradation cases). Node env default (vitest.config `environment: "node"`) — pure module, no `happy-dom` pragma needed.

**`identical-render.test.ts` (DATA-02 — the crux, no board analog)** — RESEARCH §Validation:
```typescript
import live from './fixtures/live-<id>.json';
import persisted from './fixtures/persisted-<id>.json';
import { toReadingBlocks, canonicalFromLive } from '../view-model';
import { fromPersistedRow } from '../from-persisted-row';

it('live Reading deep-equals re-opened resting document', () => {
  const liveBlocks   = toReadingBlocks(canonicalFromLive(live as PredictionResult));
  const replayBlocks = toReadingBlocks(fromPersistedRow(persisted));
  expect(replayBlocks).toEqual(liveBlocks);   // deep structural equality
});
```

**Fixtures — REAL, not mocks (D-12, hard).** ALL existing fixtures (`src/test/fixtures/completed-prediction.ts`, `verdict/__tests__/fixtures/prediction-result.ts`) are hand-authored mocks with stale shapes (null `apollo_reasoning`/`hero`/`heatmap`, deprecated `predicted_engagement` point shape) — **NOT acceptable.** Capture: live half from `scripts/smoke-tiktok-pipeline.ts` (writes `scripts/validations/video-NN.json`); persisted half by reading the SAME row back through `/api/analysis/[id]`. Snapshot the persisted row AFTER the post-`complete` `variants` writes settle (Pitfall 2 — assert `variants.apollo != null` before snapshotting, else flaky-by-timing).

---

### `src/app/api/analysis/[id]/route.ts` (MODIFIED — route)

**Becomes a thin caller of `fromPersistedRow`.** Keep the `select("*")` + `.eq("user_id", user.id)` + `.is("deleted_at", null)` ownership filter (L26-32) and the `?summary` branch (L45-51) INTACT (Security V4 — `fromPersistedRow` receives an already-scoped row, does no DB I/O). Replace the inline shim block (L56-194) with `return Response.json(fromPersistedRow(data))` (or a canonical-shape adapter). The `optimal_post_window` recompute + `creator_profiles` lookup are dropped, not moved.

---

## Shared Patterns

### Honest derivation — "every value traces to a real field; omit what isn't present"
**Source:** `src/components/board/verdict/verdict-derive.ts` L6-8 (header) + L102-124 (the omit loop)
**Apply to:** `view-model.ts` (every block builder), `from-persisted-row.ts` (defensive `variants.*` reads)
This is the codebase-wide doctrine that grounds D-14. Two-tier: individual null → omit block silently; whole-analysis (`analysis_unavailable`/`partial_analysis`) → first-class `analysis-degraded` honest block.

### Defensive numeric coercion
**Source:** `src/app/api/analysis/[id]/route.ts` L56-61
**Apply to:** `from-persisted-row.ts` — `confidence`/`overall_score` may be stored as strings (Pitfall 5).

### Defensive `variants.*` JSONB reads (racing writers)
**Source:** `src/app/api/analyze/route.ts` `persistApolloToVariants` (L220) / `persistCraftToVariants` (L156) — read-merge-write, fire AFTER `send("complete")` (L1101)
**Apply to:** `from-persisted-row.ts` — `variants.hero`, `variants.apollo`, `variants.craft` each optional-chain; degrade the dependent block when absent.

### Pure discriminated-union contract
**Source:** `src/lib/engine/types.ts` (`CounterfactualResult` union, `HeroBlock` per-field-nullable)
**Apply to:** `block-types.ts` — `ReadingBlock` union; Phase 4 consumers `switch(block.kind)` with a `never` default for exhaustiveness.

---

## Resolved Open Questions (researcher flagged 2; both confirmed this session)

| Q | Resolution | Evidence |
|---|------------|----------|
| **Q1: Does `audio_fingerprint` survive to the persisted row?** | **NO — live-only.** Ruling: the `audio` block (D-01 #10) MUST be **DROPPED** (D-09), not merely conditional-render. It cannot be a both-path block. | `grep audio_fingerprint src/app/api/` → **zero matches** (not in `buildInsertRow` L656-747, not in `persistCraftToVariants`, not in `[id]/route`). |
| **Q2: Are `hero`/`apollo_reasoning` on the LIVE `complete` payload (vs only post-complete `variants` write)?** | **YES — top-level on `finalResult`.** Live canonical reads `result.hero`/`result.apollo_reasoning`; persisted reads `variants.hero`/`variants.apollo`; both resolve to the same object → deep-equal holds. | `analyze/route.ts` L227 `const apollo = finalResult.apollo_reasoning`, L234 `const hero = finalResult.hero`, then `send("complete", finalResult)` L1101. The post-complete writer (L253) only COPIES `finalResult.hero` into `variants` — same object. |

**Planner action:** Remove the `audio` member from the `ReadingBlock` union (or keep the kind but never emit it — drop is cleaner). Update D-01 #10 ruling to "DROPPED — live-only, breaks intersection."

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `__tests__/identical-render.test.ts` | test (contract) | transform | No existing deep-equal-across-two-real-paths test in the repo. Pattern given in RESEARCH §Validation; build from that. |
| `__tests__/fixtures/{live,persisted}-<id>.json` | fixture (REAL) | — | All existing fixtures are hand-authored mocks (explicitly NOT acceptable for D-12). Must capture a real pair — the single execution prerequisite of the phase. |

## Metadata

**Analog search scope:** `src/components/board/verdict/`, `src/lib/engine/`, `src/app/api/analyze/`, `src/app/api/analysis/[id]/`, `src/lib/reading/` (new — empty), `src/test/fixtures/`, `vitest.config.ts`
**Files scanned:** 9 read in full/part (`verdict-derive.ts`, `verdict-constants.ts`, `[id]/route.ts`, `analyze/route.ts` buildInsertRow+variants, `types.ts` HeroBlock/PredictionResult, `verdict-derive.test.ts`, verdict fixture, vitest.config, dir listings)
**Pattern extraction date:** 2026-06-12

## PATTERN MAPPING COMPLETE
