---
phase: 2
slug: remix-mode-one-board-two-config
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-01
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | (detect during Wave 0 — repo uses vitest for board + backend suites) |
| **Quick run command** | `npx vitest run --changed` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10-25s per filtered suite; full suite minutes |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~25s (single filtered vitest run)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-T1 | 01 | 1 | REMIX-01/02 | T-02-01,02,03 | schema enum/refine + score-path-safe hash gates exist (RED-first) | unit | `npx vitest run src/lib/engine/__tests__/analysis-input-schema.test.ts src/lib/engine/cache/__tests__/prediction-cache.test.ts` | ❌→Wave0 | ⬜ pending |
| 01-T2 | 01 | 1 | REMIX-01/02 | T-02-01,02,03 | mode validated+folded+persisted; score hash byte-identical | unit+type | `npx vitest run src/lib/engine/__tests__/analysis-input-schema.test.ts src/lib/engine/cache/__tests__/prediction-cache.test.ts && npx tsc --noEmit` | ✅ extend | ⬜ pending |
| 01-T3 | 01 | 1 | REMIX-02 crit5 | T-02-01 | live DB has mode col NOT NULL DEFAULT 'score' + backfill + CHECK | manual (DB) | information_schema query (checkpoint) | n/a | ⬜ pending |
| 02-T1 | 02 | 1 | REMIX-02 | T-02-06,07 | resolveBoardLayout remix swap, score byte-identical, preset no-crash | unit | `npx vitest run src/components/board/__tests__/board-constants.test.ts` | ✅ extend | ⬜ pending |
| 02-T2 | 02 | 1 | REMIX-02 | T-02-08 | shells are DOM (no react-konva), descriptors exact, no skeleton | component | `npx vitest run src/components/board/decode/__tests__/DecodeShellNode.test.tsx src/components/board/adapt/__tests__/AdaptShellNode.test.tsx` | ❌→Wave0 | ⬜ pending |
| 02-T3 | 02 | 1 | REMIX-02 | T-02-07 | overlay+mobile dispatch decode/adapt; remix order; no undefined-id crash | component+type | `npx vitest run src/components/board/__tests__/BoardMobile.test.tsx && npx tsc --noEmit` | ✅ extend | ⬜ pending |
| 03-T1 | 03 | 2 | REMIX-01 | T-02-09 | intent selector + remix coupling (Text/caption hidden, tab reset) | component | `npx vitest run src/components/app/__tests__/content-form.test.tsx` | ❌→Wave0 | ⬜ pending |
| 03-T2 | 03 | 2 | REMIX-01 | T-02-11 | mode threaded form→stream→POST (3 touch points) | type | `npx tsc --noEmit; grep -c "mode: data.mode" src/components/board/Board.tsx` | ✅ | ⬜ pending |
| 03-T3 | 03 | 2 | REMIX-02 crit1-5 | T-02-10 | boardMode live+permalink agree; score unchanged | component+type | `npx vitest run src/components/board/__tests__/board-constants.test.ts src/components/board/__tests__/BoardMobile.test.tsx && npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/lib/engine/__tests__/analysis-input-schema.test.ts` — REMIX-01 schema mode enum + default + remix-not-text refine (NEW, Plan 01 T1)
- [x] `src/lib/engine/cache/__tests__/prediction-cache.test.ts` — score-path-stability (hardcoded hash) + mode-distinctness (EXTEND, Plan 01 T1)
- [x] `src/components/board/decode/__tests__/DecodeShellNode.test.tsx` + adapt equivalent — shell renders descriptor, DOM not Konva, no skeleton (NEW, Plan 02 T2)
- [x] `src/components/board/__tests__/board-constants.test.ts` — remix swap + score byte-identical regression (EXTEND, Plan 02 T1)
- [x] `src/components/board/__tests__/BoardMobile.test.tsx` — remix order + renderBody cases, score order unchanged (EXTEND, Plan 02 T3)
- [x] `src/components/app/__tests__/content-form.test.tsx` — intent selector + remix coupling + mode in payload (NEW, Plan 03 T1)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Desktop Konva board renders Decode/Adapt shells + reflows | REMIX-02 | Konva canvas visual layout | Submit Remix URL, screenshot board, confirm column reflow |
| Mobile card-stack (<768px) order | REMIX-02 | Visual ordering on phone viewport | Resize <768px, confirm Decode+Adapt cards in order |
| Permalink reload renders persisted mode | REMIX-02 crit5 | End-to-end persistence + render across page load | Submit Remix URL, copy /analyze/[id], hard-reload, confirm decode+adapt config |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (all use `vitest run`)
- [x] Feedback latency ~25s per filtered suite
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-approved 2026-06-01
