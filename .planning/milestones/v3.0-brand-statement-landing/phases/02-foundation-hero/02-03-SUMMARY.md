---
phase: 02-foundation-hero
plan: 03
subsystem: planning-artifacts
tags: [policy, build-02, brand-bible, external-components]
dependency_graph:
  requires:
    - "Phase 1 BRAND-BIBLE.md §Visual Metaphor Lock addendum (lines 354-555)"
    - "Phase 2 RESEARCH.md §3 (REJECT/ACCEPT matrix source)"
    - "Phase 2 CONTEXT.md D-18, D-19, D-20 (locked policy decisions)"
  provides:
    - ".planning/phases/02-foundation-hero/02-EXTERNAL-COMPONENT-POLICY.md (BUILD-02 artifact)"
    - "BRAND-BIBLE.md §Visual Metaphor Lock cross-reference to policy doc"
  affects:
    - "Phase 2 plan 04 (BehavioralHero.tsx imports must match the 7 allowed sources)"
    - "Phase 3-6 planners (ACCEPT criteria gate any future external imports)"
tech_stack:
  added: []
  patterns:
    - "Phase-scoped policy doc with HTML-tag-style section wrappers (matches 01-PATTERNS.md)"
    - "Blockquote cross-reference convention in BRAND-BIBLE.md addendum"
key_files:
  created:
    - ".planning/phases/02-foundation-hero/02-EXTERNAL-COMPONENT-POLICY.md (97 LOC)"
  modified:
    - "BRAND-BIBLE.md (+2 lines under §Visual Metaphor Lock)"
decisions:
  - "Insertion point: blockquote at top of §Visual Metaphor Lock addendum (after opening blockquote, before §1 Hero) — matches addendum tone"
  - "STRUCTURE.md 'See also' polish skipped: no existing 'See also' pattern in STRUCTURE.md, so optional addition not warranted (orchestrator decision #5 left this discretionary)"
  - "Policy doc length 97 LOC (vs ~150 LOC target): all required content present (header, scope, surveyed_libraries inventory, 6-row REJECT, 7-row ACCEPT, phase2_policy 7-source list, future_phases, sign-off) — tighter is better than padded"
metrics:
  duration_minutes: 4
  completed: 2026-05-10
  tasks_completed: 2
  files_changed: 2
---

# Phase 02 Plan 03: External Component Policy Summary

Authored the BUILD-02 external component vetting policy doc and wired a single cross-reference line from BRAND-BIBLE.md §Visual Metaphor Lock to the policy doc — locking Phase 2 hero to ZERO imports from Magic UI / Aceternity / Origin UI / Cult UI and giving Phases 3-6 planners a sharp 7-criteria ACCEPT filter.

## What Shipped

**Policy doc** (`.planning/phases/02-foundation-hero/02-EXTERNAL-COMPONENT-POLICY.md`, 97 LOC):

- **Header block** — Documented date, phase, requirement (BUILD-02), decision lineage (CONTEXT.md D-18/19/20, RESEARCH.md §3)
- **`<scope>` section** — States Phase 2 ZERO-imports stance + future phase ACCEPT criteria scope; explains why (Anthropic/Linear/Raycast/Vercel reference set anchors restraint over maximalism)
- **`<surveyed_libraries>` section** — 4-row inventory verbatim from RESEARCH.md §3 (Magic UI, Aceternity, Origin UI, Cult UI) with site URLs, what they ship, distinctive aesthetic, Raycast-fit assessment
- **`<criteria>` section** — Two sub-tables:
  - REJECT criteria: 6 numbered rows (R1 maximalist motion, R2 own design tokens, R3 peer-dep conflicts, R4 bundle delta >10 KB, R5 a11y gaps, R6 forces ad-hoc overrides)
  - ACCEPT criteria: 7 numbered rows (A1 single-component copy-paste, A2 restyled to coral+Raycast tokens, A3 vocab-lint passes, A4 bundle delta verified, A5 a11y verified, A6 reference-fidelity check, A7 no peer-dep conflict)
- **`<phase2_policy>` section** — Hard ZERO-imports rule with 7 allowed sources (Tailwind v4, existing button.tsx, use-canvas-resize.ts, usePrefersReducedMotion.ts, inline Canvas 2D, CSS radial-gradient, motion/react reserved for future scroll-reveal)
- **`<future_phases>` section** — Notes for Phase 3 (pipeline diagram via SVG + motion/react; bento via existing extension-card.tsx) and Phase 4 (marquee.tsx already exists). Conclusion: no external library needs identified through Phase 4. Reassessment trigger documented.
- **`## Sign-off` section** — Two checkboxes (Davide reviewed policy / Phase 2 hero ships zero external imports — verified by grep against src/)

**BRAND-BIBLE.md** (+2 lines):

Added a blockquote under §Visual Metaphor Lock (line 358) immediately after the section opening, before §1 Hero — Behavioral Simulation Visual:

```
> Phase 2 lock — see [external component policy](.planning/phases/02-foundation-hero/02-EXTERNAL-COMPONENT-POLICY.md) for the BUILD-02 REJECT/ACCEPT criteria covering Magic UI / Aceternity / Origin UI / Cult UI imports.
```

This is the sole BRAND-BIBLE edit; the addendum's existing content (specs, tables, reference visuals) is untouched.

**PROJECT.md** — NOT modified per orchestrator decision #5 (`! grep -q "external component policy" .planning/PROJECT.md` confirmed). Cross-references happen organically via per-phase CONTEXT.md as future phases discover the doc.

## Verification

Full automated verification command from PLAN.md `<verification>` block:

```bash
test -f .planning/phases/02-foundation-hero/02-EXTERNAL-COMPONENT-POLICY.md && \
grep -q "REJECT" .planning/phases/02-foundation-hero/02-EXTERNAL-COMPONENT-POLICY.md && \
grep -q "ACCEPT" .planning/phases/02-foundation-hero/02-EXTERNAL-COMPONENT-POLICY.md && \
grep -q "ZERO" .planning/phases/02-foundation-hero/02-EXTERNAL-COMPONENT-POLICY.md && \
grep -q "02-EXTERNAL-COMPONENT-POLICY" BRAND-BIBLE.md && \
! grep -q "external component policy" .planning/PROJECT.md && \
echo "Plan 03 OK"
```

Result: `Plan 03 OK`

**Per-task acceptance checks (all PASS):**

| Check | Task 1 | Task 2 |
|-------|--------|--------|
| File exists / section preserved | PASS | PASS (Visual Metaphor Lock intact) |
| REJECT keyword present | PASS | — |
| ACCEPT keyword present | PASS | — |
| BUILD-02 traceability | PASS | — |
| All 4 libraries inventoried | PASS | — |
| 6 REJECT rows (R1-R6) | PASS (count=6) | — |
| 7 ACCEPT rows (A1-A7) | PASS (count=7) | — |
| ZERO-imports policy explicit | PASS | — |
| "external component policy" in BRAND-BIBLE | — | PASS |
| Path reference present | — | PASS |
| Line count grew 1-3 (got +2) | — | PASS |
| PROJECT.md untouched | — | PASS |
| Banned vocab absent (viral / whole-word AI) | PASS | n/a |

## VALIDATION.md Per-Task Verification Map Entries

| Task ID | Verification | Result |
|---------|--------------|--------|
| 02-03-01 | Policy doc exists with 6 REJECT rows, 7 ACCEPT rows, all four libraries inventoried, ZERO-imports stated, BUILD-02 traceability | PASS (commit 940e046) |
| 02-03-02 | BRAND-BIBLE.md has one blockquote under §Visual Metaphor Lock pointing to 02-EXTERNAL-COMPONENT-POLICY.md; PROJECT.md untouched | PASS (commit 193e14a) |

## Manual Gate (Davide review pending)

Per VALIDATION.md "Manual-Only Verifications" — the policy doc ends with two sign-off checkboxes:

- [ ] Davide reviewed policy
- [ ] Phase 2 hero ships zero external imports — verified by grep against src/

The first checkbox is a manual gate before phase verification (per Phase 2 VALIDATION.md). The second can only be checked after Plan 04 ships `BehavioralHero.tsx` and a `grep` of `src/` confirms no `magic-ui`, `aceternity-ui`, `origin-ui`, or `cult-ui` imports.

This is consistent with threat T-2-11 (R) disposition: explicit sign-off as the repudiation mitigation for the policy review.

## Threat Mitigations (from PLAN.md `<threat_model>`)

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-2-09 | accept | No action — public library names + sites only |
| T-2-10 | mitigate | DEFERRED to Plan 04 — `BehavioralHero.tsx` acceptance will include `grep` rejection of magic-ui/aceternity-ui/origin-ui/cult-ui imports per phase2_policy 7-source closed list |
| T-2-11 | mitigate | IMPLEMENTED — policy doc ends with explicit sign-off checkboxes; Davide review is the manual gate |

## Deviations from Plan

None — plan executed exactly as written.

The slight LOC delta (97 actual vs ~150 target) is within the spirit of the plan: every required section is present and all 6 REJECT + 7 ACCEPT rows are documented verbatim from RESEARCH.md §3. Tighter prose, no padding.

## Authentication Gates

None — pure documentation work, no auth required.

## Known Stubs

None — all content is concrete; the only "TODOs" are the two sign-off checkboxes which are the intended manual-gate UX, not stubs.

## Threat Flags

No new security-relevant surface introduced. This plan touches planning artifacts and BRAND-BIBLE.md only — no source code, no network endpoints, no auth paths, no schema changes.

## Commits

| Task | Hash | Message |
|------|------|---------|
| 1 | 940e046 | docs(02-foundation-hero): create external component policy doc |
| 2 | 193e14a | docs(02-foundation-hero): cross-reference policy doc from BRAND-BIBLE |

## Self-Check: PASSED

- File exists: `.planning/phases/02-foundation-hero/02-EXTERNAL-COMPONENT-POLICY.md` — FOUND
- File modified: `BRAND-BIBLE.md` — FOUND (line 358 contains blockquote with policy link)
- Commit `940e046` — FOUND in `git log`
- Commit `193e14a` — FOUND in `git log`
- Full plan verification command exit 0 — PASSED ("Plan 03 OK")
- PROJECT.md untouched — confirmed via `git diff HEAD~1 -- .planning/PROJECT.md` empty
