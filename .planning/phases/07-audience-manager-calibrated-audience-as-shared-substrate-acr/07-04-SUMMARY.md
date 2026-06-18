---
phase: 07-audience-manager-calibrated-audience-as-shared-substrate-acr
plan: "04"
subsystem: audience-wiring-ideas
tags: [audience, steer, react, tdd, flash-repaint, ideas-runner, grounding-line, no-op-general]
dependency_graph:
  requires:
    - src/lib/audience/audience-types.ts
    - src/lib/audience/audience-repo.ts
    - src/lib/audience/resolve-audience-weights.ts
    - src/lib/audience/persona-repaint.ts
    - src/lib/kc/grounding-line.ts
    - src/lib/engine/flash/flash-prompts.ts
    - src/lib/engine/flash/run-flash-text-mode.ts
    - src/lib/tools/runners/ideas-runner.ts
    - src/app/api/tools/ideas/route.ts
  provides:
    - src/lib/audience/audience-grounding.ts
    - src/lib/audience/__tests__/audience-grounding.test.ts
  affects: [07-05, 07-06]
tech_stack:
  added: []
  patterns: [TDD-London-School, Flash-repaint-fold, no-op-General, delegate-pattern, blast-radius-gate]
key_files:
  created:
    - src/lib/audience/audience-grounding.ts
    - src/lib/audience/__tests__/audience-grounding.test.ts
  modified:
    - src/lib/engine/flash/flash-prompts.ts
    - src/lib/engine/flash/run-flash-text-mode.ts
    - src/lib/tools/runners/ideas-runner.ts
    - src/app/api/tools/ideas/route.ts
decisions:
  - "buildAudienceGroundingLine delegates to buildGroundingLine for General/null — zero behavior change; pure delegate pattern preserves all existing grounding logic"
  - "audienceRepaint: Record<string, string> | undefined — undefined = byte-identical no-op; calibrated = stored-text substitution (Pitfall 2: never per-request generation)"
  - "IdeasPipelineInput.audience optional field — blast-radius gate (AUD-08): only ideas-runner uses audience-grounding in P7; other runners unchanged"
  - "ideas/route: active_audience_id cast via rawThread pattern until database.types.ts regenerated in 07-05 (same (supabase as any) interim approach as audience-repo)"
  - "resolvedWeights wired in runner (void guard) ready for future Max-path integration; Flash uses the repaint only in P7"
metrics:
  duration: "~5m"
  completed: "2026-06-18"
  tasks_completed: 2
  files_count: 6
---

# Phase 7 Plan 04: Audience Wiring — Ideas Steer + React Summary

Audience wired into ideas-runner at both engine positions: steer (① grounding line) and react (② Flash persona repaint). General is a proven byte-identical no-op throughout. GROUND-03 is now literally true for ideas when a calibrated audience is active.

## What Was Built

### `src/lib/audience/audience-grounding.ts`

Exports: `buildAudienceGroundingLine(audience, platform, profileRow)`

**Delegate pattern (AUD-08 blast-radius gate):**
- `audience === null` or `audience.is_general` → delegates to `buildGroundingLine(profileRow, platform)` — zero behavior change for General
- Calibrated audience → `buildAudienceLine(audience, platform)` — audience-facing "Because: your {platform} audience — {temperature label} · {dispositions}" line
- Temperature label derived from stored `AudienceProfile.temperature_mix` (dominant bucket ≥ 40%); dispositions from `top_dispositions` (up to 3)
- Honesty spine: no fabricated follower counts; only stored profile data used

**Contracts delivered:**
- `buildAudienceGroundingLine(null, 'tiktok', null)` → delegates → `coldStart: true`
- `buildAudienceGroundingLine(GENERAL_AUDIENCE, 'tiktok', null)` → delegates → `coldStart: true`
- `buildAudienceGroundingLine(calibrated, 'tiktok', null)` → `{ line: "Because: ...", coldStart: false }`
- Same audience → same output (pure function, deterministic)

### `src/lib/engine/flash/flash-prompts.ts` — `buildNicheAwareSystemPrompt` extended

**Signature change (additive, non-breaking):**
```typescript
export function buildNicheAwareSystemPrompt(
  panel: NichePanel,
  audienceRepaint?: Record<string, string>,
): string
```

**No-op guarantee (regression-critical):**
- `audienceRepaint` absent or `undefined` → existing code path runs unchanged → byte-identical output
- Verified by test: `buildNicheAwareSystemPrompt(panel)` === `buildNicheAwareSystemPrompt(panel, undefined)`

**Repaint fold (when present):**
- For each slot: if `audienceRepaint[s.archetype]` is defined, substitutes stored audience description in place of `s.niche_instantiation`
- Skeleton (task framing, Output Schema, TYPE RULES, Critical Divergence Requirement) stays byte-stable
- ARCHETYPE_DEFINITIONS never mutated (grep guard: `ARCHETYPE_DEFINITIONS\s*=` returns no matches)

### `src/lib/engine/flash/run-flash-text-mode.ts` — `runFlashTextMode` extended

**Signature change (additive, non-breaking):**
```typescript
export async function runFlashTextMode(
  content_text: string,
  framing: FlashFraming,
  panel?: NichePanel,
  audienceRepaint?: Record<string, string>,
): Promise<FlashRunResult>
```

**Wiring:** `audienceRepaint` threaded through to `buildNicheAwareSystemPrompt(panel, audienceRepaint)`. No-audience path: `audienceRepaint` is `undefined` → byte-identical (General regression gate preserved).

### `src/lib/tools/runners/ideas-runner.ts` — steer + react wired

**IdeasPipelineInput extended:**
```typescript
audience?: Audience | null;  // AUD-08: blast radius confined to ideas-runner in P7
```

**STEER (AUD-05):**
- `buildGroundingLine(profileRow, platform)` replaced by `buildAudienceGroundingLine(audience, platform, profileRow)`
- Delegates to old behavior for General/null → no regression

**REACT (AUD-04):**
- `resolveAudienceWeights(audience ? [audience] : [])` — weights resolved (ready for Max-path integration)
- `audienceRepaint` extracted from `audience.personas` as `Record<string, string>` — `undefined` for General/no-audience
- `runFlashTextMode(idea.seedHook, "idea", panel, audienceRepaint)` — repaint fold flows to Flash

**Isolation comment updated** with new imports and AUD-08 blast-radius documentation.

### `src/app/api/tools/ideas/route.ts` — loads active audience

**New step (5a) after open thread creation:**
- Reads `thread.active_audience_id` (via cast until 07-05 regenerates types)
- `NULL` → `activeAudience = GENERAL_AUDIENCE` (no DB query)
- Non-null → `getAudience(supabase, activeAudienceId)` (virtual constant short-circuits for sentinel ids)
- Load failure is non-fatal → falls back to General (regression safe, never blocks)
- `audience: activeAudience` passed to `runIdeasPipeline`

## Test Coverage

| File | Tests | Result |
|------|-------|--------|
| audience-grounding.test.ts | 11 | PASS |
| flash suite (existing, regression guard) | 63 | PASS |
| Flash byte-stability equality test | in above | PASS |
| ideas-runner + tools suite (existing) | 211+ | PASS |
| **Total (this plan)** | **285** | **All green** |

## Key Contracts for 07-05

**IdeasPipelineInput.audience:**
```typescript
audience?: Audience | null  // optional — default null = General behavior
```

**buildNicheAwareSystemPrompt signature:**
```typescript
buildNicheAwareSystemPrompt(panel: NichePanel, audienceRepaint?: Record<string, string>): string
```

**runFlashTextMode signature:**
```typescript
runFlashTextMode(content_text, framing, panel?, audienceRepaint?): Promise<FlashRunResult>
```

**General is a proven byte-identical no-op:**
- Test asserts `buildNicheAwareSystemPrompt(panel)` === `buildNicheAwareSystemPrompt(panel, undefined)`
- `resolveAudienceWeights([])` → DEFAULT mix (AUD-03 gate — free by construction)
- 07-05's engine regression gate can assert this in its blocking verification

**Note for post-P7 refinement run:** steer-everywhere extends this same pattern to the other 5 runners + chat-runner (D-01 deferred scope). The blast radius is documented in ideas-runner's isolation comment for future work.

## Deviations from Plan

None — plan executed exactly as written.

Pre-existing TypeScript errors in unrelated test files (44+ errors in flash-schema.test.ts, fold-adapter.test.ts, ideas-runner.test.ts, etc.) are out of scope (same cohort as noted in 07-03 SUMMARY).

## Commits

| Hash | Message |
|------|---------|
| 0955a12b | test(07-04): add failing tests for audience-grounding + Flash repaint fold (RED) |
| 482419a6 | feat(07-04): audience-grounding + Flash audience-repaint fold (GREEN) |
| eacdb9e4 | feat(07-04): ideas-runner steer+react wiring + ideas route loads active audience |

## Threat Flags

None — all mitigations inherited from T-07-01 through T-07-05 remain in place. This plan adds no new network endpoints or auth paths. The audience load in the ideas route is read-only (getAudience), uses the RLS-scoped supabase client, and falls back gracefully to General on error.

## Known Stubs

None — all wiring fully implemented. The `rawThread.active_audience_id` cast is a known interim (pending `database.types.ts` regeneration in 07-05), not a stub.

## Self-Check: PASSED
