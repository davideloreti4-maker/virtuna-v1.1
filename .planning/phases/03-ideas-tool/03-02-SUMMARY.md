---
phase: 03-ideas-tool
plan: 02
subsystem: blocks-grounding
tags: [idea-card, block-registry, grounding-line, kc-stamp, tdd, vitest]

# Dependency graph
requires:
  - phase: 01-engine-thread-foundation
    provides: "typed-block registry with double-validation (D-14), block-registry.ts/tsx, message-blocks.tsx"
  - phase: 02-knowledge-core-generative-rebuild
    provides: "KC_GEN_VERSION, ProfileRow + PROFILE_ROLE_MAP, assembler isProfileThin semantics"
provides:
  - "IdeaCardBlockSchema + IdeaCardBlock type: validated idea-card block in the registry (D-10)"
  - "IdeaCardRenderer: concept-forward face + tap-to-expand + needs-take badge + secondary band chip (D-08/D-09/D-11/D-04)"
  - "buildGroundingLine(profileRow, platform): GROUND-03 honest human-facing card copy by role (D-09/D-14)"
  - "isThin(profileRow): exported thinness check (same semantics as assembler.ts:isProfileThin)"
  - "kcStamp() + withKcStamp() + KC_PROVENANCE_FIELD: KC_GEN_VERSION provenance helpers"
  - "Landing spot decision: stamp rides JSONB message body as { kcGenVersion, blocks } wrapper — no schema migration"
affects: [03-ideas-tool plans 03-04, any phase persisting Ideas generative output]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-10 idea-card block pattern: 3 registry edits (blocks.ts schema + block-registry.ts entry + block-registry.tsx/.message-blocks.tsx component maps); mirrors verified band-block pattern"
    - "GROUND-03 by-role card-copy pattern: read ProfileRow by semantic role → render human-facing fragments; NEVER reuse PROFILE_ROLE_MAP formatters (LLM-facing prose)"
    - "KC_GEN_VERSION stamp: { kcGenVersion, blocks } message-body wrapper; pure, no schema migration, Plan 03 reads KC_PROVENANCE_FIELD"

key-files:
  created:
    - src/lib/tools/__tests__/idea-card-block.test.ts
    - src/components/thread/idea-card-block.tsx
    - src/lib/kc/__tests__/grounding-line.test.ts
    - src/lib/kc/grounding-line.ts
    - src/lib/kc/kc-stamp.ts
  modified:
    - src/lib/tools/blocks.ts
    - src/lib/tools/block-registry.ts
    - src/lib/tools/block-registry.tsx
    - src/components/thread/message-blocks.tsx

key-decisions:
  - "IdeaCardBlockSchema props: title, angle, whyItFits, mechanism, seedHook, needsTake (boolean), topic, take, format (nullable), band (Strong|Mixed|Weak), fraction, scrollQuote, model (literal 'sim1-flash')"
  - "buildGroundingLine signature: (profileRow: ProfileRow | null, platform: string) → { line: string; coldStart: boolean }"
  - "Wins fragment: count-only 'your last N videos overperformed' — no mechanism (past_wins stores URL only in v1; fabricating mechanism from URL would breach honesty spine)"
  - "isThin exported from grounding-line.ts — local copy of assembler.ts semantics to avoid circular import risk; semantics are identical"
  - "KC stamp landing spot: { kcGenVersion: string; blocks: IdeaCardBlock[] } wrapper object on the JSONB message body (Plan 03 consumes KC_PROVENANCE_FIELD constant)"
  - "IdeaCardRenderer: model emits props only, component owns layout (THREAD-04); no model-generated markup"

# Metrics
duration: 40min
completed: 2026-06-17
---

# Phase 03 Plan 02: Ideas Tool — Blocks, Grounding, Stamp Summary

**idea-card typed block in fixed registry (D-10) + GROUND-03 by-role grounding-line extractor (D-09/D-14) + KC_GEN_VERSION provenance stamping helper (P1-deferred)**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-06-17
- **Tasks:** 3 of 3
- **Files created:** 5
- **Files modified:** 4

## Plan-03 + Plan-04 Handoff (MANDATORY — 3 contracts)

### 1. IdeaCardBlockSchema prop names (Plan 03 must use these exact names)

```ts
{
  title: string,
  angle: string,
  whyItFits: string,        // grounding line (from buildGroundingLine)
  mechanism: string,
  seedHook: string,
  needsTake: boolean,
  topic: string,
  take: string,
  format: string | null,
  band: "Strong" | "Mixed" | "Weak",
  fraction: string,
  scrollQuote: string,
  model: "sim1-flash",      // must be literal "sim1-flash" — not a variable
}
```

### 2. buildGroundingLine signature (Plan 03 calls this server-side)

```ts
import { buildGroundingLine } from "@/lib/kc/grounding-line";

const { line, coldStart } = buildGroundingLine(profileRow, platform);
// line → goes into IdeaCardBlock.props.whyItFits
// coldStart → can be logged/telemetried; does NOT change card structure
```

### 3. KC_GEN_VERSION stamp landing spot (Plan 03 persists this)

```ts
import { withKcStamp, KC_PROVENANCE_FIELD } from "@/lib/kc/kc-stamp";

// Recommended — wrap blocks with stamp before insertMessage:
const messageBody = withKcStamp({ blocks: ideaCardBlocks });
// → { kcGenVersion: "gen.1.0.0", blocks: [...] }

// Plan 03 must store this as the messages.body JSONB value.
// No schema migration needed — JSONB accepts the extra field.
// Do NOT pass kcGenVersion as a block in the blocks array
// (it is not registered; would render as UnsupportedBlock).
```

## Task Commits

| # | Phase | Commit | Description |
|---|-------|--------|-------------|
| 1 RED | TDD | 5e00ee7e | test(03-02): failing idea-card block registry tests |
| 1 GREEN | TDD | 6269b1ba | feat(03-02): idea-card block — schema, registry, renderer |
| 2 RED | TDD | 61ab8f58 | test(03-02): failing grounding-line extractor tests |
| 2 GREEN | TDD | 4014d308 | feat(03-02): GROUND-03 grounding-line extractor |
| 3 | execute | c4b125d1 | feat(03-02): KC_GEN_VERSION stamping helper |

## Files Created/Modified

- `src/lib/tools/blocks.ts` — Added `IdeaCardBlockSchema` + `IdeaCardBlock` type; added to `BlockUnionSchema`
- `src/lib/tools/block-registry.ts` — Added `"idea-card"` entry with `IdeaCardBlockSchema`
- `src/lib/tools/block-registry.tsx` — Added `"idea-card": IdeaCardRenderer` to `BLOCK_COMPONENT_REGISTRY`
- `src/components/thread/message-blocks.tsx` — Added `"idea-card": IdeaCardRenderer` to inline `BLOCK_COMPONENTS`
- `src/components/thread/idea-card-block.tsx` — NEW: `IdeaCardRenderer` (concept-forward face + expand + badge + band chip)
- `src/lib/kc/grounding-line.ts` — NEW: `buildGroundingLine` + `isThin` (GROUND-03, D-09/D-14)
- `src/lib/kc/kc-stamp.ts` — NEW: `kcStamp()` + `withKcStamp()` + `KC_PROVENANCE_FIELD`
- `src/lib/tools/__tests__/idea-card-block.test.ts` — NEW: 8 tests (RED TDD gate)
- `src/lib/kc/__tests__/grounding-line.test.ts` — NEW: 18 tests (RED TDD gate)

## Decisions Made

- **IdeaCardBlock prop shape:** 13 props covering concept anatomy (title/angle/whyItFits/mechanism/seedHook/needsTake/topic/take/format) + embedded Flash signal (band/fraction/scrollQuote/model). `format` is nullable (not every idea maps to a specific format). `model` is `z.literal("sim1-flash")` (not an enum — enforces idea cards are always Flash-generated).
- **IdeaCardRenderer layout:** Face always visible (title + angle + grounding line in a distinct inset box + lead quote as a blockquote); expand toggle reveals mechanism/seedHook/topic×take×format table. needsTake badge in the title row. Band chip secondary below the grounding line.
- **Grounding line: count-only wins.** `past_wins` stores `{url}` only in v1. The honest v1 line omits the mechanism ("last 3 myth-busts") and says "your last 3 videos overperformed". This is the documented honesty-spine trade (RESEARCH §Pattern 5, §Pitfall 1).
- **isThin: local copy.** `grounding-line.ts` replicates `assembler.ts:isProfileThin` semantics locally to avoid any circular import risk. The logic is identical; the copy is intentional and documented.
- **KC stamp landing: wrapper, not block.** `withKcStamp({ blocks })` → `{ kcGenVersion, blocks }` stored as the JSONB message body. This avoids registering a non-rendered internal sentinel block in the registry.

## Deviations from Plan

None — plan executed exactly as specified. All three artifacts deliver their required contracts.

## Known Stubs

None. All outputs are wired to real data:
- `IdeaCardRenderer` renders from validated typed props (no placeholder data).
- `buildGroundingLine` reads real `ProfileRow` fields by semantic role.
- `kcStamp()` returns the real `KC_GEN_VERSION` constant.
The grounding-line wins fragment intentionally omits mechanism (count-only) — this is an explicit honesty decision, not a stub.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced. Threat register mitigations T-03-04/T-03-05/T-03-06 applied:
- T-03-04 (model-generated UI): BLOCK_REGISTRY + double `validateBlock` (write + rehydration); `IdeaCardRenderer` owns layout.
- T-03-05 (honesty spine grounding): `buildGroundingLine` reads only data-supported fragments; count-only wins; cold-start is an honest flag; test asserts no caveat-prose leak.
- T-03-06 (output provenance): `KC_GEN_VERSION` stamp on persisted output, decoupled from `ENGINE_VERSION`.

## Self-Check: PASSED

- `src/lib/tools/__tests__/idea-card-block.test.ts`: FOUND
- `src/components/thread/idea-card-block.tsx`: FOUND
- `src/lib/kc/__tests__/grounding-line.test.ts`: FOUND
- `src/lib/kc/grounding-line.ts`: FOUND (exports buildGroundingLine + isThin)
- `src/lib/kc/kc-stamp.ts`: FOUND (exports kcStamp, withKcStamp, KC_PROVENANCE_FIELD)
- `src/lib/tools/blocks.ts`: FOUND (IdeaCardBlockSchema)
- `src/lib/tools/block-registry.ts`: FOUND ("idea-card" registered)
- `src/lib/tools/block-registry.tsx`: FOUND (IdeaCardRenderer in BLOCK_COMPONENT_REGISTRY)
- `src/components/thread/message-blocks.tsx`: FOUND (IdeaCardRenderer in BLOCK_COMPONENTS)
- Commit 5e00ee7e (RED test): FOUND
- Commit 6269b1ba (GREEN feat): FOUND
- Commit 61ab8f58 (RED test): FOUND
- Commit 4014d308 (GREEN feat): FOUND
- Commit c4b125d1 (Task 3): FOUND
- vitest run src/lib/tools + src/lib/kc: 42 PASS, 0 FAIL
- npm run build: PASS (Compiled successfully)
