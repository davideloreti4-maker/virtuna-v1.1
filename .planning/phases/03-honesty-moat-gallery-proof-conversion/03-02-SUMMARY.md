---
phase: 03-honesty-moat-gallery-proof-conversion
plan: 02
subsystem: numen-landing
tags: [trust, honesty-moat, comparison-table, voice, a11y, rsc]
requires:
  - "VerdictSwatch (numen/verdict-swatch) — good band primitive"
  - "Plan 03-01 honesty-comparison.test.tsx + voice.test.tsx scaffolds (RED seam)"
  - ".numen-surface bridged tokens (bg-panel, text-text, text-text-muted, border-border)"
provides:
  - "HonestyComparison() RSC — TRUST-01/02 kero comparison (Numen band+why vs unnamed virality-score tier)"
  - "the ONE sanctioned home of the rival strings (D-05): viral score / 95% accuracy / guaranteed views"
affects:
  - "page.tsx #honesty slot (to be wired in a later Wave-3 plan)"
  - "voice.test.tsx positive honesty-scoping assertion (now satisfiable)"
tech-stack:
  added: []
  patterns:
    - "semantic <table> + sr-only caption + scope=col/row for an accessible comparison (RESEARCH Pattern 1)"
    - "static RSC, no own heading (single-h1 invariant), color by token NAME only (DS-01)"
    - "VerdictSwatch good band on a bg-panel/border-border plate (APCA plate mitigation, carried)"
key-files:
  created:
    - "src/components/numen-landing/honesty-comparison.tsx"
  modified: []
decisions:
  - "D-04: unnamed generic 'Virality-score tools' tier — no real rival named"
  - "D-05: rival cells carry the fake-precision strings as the rejected category; Numen column stays band+why, VOICE-clean"
  - "D-11: positioning reads an honest verdict, not hype (antidote lead-in, no number as a Numen claim)"
  - "Dropped unused cn() import — no className merge needed in this component (kept lint clean)"
metrics:
  duration: 4m
  completed: 2026-06-12
---

# Phase 3 Plan 02: Honesty Comparison Summary

Semantic-table kero comparison (`HonestyComparison` RSC) contrasting Numen's band+why honest verdict against an unnamed virality-score tier — the one D-05-scoped home of the rival "viral score / 95% accuracy / guaranteed views" strings.

## What Was Built

`src/components/numen-landing/honesty-comparison.tsx` — a static RSC exporting `HonestyComparison()`:

- An antidote lead-in `<p>` (`mt-6 md:mt-8`, `text-text-muted`): "Other tools hand you a number and call it certainty. Numen tells you the truth about your video — and the one thing to fix." (D-11, no number as a Numen claim).
- A semantic `<table>` inside the shared `mx-auto max-w-6xl` rhythm:
  - `<caption className="sr-only">Numen compared to virality-score tools</caption>`
  - `<thead>`: dimension corner `th[scope=col]` + `Numen` + `Virality-score tools` column headers.
  - Three `<tbody>` rows, each `th[scope=row]` (What you get / How it reads / What it promises).
- **Numen cells** — VOICE-clean band + why, never a number:
  - Row 1: `VerdictSwatch verdict="good" size="md"` + bold "An honest verdict you can act on." on a `bg-panel border-border rounded-[12px]` plate (APCA plate mitigation).
  - Row 2: "Reads your video like your sharpest audience would."
  - Row 3: "The one thing to fix — and when it'll land."
- **Rival cells** (`text-text-muted`, plainly stated, NOT screaming) — the D-05 sanctioned strings: "A viral score out of 100." / "A black-box percentage." / "95% accuracy. Guaranteed views."
- Quiet Lucide `Check` (Numen) / `X` (rival) cell markers as `text-text-muted` (NOT accent/verdict-colored), `aria-hidden`.
- Color by token NAME only (zero hex in JSX), no `"use client"`, no `<h1>`/`<h2>`.

## Verification

- `npx vitest run honesty-comparison.test.tsx` → **PASS 2/2 (GREEN)** — table/caption/scoped headers + positive rival-string assertion.
- Acceptance greps: `scope="col"` = 3 (≥2 ✓), `scope="row"` = 3 ✓, one real `<table>`/`<caption>`, `VerdictSwatch` rendered with `verdict="good"`, zero `bg-${` interpolation, rival strings present (4), zero hex, no `"use client"`, no `<h1>/<h2>` (grep hits are doc-comment mentions only), no `%` in Numen cells.
- `npx eslint honesty-comparison.tsx` → No issues.
- `npm run build` → ✓ Compiled successfully; 55/55 static pages generated.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed unused `cn` import**
- **Found during:** Task 1 (build/lint)
- **Issue:** The interface listed `cn` as available "for any className merge", but no className merge was needed in this component — an unused import would fail `noUnusedLocals`/lint.
- **Fix:** Dropped the `import { cn }` line; all classNames are literal strings.
- **Files modified:** src/components/numen-landing/honesty-comparison.tsx
- **Commit:** 0119ed6f

## Notes

- **Voice gate (voice.test.tsx) status:** the file currently fails at module resolution because `reading-gallery` (Plan 03-03) and `cta-section` (Plan 03-05) do not exist yet — this is the EXPECTED RED state documented in the plan's `<verification>` ("the four-component ban scan may still be RED until Plans 03/05 ship — expected"). The honesty-scoping positive assertion this plan must satisfy is identical to, and verified GREEN by, `honesty-comparison.test.tsx`. The voice gate will turn fully GREEN once Plans 03 and 05 ship their components.
- Component is NOT yet wired into `page.tsx` `#honesty` slot — slot wiring is a later Wave-3 integration step per the phase plan.

## Self-Check: PASSED

- FOUND: src/components/numen-landing/honesty-comparison.tsx
- FOUND: commit 0119ed6f
