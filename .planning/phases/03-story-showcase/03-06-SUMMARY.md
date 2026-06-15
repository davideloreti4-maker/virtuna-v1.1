---
phase: 03-story-showcase
plan: 06
subsystem: marketing-landing
tags: [page-shell, density, scroll-anchor, gap-closure, rsc]
gap_closure: true
requires:
  - "src/app/(marketing)/page.tsx (existing assembled story page)"
  - "src/components/layout/header.tsx (sticky h-16 = 64px bar — sized scroll-mt-20)"
provides:
  - "page.tsx with denser section rhythm (py-16 md:py-20)"
  - "scroll-margin-top (scroll-mt-20) on all 6 in-page section anchors"
  - "accurate component docblock"
affects:
  - "every in-page anchor jump (#hero/#how-it-works/#the-simulation/#features/#pricing/#faq)"
tech-stack:
  added: []
  patterns:
    - "scroll-mt-20 (5rem) = intentional anchor offset matching the 64px sticky header (replaces accidental padding clearance)"
    - "py-16 md:py-20 = the page-level denser-on-mobile / calm-on-desktop section rhythm"
key-files:
  created: []
  modified:
    - "src/app/(marketing)/page.tsx"
decisions:
  - "scroll-mt-20 (80px) over the bar height (64px) gives ~16px breathing room above each scrolled-to heading"
  - "Hero gets py-12 md:py-16 (one step tighter than the body) — it owns the first viewport, no border-t above it"
  - "Story/teaser sections unified on py-16 md:py-20; stub sections (#pricing/#faq) take the same rhythm to keep the seam invisible"
metrics:
  duration: ~4min
  completed: 2026-06-15
  tasks: 1
  files: 1
---

# Phase 03 Plan 06: Page Rhythm, Scroll Anchors & Docblock Summary

Tightened `page.tsx` section padding for higher desktop density (GAP-3 page-level), added `scroll-mt-20` to every in-page section anchor so headings clear the 64px sticky header by a reliable 80px offset (GAP-5), and rewrote the stale Phase-1 docblock (IN-02) — all surgical CSS-utility + comment edits in the pure-RSC marketing page; `/` stays statically prerendered.

## What Was Built

Single task, single file (`src/app/(marketing)/page.tsx`):

1. **GAP-5 — scroll-margin-top anchors.** Added `scroll-mt-20` (`scroll-margin-top: 5rem` = 80px) to all six scroll-target sections: `#hero`, `#how-it-works`, `#the-simulation`, `#features`, `#pricing`, `#faq`. The header `<nav>` is `h-16` (64px), so 80px clears it with ~16px breathing room — replacing the prior accidental ~16px clearance from padding luck.
2. **GAP-3 (page-level) — denser rhythm.** Replaced bare `py-20` with `py-16 md:py-20` on the five story/teaser sections (mobile denser, calm desktop step); hero moved to `py-12 md:py-16` (one step tighter, owns the first viewport). Kept the hairline `border-t border-border` separators and the `mx-auto max-w-5xl` inner measure unchanged.
3. **IN-02 — accurate docblock.** Rewrote the component docblock: removed the stale "empty-but-anchored … muted placeholder heading / Real content lands in Phases 2–4" wording; it now states the hero/how-it-works/the-simulation/features sections render real STORY content and only `#pricing`/`#faq` remain Phase-4 stubs. Documented the scroll-mt-20 and density intent inline.

Stub lock honored: no section `id` changed, no imports changed, `#pricing`/`#faq` content untouched. No `"use client"` added — page stays a pure RSC.

## Verification

- `grep -c 'scroll-mt-' src/app/(marketing)/page.tsx` → **7** (6 section anchors + 1 docblock mention); ≥ 6 required ✓
- No bare `py-20` remains — all `py-20` occurrences are `md:py-20` (5 sections) ✓
- `grep '"use client"'` → no match (pure RSC) ✓
- `npm run build` → `✓ Compiled successfully`, **EXIT 0**; route table line 19 = `┌ ○ /` (Static) — `/` stays statically prerendered ✓
- Plan's automated gate (`grep -c scroll-mt … && ! grep use client … && echo OK`) → **VERIFY OK** ✓

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- FOUND: src/app/(marketing)/page.tsx (modified, 7 scroll-mt occurrences, no "use client", build static)
- FOUND: commit 21a94afa (`git log` confirms refactor(03-06) commit)
