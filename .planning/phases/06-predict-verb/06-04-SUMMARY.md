---
phase: 06-predict-verb
plan: 04
subsystem: thread/blocks
tags: [predict, block-schema, honesty-guard, renderer, feathered-span, strict, no-needle]
requires:
  - "profile-blocks.ts (.strict() provenance analog — ReactionDistributionBlockSchema)"
  - "reaction-distribution-block.tsx (matte shell + collapsible drill + SaveAffordance footer analog)"
  - "TrustBadge, SaveAffordance (client-safe primitives)"
provides:
  - "PredictionGaugeBlockSchema (.strict()) + PredictionGaugeBlock type in profile-blocks.ts (re-exported from blocks.ts)"
  - "prediction-gauge registered in BlockUnionSchema + BLOCK_REGISTRY + BLOCK_COMPONENTS"
  - "PredictionGaugeBlockRenderer — the ONE honest gauge (feathered span, no needle, readable without color)"
affects:
  - 06-05 (predict-runner emits this block), 06-06 (route persists it), 06-07 (chain-handoff seeds it)
tech-stack:
  added: []
  patterns:
    - "Bands-only .strict() block schema — panel-derived range is the only numeric; smuggled point-score rejected (D-01/PRED-03)"
    - "Feathered-span honesty visual — gradient fades to transparent both ends, NO needle/pointer/tick/dot (F-02)"
    - "Readable-without-color: band WORD + ~min–max% caption + confidence WORD carry 100% of meaning (F-03)"
    - "TYPE-ONLY block import in a 'use client' renderer (bundle-leak-safe, Pitfall 4)"
key-files:
  created:
    - src/components/thread/prediction-gauge-block.tsx
  modified:
    - src/lib/tools/profile-blocks.ts
    - src/lib/tools/blocks.ts
    - src/lib/tools/block-registry.ts
    - src/components/thread/message-blocks.tsx
    - src/components/thread/__tests__/prediction-gauge-block.test.tsx
decisions:
  - "Schema lives in profile-blocks.ts (blocks.ts stays 490 ≤500-line limit); blocks.ts re-exports + adds to BlockUnionSchema"
  - "Confidence is colored (success/warning/error semantic trio); band word stays cream — a likelihood has no good/bad valence (F-03); zero accent"
  - "min===max renders a ~10% min-width feather centered on the value (a unanimous panel is still a band, not a tick — F-01)"
  - "Panel-drill toggle uses the reaction-distribution-block text-arrow idiom (↓ Show / ↑ Hide) verbatim rather than phosphor carets — avoids an unused import, matches the proven analog"
metrics:
  duration: ~12min
  tasks: 2
  files: 6
  completed: "2026-06-29"
---

# Phase 6 Plan 04: prediction-gauge Block + Honest Gauge Renderer Summary

The ONE new `prediction-gauge` block type lands end-to-end: a `.strict()` bands-only schema (PRED-03 honesty contract), its registration across all three wiring files, and the honest gauge renderer (PRED-02) — a feathered span with no needle, readable without color, bundle-leak-safe, matte. Schema + registration + renderer + message-blocks wiring landed together so tsc stays green (`BLOCK_COMPONENTS` is `Record<BlockType, …>` — a union member without its renderer breaks the build). The Wave-0 `prediction-gauge-block.test.tsx` is GREEN; the matte guard stays green.

## What was built

**Task 1 — `PredictionGaugeBlockSchema` (.strict()) + 3-file registration:**
- Added `PredictionGaugeBlockSchema` to `profile-blocks.ts` (NOT blocks.ts — the 500-line overflow home), mirroring `ReactionDistributionBlockSchema`'s `.strict()` provenance pattern. Fields per RESEARCH/UI-SPEC: `type: z.literal("prediction-gauge")`; `props.strict()` with `audienceName`, `scenario`, `band` (5-word enum), `range: { min/max int 0-100 }` (the ONLY numeric — `min===max` allowed; the renderer feathers it), `confidence` (High/Medium/Low), `factors[].min(1)` (each names its `analystArchetype` + `driver` + `direction` — D-04/F-05), `panel[].min(1)` (the drill: `archetype` + ordinal `lean` + `reasoning`), `assumptions` (default `[]`), `successCriterion` (nullable), `caveat` (min 1 — always-on), `model: z.literal("sim1-flash")`, `tier: z.literal("Directional")`. `.strict()` on `props` rejects a smuggled `score`/0-100/extra field (PRED-03 / D-01 / T-06-08). Exported `type PredictionGaugeBlock`.
- Registered: `blocks.ts` re-exports schema + type and adds it to `BlockUnionSchema` (file stays at **490 lines** ≤500); `block-registry.ts` imports it and adds `"prediction-gauge": { schema: … as z.ZodType }` to `BLOCK_REGISTRY`. `validateBlock` untouched.

**Task 2 — `PredictionGaugeBlockRenderer` (feathered span, no needle) + message-blocks wiring:**
- Created `src/components/thread/prediction-gauge-block.tsx` (`'use client'`), TYPE-ONLY block import (never runner/route/engine — Pitfall 4). Section order per UI-SPEC Surface 1: (1) provenance header (`SIM-1 Flash` + `<TrustBadge tier="Directional" />`); (2) `On: {scenario}` lead (clamped); (3) THE GAUGE — band WORD as `text-2xl font-semibold text-foreground` (CREAM, never band-colored), `~{min}–{max}%` caption (tilde, en-dash, no decimal, `tabular-nums`), `Confidence: {word}` pill (confidence semantic token), and an `h-2 rounded-full bg-white/[0.06]` rail with 4 zone labels + faint separators + the feathered span positioned `left:{min}% right:{100-max}%` filled with the confidence token via a both-ends-fading gradient at 0.28 opacity — NO needle/pointer/tick/dot; `min===max` → min-width feather centered on the value; (4) attributed factors (`What's driving this`, every row names its analyst chip + `for`/`against` tag); (5) collapsible panel drill (`aria-expanded`, default collapsed, `The panel — {N} analysts`, per-analyst qualitative lean WORD + reasoning blockquote); (6) neutral assumptions panel + `Judged against: {successCriterion}`; (7) always-on quiet caveat (F-04); (8) `SaveAffordance` footer. `aria-label` summarizes the whole forecast. Confidence color map High→success / Medium→warning / Low→error (NOT accent). Re-exports `PredictionGaugeBlockSchema` so the test imports both from one module.
- Wired `message-blocks.tsx`: imported the renderer and added `"prediction-gauge": PredictionGaugeBlockRenderer` to `BLOCK_COMPONENTS` (TS completeness against `BlockType`).

## Verification

- `node ./node_modules/vitest/vitest.mjs run src/components/thread/__tests__/prediction-gauge-block.test.tsx src/components/reading/__tests__/reskin-matte.test.ts` → **2 files passed, 11 tests passed** (gauge GREEN + matte guard green).
- Bundle-leak guard: `grep -c "from '@/lib/tools/runners\|from '@/lib/engine\|/api/tools/predict/route" prediction-gauge-block.tsx` → **0**.
- No-needle guard: `grep -ci "needle\|<input type=\"range\"\|rotate(" prediction-gauge-block.tsx` → **0**.
- `grep -c "prediction-gauge" message-blocks.tsx` → **2** (≥1).
- `wc -l blocks.ts` → **490** (≤500).
- `npx tsc --noEmit` → **no errors on any touched path** (profile-blocks.ts, blocks.ts, block-registry.ts, prediction-gauge-block.tsx, message-blocks.tsx). The not-yet-implemented downstream RED tests (predict-runner, predict/route) still report module-not-found — expected this wave (06-05/06-06).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Wave-0 test rendered a SaveAffordance card with no QueryClientProvider**
- **Found during:** Task 2
- **Issue:** `prediction-gauge-block.test.tsx` (authored in 06-01) calls `render(<PredictionGaugeBlockRenderer/>)` directly. The renderer mounts `SaveAffordance` → `useSaveItem` → `useQueryClient`, which throws `No QueryClient set` without a provider. The renderer cannot omit the SaveAffordance footer (required by UI-SPEC Surface 1 §8).
- **Fix:** Added a `renderWithClient`-style local `render` wrapper (`QueryClientProvider` with a no-retry test client), mirroring the established `idea-card-block.test.tsx` precedent exactly. All locked assertions (schema `.strict()`, band WORD, `~min–max%` caption, `min===max` span) are unchanged.
- **Files modified:** src/components/thread/__tests__/prediction-gauge-block.test.tsx
- **Commit:** bfd86646

**2. [Rule 1 - Bug] Test fixture dropped its `over` override → min===max case never exercised**
- **Found during:** Task 2
- **Issue:** `makeProps(over)` accepted an `over: Partial<GaugeProps>` argument but never spread it, so `makeBlock({ range: { min: 60, max: 60 } })` still rendered the default `35–90`. The F-01 single-point test asserted `/60%/` against a card that showed `~35–90%` → false-negative.
- **Fix:** Spread `...over` into the returned props object so overrides actually apply. The band-word and range-caption tests use the defaults (unaffected); the F-01 case now genuinely renders `~60%` with a feathered span.
- **Files modified:** src/components/thread/__tests__/prediction-gauge-block.test.tsx
- **Commit:** bfd86646

**3. [Minor - Idiom] Panel-drill toggle uses text arrows, not phosphor carets**
- The plan's action listed `CaretDown`/`CaretUp` imports, but then said "reuse the reaction-distribution-block toggle idiom verbatim" — which uses text arrows (`↓ Show` / `↑ Hide`). Used the text-arrow idiom to match the proven analog and avoid an unused import (lint). No behavior or contract impact.

## Self-Check: PASSED

- FOUND: src/lib/tools/profile-blocks.ts (PredictionGaugeBlockSchema)
- FOUND: src/components/thread/prediction-gauge-block.tsx (PredictionGaugeBlockRenderer)
- FOUND commit 5f2e005e (feat — Task 1: schema + 3-file registration)
- FOUND commit bfd86646 (feat — Task 2: renderer + message-blocks wiring + test scaffold fixes)
