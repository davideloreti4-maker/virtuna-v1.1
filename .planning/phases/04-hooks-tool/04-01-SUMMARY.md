---
phase: 04-hooks-tool
plan: 01
subsystem: blocks-hooks
tags: [hook-card, block-registry, audience-archetype, tdd, vitest, d-03, d-04, d-11, d-14]

# Dependency graph
requires:
  - phase: 03-ideas-tool
    provides: "idea-card block pattern (D-10), D-14 double-validation, IdeaCardRenderer shape, BLOCK_COMPONENTS map"
  - phase: 01-engine-thread-foundation
    provides: "typed-block registry, validateBlock, assertBlocksInRegistry, flash-runner persona output shape"
provides:
  - "HookCardBlockSchema + HookCardBlock type: validated hook-card block in the registry (D-11)"
  - "HookCardRenderer: hook-line-forward face + audienceArchetype tag + lead quote + rank badge + expand (mechanism/seedHook/channel) + secondary band chip + 'Test full →' CTA with onTest seam (D-05/D-08/D-11)"
  - "deriveAudienceArchetype(personas): pure function → 'Stops the <persona>' audience tag from Flash stops (D-03/D-04)"
affects: [04-hooks-tool plans 02-03, Plan 02 must use HookCardBlock exact prop names, Plan 03 wires the onTest CTA]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-11 hook-card block pattern: 3 registry edits (blocks.ts schema + block-registry.ts entry + message-blocks.tsx component map) — identical to idea-card D-10 pattern"
    - "D-03 audience-archetype: pure function reads Flash per-persona stops → human-facing 'Stops the <persona>' tag; tie-break = toughest-crowd-first"
    - "D-04 craft-private guard: deriveAudienceArchetype + HookCardBlockSchema contain zero craft slugs; test asserts this"

key-files:
  created:
    - src/lib/tools/hooks/audience-archetype.ts
    - src/lib/tools/hooks/__tests__/audience-archetype.test.ts
    - src/lib/tools/__tests__/hook-card-block.test.ts
    - src/components/thread/hook-card-block.tsx
  modified:
    - src/lib/tools/blocks.ts
    - src/lib/tools/block-registry.ts
    - src/components/thread/message-blocks.tsx

key-decisions:
  - "HookCardBlock prop names: hookLine, audienceArchetype, mechanism, seedHook, rank (int positive), band, fraction, scrollQuote, model (literal 'sim1-flash'), channel (string | null)"
  - "deriveAudienceArchetype signature: (personas: Array<{ archetype: string; verdict: 'stop' | 'scroll'; quote: string }>) => string"
  - "'Test full →' CTA seam: HookCardRenderer accepts onTest?: () => void prop — Plan 03 passes the deep-link handler here"
  - "Tie-break priority: tough_crowd > niche_deep_scout > niche_deep_buyer > purposeful_viewer > saver > cross_niche_curiosity > sharer > lurker > high_engager > loyalist"
  - "All-scroll fallback: 'No clear audience lock' — never a fabricated capture claim (honesty spine)"

# Metrics
duration: ~4min
completed: 2026-06-18
---

# Phase 04 Plan 01: Hooks Tool — Block + Audience-Archetype Tag Summary

**hook-card typed block in fixed registry (D-11) + deriveAudienceArchetype pure extractor (D-03/D-04) — the two new primitives the flagship ranked-hooks demo renders.**

## Performance

- **Duration:** ~4 min
- **Completed:** 2026-06-18
- **Tasks:** 2 of 2 (both TDD RED/GREEN)
- **Files created:** 4
- **Files modified:** 3

## Plan-02 + Plan-03 Handoff (MANDATORY — 3 contracts)

### 1. HookCardBlock prop names (Plan 02 must use these EXACT names)

```ts
{
  hookLine: string,              // verbatim/executable hook text
  audienceArchetype: string,     // D-03 tag from deriveAudienceArchetype (audience persona, NOT craft)
  mechanism: string,             // attention mechanism prose — NEVER a craft slug
  seedHook: string,              // the one-line hook the SIM reacted to
  rank: number,                  // integer >= 1 (z.number().int().positive())
  band: "Strong" | "Mixed" | "Weak",
  fraction: string,              // e.g. "7/10 stop"
  scrollQuote: string,           // lead per-persona scroll quote
  model: "sim1-flash",           // must be literal "sim1-flash"
  channel: string | null,        // optional multi-modal hint
}
```

### 2. deriveAudienceArchetype signature (Plan 02 calls this in the pipeline runner)

```ts
import { deriveAudienceArchetype } from "@/lib/tools/hooks/audience-archetype";

// Takes the Flash per-persona array (same shape as personasBlock.props.personas)
const audienceArchetype = deriveAudienceArchetype(personas);
// → "Stops the skeptic" / "Stops your core buyer" / "No clear audience lock"
// → goes into HookCardBlock.props.audienceArchetype
```

### 3. "Test full →" CTA seam (Plan 03 wires the deep-link)

```tsx
// HookCardRenderer accepts an optional onTest prop:
<HookCardRenderer block={hookCardBlock} onTest={() => {
  // Plan 03 wires this to the Reading/Test upload surface deep-link
  // carrying the hookLine as anchored context (D-05)
}} />

// When onTest is undefined (default in message-blocks.tsx):
// - Button is visible, styled with reduced opacity
// - cursor: default (not interactive yet — Plan 03 activates it)
// - aria-label: "Test this hook on the full SIM-1 Max pipeline"
```

## Task Commits

| # | Phase | Commit | Description |
|---|-------|--------|-------------|
| 1 RED | TDD | 4835da48 | test(04-01): failing audience-archetype tests (RED — D-03/D-04) |
| 1 GREEN | TDD | ad5d98b9 | feat(04-01): deriveAudienceArchetype — audience-persona tag from Flash stops |
| 2 RED | TDD | 5635792c | test(04-01): failing hook-card block registry tests (RED — D-11/D-14) |
| 2 GREEN | TDD | 58c313fd | feat(04-01): hook-card block — schema, registry, renderer (D-11/D-14) |

## Files Created/Modified

- `src/lib/tools/blocks.ts` — Added `HookCardBlockSchema` + `HookCardBlock` type; added to `BlockUnionSchema`
- `src/lib/tools/block-registry.ts` — Added `"hook-card"` entry with `HookCardBlockSchema`
- `src/components/thread/message-blocks.tsx` — Added `"hook-card": HookCardRenderer` to inline `BLOCK_COMPONENTS`
- `src/components/thread/hook-card-block.tsx` — NEW: `HookCardRenderer` (hook-line-forward face + expand + band chip + CTA seam)
- `src/lib/tools/hooks/audience-archetype.ts` — NEW: `deriveAudienceArchetype` (pure D-03/D-04 extractor)
- `src/lib/tools/hooks/__tests__/audience-archetype.test.ts` — NEW: 6 tests (RED TDD gate)
- `src/lib/tools/__tests__/hook-card-block.test.ts` — NEW: 9 tests (RED TDD gate)

## Decisions Made

- **HookCardBlock prop shape:** 10 props covering hook anatomy (hookLine/audienceArchetype/mechanism/seedHook/rank) + embedded Flash signal (band/fraction/scrollQuote/model) + channel (nullable). No craft-archetype field (D-04 — craft stays private). `rank` is `z.number().int().positive()` (gate: ≥1). `model` is `z.literal("sim1-flash")`.
- **HookCardRenderer layout:** Face always visible (rank badge + audienceArchetype tag chip + hookLine dominant + lead scrollQuote as blockquote + secondary band chip); expand toggle reveals mechanism/seedHook/channel. "Test full →" CTA with `onTest?` seam — Plan 03 passes the handler.
- **deriveAudienceArchetype tie-break:** When multiple personas stop, prefer the toughest crowd (tough_crowd > niche_deep_scout > niche_deep_buyer > …) since that persona stopping = the strongest pull signal. Unknown archetypes fall back to first stopper in input order.
- **All-scroll fallback:** `"No clear audience lock"` — never a fabricated "Stops the X" claim when no one stopped (honesty spine).
- **D-04 hard boundary:** `deriveAudienceArchetype` and `HookCardBlockSchema` contain zero references to BOLD/GAP/CONTRARIAN/RESEARCH/NARRATIVE/QUESTION. Test TC-04 asserts this across all code paths.

## Deviations from Plan

None — plan executed exactly as written. All artifacts deliver their required contracts.

## Known Stubs

- **"Test full →" CTA (D-05):** The `onTest` prop seam is exposed but not wired. When no `onTest` is passed (current `BLOCK_COMPONENTS` default), the button is visible with reduced opacity but not interactive. **This is intentional** — Plan 03 wires the real deep-link handoff (D-05). The seam is the deliverable for this plan.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. Threat register mitigations applied:
- T-04-01 (model-generated UI): `hook-card` in fixed registry + double `validateBlock` (write + rehydration, D-14); `HookCardRenderer` owns layout, model emits validated props only (D-11/THREAD-04). Invalid → unsupported sentinel.
- T-04-02 (honesty on audience-archetype tag): `deriveAudienceArchetype` returns `"No clear audience lock"` when no persona stops; test asserts no fabricated tag + no craft-slug leak (D-03/D-04).

## Self-Check: PASSED

- `src/lib/tools/hooks/audience-archetype.ts`: FOUND (exports deriveAudienceArchetype)
- `src/lib/tools/hooks/__tests__/audience-archetype.test.ts`: FOUND (6 tests, all PASS)
- `src/lib/tools/__tests__/hook-card-block.test.ts`: FOUND (9 tests, all PASS)
- `src/components/thread/hook-card-block.tsx`: FOUND (exports HookCardRenderer)
- `src/lib/tools/blocks.ts`: FOUND (HookCardBlockSchema exported)
- `src/lib/tools/block-registry.ts`: FOUND ("hook-card" registered)
- `src/components/thread/message-blocks.tsx`: FOUND ("hook-card": HookCardRenderer in BLOCK_COMPONENTS)
- Commit 4835da48 (RED test): FOUND
- Commit ad5d98b9 (GREEN feat): FOUND
- Commit 5635792c (RED test): FOUND
- Commit 58c313fd (GREEN feat): FOUND
- vitest run src/lib/tools: 46 PASS, 0 FAIL
- vitest run src/lib/tools/hooks/__tests__/audience-archetype.test.ts: 6 PASS, 0 FAIL
- npm run build: PASS (Compiled successfully)
