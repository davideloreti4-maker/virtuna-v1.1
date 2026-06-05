---
phase: 03-apollo-reasoner-brain-1-the-moat-shared-knowledge-core
plan: "03"
subsystem: engine/remix
tags: [knowledge-core, byte-stability, r12, d11, d12, t-03-08, wave-2]
dependency_graph:
  requires:
    - Plan 01 (apollo-core.ts: KNOWLEDGE_CORE export)
  provides:
    - DECODE_SYSTEM_PROMPT grounded in KNOWLEDGE_CORE §5 Decode Lens
    - ADAPT_SYSTEM_PROMPT grounded in KNOWLEDGE_CORE §6+§2 Rewrite Lens
    - R12 satisfied: all three reasoning surfaces (score-mode Apollo + remix decode + adapt) share one brain
    - remix-core-grounding.test.ts R12 cases GREEN (both prompts reference KNOWLEDGE_CORE)
    - T-03-08 mitigated: adapt retry nudge moved to user message (byte-stable prefix preserved)
  affects:
    - /api/remix/adapt (ADAPT_SYSTEM_PROMPT grounded; contract unchanged)
    - DashScope prefix cache: adapt retries no longer bust the cached prefix
tech_stack:
  added: []
  patterns:
    - KNOWLEDGE_CORE prepend pattern: `${KNOWLEDGE_CORE}\n\n---\n\n` + [lens header + existing contract]
    - Retry nudge on user message (not system) for byte-stable prefix preservation
key_files:
  created: []
  modified:
    - path: src/lib/engine/remix/decode-prompts.ts
      change: Prepend KNOWLEDGE_CORE; add §5 Decode Lens header; import from apollo-core.ts; voice contract + JSON schema UNCHANGED
    - path: src/lib/engine/remix/adapt.ts
      change: Prepend KNOWLEDGE_CORE; add §6+§2 lens header; import from apollo-core.ts; move extraInstruction to user message; Zod schemas + buildAdaptUserContent UNCHANGED
    - path: src/lib/engine/__tests__/remix-core-grounding.test.ts
      change: Flip R12 Wave 0 scaffold assertions from RED (not.toContain) to GREEN (toContain) for both decode and adapt cases
decisions:
  - R12 verify pattern: grep KNOWLEDGE_CORE + test assertion on coreOpening "Apollo Knowledge Core" — both GREEN
  - §5 lens added as header between core and existing voice contract (preserves all D-12 contract lines)
  - §6+§2 lens added as header between core and existing RULES block (preserves D-12 concepts[3] contract)
  - extraInstruction moved from system to user message in generateAdaptConcepts loop (T-03-08 mitigation: cached prefix survives retry)
metrics:
  duration: ~12 minutes
  completed: "2026-06-05T12:21:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 3
---

# Phase 03 Plan 03: Remix Re-Grounding Summary

Re-grounded Remix's two reasoning surfaces (decode + adapt) in the SAME shared knowledge core as score-mode Apollo (R12): DECODE_SYSTEM_PROMPT now prepends KNOWLEDGE_CORE §5 Decode Lens; ADAPT_SYSTEM_PROMPT prepends KNOWLEDGE_CORE §6+§2 Rewrite Lens — one brain across all three modes, zero divergent knowledge base.

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Re-ground DECODE_SYSTEM_PROMPT on core §5 (preserve 4-beat + luck contract) | 115ffb98 | GREEN (32 decode tests) |
| 2 | Re-ground ADAPT_SYSTEM_PROMPT on core §6+§2 (preserve concepts[3]; move nudge to user) | df90cfe2 | GREEN (19 adapt tests; 1807/1807 full suite) |

## What Was Built

**Task 1 — decode-prompts.ts re-grounded:**
Added `import { KNOWLEDGE_CORE } from "../apollo-core"` and changed `DECODE_SYSTEM_PROMPT` to prepend the full core followed by a `§5 Decode Lens` bridge header. The existing Voice Contract, Beat Requirements, Luck taxonomy (`timing_trend_moment / existing_audience_reach / algorithmic_outlier / topic_zeitgeist`), and JSON Output Schema are byte-for-byte unchanged (D-12). `buildDecodeContext` (user message builder) is untouched. The R12 Wave 0 scaffold test case was flipped from asserting RED (`not.toContain`) to asserting GREEN (`toContain`).

**Task 2 — adapt.ts re-grounded:**
Added `import { KNOWLEDGE_CORE } from "@/lib/engine/apollo-core"` and changed `ADAPT_SYSTEM_PROMPT` to prepend the full core followed by a `§6 Rewrite Lens + §2 frameworks` bridge header. The existing RULES block and OUTPUT JSON shape are unchanged. `AdaptConceptZodSchema`, `AdaptConceptsZodSchema.length(3)`, and `buildAdaptUserContent` are byte-for-byte unchanged (D-12). Fixed T-03-08: the `extraInstruction` retry nudge was concatenated onto the SYSTEM message (`ADAPT_SYSTEM_PROMPT + extraInstruction`) — moved it to the USER message (`buildAdaptUserContent(input) + extraInstruction`) to preserve the byte-stable prefix across the repair attempt (aligns with decode.ts:67 + deepseek.ts:471 patterns). R12 adapt Wave 0 scaffold flipped to GREEN.

## Verification Results

- `grep -q "KNOWLEDGE_CORE" src/lib/engine/remix/decode-prompts.ts` — exits 0
- `grep -q "KNOWLEDGE_CORE" src/lib/engine/remix/adapt.ts` — exits 0
- `grep -q "4 beats" src/lib/engine/remix/decode-prompts.ts` — exits 0
- `grep -q "length(3)" src/lib/engine/remix/adapt.ts` — exits 0
- `grep -c "ADAPT_SYSTEM_PROMPT + extraInstruction" src/lib/engine/remix/adapt.ts` — returns 0
- `git diff src/lib/engine/remix/decode-types.ts` — empty (schema untouched)
- `npx tsc --noEmit` — 0 errors
- `vitest run remix-core-grounding.test.ts` — 10/10 GREEN (all R12 + D-13 cases)
- `vitest run decode-route.test.ts decode.test.ts` — 32/32 GREEN
- `vitest run adapt.test.ts use-adapt-concepts.test.ts` — 19/19 GREEN
- `npm test` (full suite) — 1807/1807 GREEN, 169/169 test files

## Deviations from Plan

None — plan executed exactly as written. Both tasks followed the TDD RED→GREEN pattern (test flip → implementation → verify). T-03-08 nudge-move was prescribed in the plan action spec.

## Known Stubs

None — this plan is prompt constant re-grounding + test assertion flips; no UI-rendering data flows.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes. Modified files are: prompt string constants (`decode-prompts.ts`, `adapt.ts`) and a test file. T-03-08 (prompt injection guard) is mitigated by design — dynamic content stays in user message, core in system prefix, output Zod-validated.

## Self-Check

- [x] `src/lib/engine/remix/decode-prompts.ts` — modified, contains KNOWLEDGE_CORE import + §5 header
- [x] `src/lib/engine/remix/adapt.ts` — modified, contains KNOWLEDGE_CORE import + §6+§2 header + nudge on user message
- [x] `src/lib/engine/__tests__/remix-core-grounding.test.ts` — modified, R12 cases GREEN
- [x] `src/lib/engine/remix/decode-types.ts` — untouched (git diff empty)
- [x] Commits exist: 115ffb98 (Task 1), df90cfe2 (Task 2)
- [x] `npm test` — 1807/1807 GREEN, 0 failures

## Self-Check: PASSED
