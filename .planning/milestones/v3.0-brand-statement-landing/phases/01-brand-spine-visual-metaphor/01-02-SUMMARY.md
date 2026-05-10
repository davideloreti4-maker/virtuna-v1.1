---
phase: 01-brand-spine-visual-metaphor
plan: 02
subsystem: brand-spec
tags: [brand-bible, visual-metaphor, hero, pipeline, motion]
requires:
  - .planning/phases/01-brand-spine-visual-metaphor/01-CONTEXT.md
  - .planning/phases/01-brand-spine-visual-metaphor/01-RESEARCH.md
  - .planning/phases/01-brand-spine-visual-metaphor/01-PATTERNS.md
provides:
  - "BRAND-BIBLE.md §Visual Metaphor Lock as the single source of truth for Phase 2 hero motion + pipeline build decisions"
affects:
  - BRAND-BIBLE.md (lines 352-555 appended; lines 1-348 untouched)
tech-stack:
  added: []
  patterns:
    - "Append-only addendum to BRAND-BIBLE.md (preserves existing 348 lines verbatim)"
    - "Canvas 2D for hero particle physics (no third-party motion library)"
    - "motion/react LazyMotion + m + domAnimation for pipeline (~15 KB gzipped)"
    - "Reduced-motion early-return + static-keyframe fallback for both visuals"
key-files:
  created:
    - .planning/phases/01-brand-spine-visual-metaphor/01-02-SUMMARY.md
  modified:
    - BRAND-BIBLE.md (351 -> 555 lines; +206/-2 insertion of Visual Metaphor Lock + footer update)
decisions:
  - "Append addendum after existing footer; replace v2.3.5 + 2026-02-08 footer with v2.3.6 + 2026-05-10 (per D-05, D-06, D-07)"
  - "Split tech: Canvas 2D for hero particles + motion/react for pipeline (per D-08)"
  - "WebGL + GSAP + plain CSS + Lottie + Figma rejected with documented rationale (per D-11)"
  - "Reduced-motion fallback documented for both visuals at all three scales (per D-10)"
  - "Bundle pinning rule: NEW motion code uses motion/react import path; framer-motion legacy imports flagged by Plan 04 vocab-lint (per Pitfall 5)"
metrics:
  duration: "single-task plan"
  completed: 2026-05-10
  tasks_completed: 1
  files_modified: 1
  files_created: 1
---

# Phase 01 Plan 02: Visual Metaphor Lock Summary

Locked Virtuna's paired visual language (hero behavioral simulation + 4-stage engine pipeline) as a written spec appended to BRAND-BIBLE.md, with reference URLs, scale affordances, reduced-motion fallbacks, and split-tech rationale (Canvas 2D ~30 KB + motion/react ~15 KB = ~45 KB under the 50 KB ceiling).

## Files Modified

| File | Before | After | Diff |
|------|--------|-------|------|
| `BRAND-BIBLE.md` | 351 lines | 555 lines | +206 insertions, -2 deletions (footer replaced) |

Net growth: +204 lines (well above the ≥ 450 line acceptance gate).

## Sections Added

The new `## Visual Metaphor Lock` H2 block contains six numbered subsections plus an implementation-notes coda:

1. **Hero -- Behavioral Simulation Visual** -- VIZ-01 concept lock + Canvas 2D rationale + 7-row patterns table citing hive viz file:line landmarks + reference URLs (Stripe, Anthropic, Linear, Raycast) + Phase 1 lock vs Phase 2 finalize split + illustrative skeleton.
2. **Pipeline -- Engine Diagram** -- VIZ-02 4-stage concept lock + SVG rationale + motion/react rationale (rejecting framer-motion + plain CSS + GSAP) + reference URLs (Linear Insights, Vercel Observability, Stripe Atlas) + Phase 1 lock vs Phase 2 finalize split + illustrative skeleton with `LazyMotion strict features={domAnimation}`.
3. **Scale Affordances** (VIZ-03) -- 3-column table for hero/mobile/in-app embed across both visuals; reduced-motion fallback applied at all three scales.
4. **Rejected Alternatives** -- 7-row table documenting WebGL, GSAP, SVG-for-hero, Canvas-for-pipeline, plain CSS, Lottie, Figma rejections.
5. **Performance Budget** (VIZ-04) -- bundle math: 30 KB Canvas + 15 KB motion = 45 KB under 50 KB ceiling.
6. **How Phase 2-6 use this section** -- explicit usage instructions for plan researcher, executor, quality gates, and reference audit.
7. **Phase 2 implementation notes (per CLAUDE.md)** -- Tailwind v4 oklch inaccuracy, Lightning CSS strips backdrop-filter, dev cache hygiene callouts.

Footer line 350-351 replaced from `v2.3.5 / 2026-02-08` to `v2.3.6 / 2026-05-10`.

## VIZ-01..05 Verification (grep counts)

| Requirement | Check | Count | Min | Status |
|-------------|-------|-------|-----|--------|
| VIZ-01 Hero locked | `grep -cE "Behavioral Simulation\|Behavioral-Simulation"` | 1 | ≥ 1 | PASS |
| VIZ-02 Pipeline locked | `grep -cE "4-stage\|Engine.*Pipeline\|Engine Diagram"` | 5 | ≥ 1 | PASS |
| VIZ-03 Scale affordances | `grep -c "Scale Affordances"` | 1 | = 1 | PASS |
| VIZ-04 Canvas 2D | `grep -cE "Canvas 2D"` | 4 | ≥ 1 | PASS |
| VIZ-04 motion/react | `grep -cE "motion/react"` | 10 | ≥ 2 | PASS |
| VIZ-04 LazyMotion | `grep -c "LazyMotion"` | 8 | ≥ 2 | PASS |
| VIZ-04 domAnimation | `grep -c "domAnimation"` | 6 | ≥ 2 | PASS |
| VIZ-04 30 KB | `grep -cE "30 ?KB"` | 2 | ≥ 1 | PASS |
| VIZ-04 15 KB | `grep -cE "15 ?KB"` | 3 | ≥ 1 | PASS |
| VIZ-04 45 KB | `grep -cE "45 ?KB"` | 2 | ≥ 1 | PASS |
| VIZ-05 Section header | `grep -c "^## Visual Metaphor Lock$"` | 1 | = 1 | PASS |

## Reference URLs Cited (D-19 picks per visual)

| Visual | Reference | URL | Count |
|--------|-----------|-----|-------|
| Hero | Stripe homepage | https://stripe.com | 2 |
| Hero | Anthropic Claude | https://www.anthropic.com/claude | 1 |
| Hero | Linear homepage | https://linear.app | 2 |
| Hero | Raycast homepage | https://raycast.com | 2 |
| Pipeline | Linear Insights | https://linear.app/insights | (covered by linear.app) |
| Pipeline | Vercel Observability | https://vercel.com/products/observability | 1 |
| Pipeline | Stripe Atlas | https://stripe.com/atlas | (covered by stripe.com) |

All five required domains present (each ≥ 1 occurrence): stripe.com=2, linear.app=2, anthropic.com=1, vercel.com=1, raycast.com=2.

## Hive Viz File:line Landmarks Cited

| Pattern | File | Citation Count |
|---------|------|----------------|
| `use-hive-animation.ts` references | various lines | 5 |
| `use-canvas-resize.ts` references | lines 43-100 | 2 |
| `HiveCanvas.tsx` references | lines 54-57, 147-186 | 3 |
| `usePrefersReducedMotion.ts` references | lines 1-29 | 4 |
| `hive-renderer.ts` references | lines 240-298 | 1 |

All four mandatory landmarks cited (≥ 1 each): use-hive-animation, use-canvas-resize, HiveCanvas, usePrefersReducedMotion.

## Bundle Numbers Asserted

| Visual | Implementation | Gzipped Cost |
|--------|----------------|--------------|
| Hero particles | Canvas 2D | ~30 KB |
| Pipeline | SVG + motion/react LazyMotion + m + domAnimation | ~15 KB |
| **Total** | | **~45 KB** under 50 KB ceiling |

## Library Import Discipline (Pitfall 5 enforcement)

- Tail (lines 352+) `from 'framer-motion'` literal: **0 occurrences** (passes gate).
- Tail `from "motion/react"` literal: **1 occurrence** in the pipeline skeleton (passes gate).
- Style/em-dash: tail contains 0 em-dashes (`—`) -- only double-hyphens (` -- `) per style invariants. Initial Edit contained one em-dash inside the hero skeleton comment carried over from the plan body; auto-fixed (Rule 1) before commit.
- The original plan body included a meta sentence with the literal string `from 'framer-motion'` describing the lint pattern, which would have tripped the literal-grep gate. Rephrased to "framer-motion import paths" while preserving meaning (Rule 1 -- bug, plan content vs. acceptance criteria mismatch).

## Footer Date Diff

| Field | Before | After |
|-------|--------|-------|
| Version | `v2.3.5` | `v2.3.6` |
| Last updated | `2026-02-08` | `2026-05-10` |

Old `*Last updated: 2026-02-08*` count: **0** (correctly replaced).
New `*Last updated: 2026-05-10*` count: **1** (correctly inserted).

## Existing Content Preservation (anti-Pitfall 4)

- `head -348 BRAND-BIBLE.md | grep -c "^## Resources$"` returns **1** -- existing Resources section intact.
- `head -348 BRAND-BIBLE.md | grep -q "^# Virtuna Design System$"` -- title line preserved.
- Lines 1-348 untouched verbatim; only lines 350-351 (the existing footer) were modified, replaced with the new `---` separator + `## Visual Metaphor Lock` block + new footer.
- Diff stat confirms: `1 file changed, 206 insertions(+), 2 deletions(-)` -- the 2 deletions are exactly the old footer pair.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Em-dash in hero skeleton comment**
- **Found during:** acceptance criteria verification after initial Edit
- **Issue:** Plan's NEW STRING contained `// module-level — same pattern as use-hive-animation.ts:42-49` -- the en/em-dash violated the style invariant "no em-dash, use double-hyphen `--`" and the automated check `tail -n +352 BRAND-BIBLE.md | grep -c "—"` requires 0.
- **Fix:** Replaced em-dash with ` -- ` to match the Brand Bible style invariants.
- **File:** `BRAND-BIBLE.md` (line in §1 illustrative skeleton)
- **Commit:** `e28d03b`

**2. [Rule 1 - Bug] Literal `from 'framer-motion'` in meta-discussion sentence**
- **Found during:** Pitfall 5 acceptance check
- **Issue:** Plan's "Bundle pinning rule" sentence read `The vocab-lint script (Plan 04) flags new from 'framer-motion' imports at commit time` -- the literal string `from 'framer-motion'` was meta-discussion (describing what the lint flags), but the literal-grep gate `tail -n +352 BRAND-BIBLE.md | grep -c "from 'framer-motion'"` requires 0 with no whitelisting.
- **Fix:** Rephrased to "flags new framer-motion import paths at commit time" -- preserves meaning (the rule still says the pattern is forbidden) without containing the literal forbidden string.
- **File:** `BRAND-BIBLE.md` (Performance Budget §, Bundle pinning rule paragraph)
- **Commit:** `e28d03b`

Both fixes were correctness deltas in the plan's NEW STRING vs its own acceptance criteria -- applied automatically per Rule 1, no architectural impact, no user decision needed.

## Authentication Gates

None encountered. Plan introduced no executable code, no external service calls, no auth-bound flows. Threat surface = zero per the plan's own threat model.

## Threat Flags

None. The plan's threat model captures the only relevant trust boundary (markdown-document tampering) and the diff verification confirmed lines 1-348 are untouched.

## Self-Check: PASSED

Verified post-commit:

```
[ ] BRAND-BIBLE.md exists at repo root: PASS
[ ] BRAND-BIBLE.md ≥ 450 lines: 555 lines, PASS
[ ] commit e28d03b exists in git log: PASS
[ ] head -348 contains "## Resources": PASS
[ ] tail -n +352 zero em-dashes: PASS
[ ] tail -n +352 zero "from 'framer-motion'": PASS
[ ] all 26 plan acceptance criteria + 6 phase-level checks: PASS
```

All artifacts created and committed in worktree `worktree-agent-a0fcddb485e1851ad`; nothing left uncommitted.
