---
phase: 04-proof-conversion
plan: "03"
subsystem: marketing/faq
tags: [faq, accordion, client-island, rsc, a11y, flat-warm, CONVERT-03]
dependency_graph:
  requires: [04-00]
  provides: [CONVERT-03]
  affects: [04-05]
tech_stack:
  added: []
  patterns:
    - Radix accordion reused in-repo (call-site token override, no primitive edit)
    - RSC wrapper mounts single client island pattern (mirrors how-it-works.tsx)
key_files:
  created:
    - src/components/marketing/faq/faq-accordion.tsx
    - src/components/marketing/faq/faq.tsx
  modified: []
decisions:
  - Cold-brand accordion tokens overridden at call site only (option A) — ui/accordion.tsx primitive untouched; a legacy route depends on its cold defaults
  - FAQ answers are plain strings only — no dangerouslySetInnerHTML (T-04-03-01)
  - faq.tsx is pure RSC; only faq-accordion.tsx carries "use client" — / stays ○ static
metrics:
  duration: ~5min
  completed_date: "2026-06-15"
  tasks: 2
  files_created: 2
  files_modified: 0
---

# Phase 4 Plan 03: FAQ Accordion — Summary

Flat-warm Radix single-open accordion with 6 objection-busting Q&As, RSC wrapper + lone client island.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | FAQ accordion client island (CONVERT-03) | 3f19bece | src/components/marketing/faq/faq-accordion.tsx |
| 2 | FAQ RSC section wrapper | 3f19bece | src/components/marketing/faq/faq.tsx |

## What Was Built

`faq-accordion.tsx` — `"use client"` Radix accordion island:
- `AccordionRoot type="single" collapsible` (D-16: one panel open at a time + close-all)
- 6 `FAQ_ITEMS` covering accuracy, platform scope, niche fit, data privacy, free trial, and speed (D-15 objection set)
- Cold-brand tokens overridden at call site via className: `border-border`, `bg-surface-elevated/50`, `text-foreground`, `text-foreground/80`, `text-foreground-secondary`
- No hex, no coral, no dangerouslySetInnerHTML, no glass/glow

`faq.tsx` — pure RSC section wrapper:
- No `"use client"` — heading + subhead stay RSC → / stays `○` static
- Sans-serif `<h2>` "Questions, answered" (`text-3xl font-semibold text-foreground`)
- Cream-secondary subhead one-liner
- Mounts `<FaqAccordion className="mt-10" />` as the lone client leaf

## Verification

- CONVERT-03 Nyquist gate: 2/2 tests GREEN
  - 6 button triggers (`getAllByRole("button").length === 6`)
  - ≥6 data-state panels (`querySelectorAll("[data-state]").length >= 6`)
- Cold-brand audit: no `text-white` / `text-gray-400` / `bg-background-elevated` in code (comment docs only)
- `ui/accordion.tsx` shared primitive: git diff = empty (untouched)
- `faq.tsx` grep `"use client"` matches: 0 in code (1 hit only in JSDoc comment documenting absence)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no data sources required; FAQ copy is final conversion content per D-21.

## Threat Surface Scan

No new security surface introduced. The FAQ accordion carries no input, no network calls, no data — purely local expand/collapse state via Radix. T-04-03-01 (XSS) mitigated by plain string children only. T-04-03-02 (client leak) mitigated: only faq-accordion.tsx is `"use client"`.

## Self-Check: PASSED

- [x] `src/components/marketing/faq/faq-accordion.tsx` — exists
- [x] `src/components/marketing/faq/faq.tsx` — exists
- [x] Commit `3f19bece` — exists (git log confirmed)
- [x] CONVERT-03: 2/2 tests GREEN
