---
phase: 02-hero-centerpiece-reading-explainer
plan: 01
subsystem: numen-landing-tests
tags: [nyquist, tdd-red, apca, voice-gate, hero, reading-explainer]
requires:
  - ".numen-surface tokens + VerdictSwatch + StageBlock (Numen Surface Phase 1 / Phase 01 bridge)"
  - "scripts/check-apca.ts (existing APCA gate)"
provides:
  - "5 RED Phase-2 component test scaffolds — automated verify for HERO-01..04, READ-01, READ-02, CTA-01, VOICE Rules 1-2"
  - "APCA on-band label pairing — the gate deciding Plan 02 VerdictThrone plate-vs-on-band composition"
affects:
  - "Plan 02 (verdict-throne): on-band Lc 41.8 < 60 → MUST use bg-panel plate, not label-on-band"
  - "Waves 1-3 implementations — every Phase-2 requirement now has a GREEN target waiting"
tech-stack:
  added: []
  patterns:
    - "Nyquist RED-first: dynamic import() of unbuilt component → suite fails on module-resolution, not syntax"
    - "happy-dom per-file pragma for render tests; verbatim useReducedMotion()=>true mock for reduced-motion gate"
    - "rendered-text VOICE scan (container.textContent vs ban-list regex array)"
    - "APCA on-band pairing as a composition-decision gate (failing-by-design = signal, not a bug)"
key-files:
  created:
    - "src/components/numen-landing/__tests__/hero.test.tsx"
    - "src/components/numen-landing/__tests__/verdict-throne.test.tsx"
    - "src/components/numen-landing/__tests__/how-it-works.test.tsx"
    - "src/components/numen-landing/__tests__/reading-loop.test.tsx"
    - "src/components/numen-landing/__tests__/voice.test.tsx"
  modified:
    - "scripts/check-apca.ts"
decisions:
  - "On-band verdict-good label (#f0ebe3 on #7faf7a) measures Lc 41.8 < 60 → Plan 02 VerdictThrone MUST back the label with a bg-panel plate (UI-SPEC §Color). Target 60 NOT relaxed."
metrics:
  duration: 3m
  completed: 2026-06-12
  tasks: 3
  files: 6
---

# Phase 02 Plan 01: Wave-0 Nyquist Test Scaffolds + APCA Gate Extension Summary

Authored 5 RED Phase-2 component test scaffolds and extended the APCA gate with a verdict-good label-on-band pairing — so every Phase-2 requirement has an automated verify that is RED now and goes GREEN as Waves 1–3 ship against it.

## What Was Built

- **3 render-assertion scaffolds** (`hero`, `verdict-throne`, `how-it-works`) — happy-dom render tests using dynamic `import()` of the not-yet-built components so each fails on module resolution (true RED), covering HERO-01/02/03, READ-01/02, CTA-01, and the VOICE Rule 3 no-naked-number assertion (`/\d+\s*\/\s*100|\d+\s*%/`).
- **2 behavior scaffolds** (`reading-loop`, `voice`) — HERO-04 reduced-motion static end-state (verbatim `useReducedMotion: () => true` mock + translate-scan `/translate(Y|3d)?\([^)]*[1-9]/`) and a VOICE Rules 1-2 forbidden-copy scan over the combined rendered text (`%`, `viral`, `virality`, `guaranteed`, `Apollo`, `fold`, `Omni`, `pipeline`, `model`, `accuracy`, `predict`).
- **APCA gate extension** — a new on-band check measuring the throne label (`#f0ebe3`) ON the good band (`#7faf7a`) against Lc ≥ 60, appended after the existing base-loop without modifying any existing hex or pairing.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Render-assertion scaffolds | `5b90886d` | hero / verdict-throne / how-it-works .test.tsx |
| 2 | Reduced-motion + voice scaffolds | `bbf66bf5` | reading-loop / voice .test.tsx |
| 3 | APCA on-band label pairing | `5825c202` | scripts/check-apca.ts |

## Verification

- `pnpm exec vitest run src/components/numen-landing/__tests__` → **5 suites, 5 failed**, each on `Failed to resolve import "@/components/numen-landing/<component>"` — the intended Wave-0 RED state (missing modules, NOT syntax errors).
- `pnpm tsx scripts/check-apca.ts` → exit **1**; the 6 existing pairings still PASS unchanged, and the new on-band pairing reports `[FAIL] verdict-good-label #f0ebe3 → Lc 41.8 (target ≥ 60)`.

## Key Decision — verdict throne composition (gates Plan 02)

The on-band label measures **Lc 41.8 < 60**. Per the plan, this sub-60 result is the **signal** (not a bug): Plan 02's `VerdictThrone` must place the band label on a UI-SPEC-sanctioned `bg-panel` plate rather than directly on the `bg-verdict-good` band. The target was deliberately left at 60 (not relaxed) so the gate keeps enforcing this composition.

## Deviations from Plan

None — plan executed exactly as written. The APCA gate's non-zero exit is the planned, intended outcome (a composition-decision signal), not a failure to fix.

## Known Stubs

None — this is a test/config-only Wave-0 plan. No production component shipped (Waves 1–3 own that); the RED suites are intentional scaffolds, not stubs.

## Self-Check: PASSED

- FOUND: src/components/numen-landing/__tests__/hero.test.tsx
- FOUND: src/components/numen-landing/__tests__/verdict-throne.test.tsx
- FOUND: src/components/numen-landing/__tests__/how-it-works.test.tsx
- FOUND: src/components/numen-landing/__tests__/reading-loop.test.tsx
- FOUND: src/components/numen-landing/__tests__/voice.test.tsx
- FOUND: scripts/check-apca.ts (modified)
- FOUND commit: 5b90886d, bbf66bf5, 5825c202
