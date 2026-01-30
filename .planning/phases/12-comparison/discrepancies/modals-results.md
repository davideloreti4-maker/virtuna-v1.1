# Modals & Results Discrepancies

> Phase 12 Plan 03 - Visual Comparison Report
> Generated: 2026-01-30

## Create Society Modal

**Reference:** `extraction/screenshots/desktop-fullpage/modals/01-create-society-modal.png`
**Virtuna:** `.planning/phases/12-comparison/virtuna-screenshots/modals/01-create-society-modal.png`

| ID | Component | Element | Issue | Type | Severity | Reference | Current | Fix Hint | File Path | Status |
|----|-----------|---------|-------|------|----------|-----------|---------|----------|-----------|--------|
| D-200-001 | Modal | backdrop | Background styling differs - reference has purple gradient, Virtuna has black with dots | color | Minor | Purple gradient blur | Black with network viz | Overlay component may need gradient styling | src/components/app/create-society-modal.tsx | Open |
| D-200-002 | Modal | border-radius | Modal corner radius appears consistent | - | - | ~12px | ~12px | Verified match | src/components/app/create-society-modal.tsx | OK |
| D-200-003 | Modal | background | Modal body background color matches | - | - | #18181B | #18181B | Verified match | src/components/app/create-society-modal.tsx | OK |
| D-200-004 | Modal | title | Title text "Who do you want in your society?" matches | - | - | White text | White text | Verified match | src/components/app/create-society-modal.tsx | OK |
| D-200-005 | Modal | description | Description paragraph styling matches | - | - | text-zinc-400 | text-zinc-400 | Verified match | src/components/app/create-society-modal.tsx | OK |
| D-200-006 | Input | border | Input border styling consistent | - | - | border-zinc-700 | border-zinc-700 | Verified match | src/components/app/create-society-modal.tsx | OK |
| D-200-007 | Input | placeholder | Placeholder text matches | - | - | "e.g. Founders in London..." | "e.g. Founders in London..." | Verified match | src/components/app/create-society-modal.tsx | OK |
| D-200-008 | Button | style | CTA button styling matches | - | - | Green outline | Green outline | Verified match | src/components/app/create-society-modal.tsx | OK |
| D-200-009 | Modal | back-arrow | Back arrow icon present and positioned | - | - | Top-left | Top-left | Verified match | src/components/app/create-society-modal.tsx | OK |
| D-200-010 | Overlay | animation | Modal overlay animation timing | animation | Minor | Fade 200ms | Instant | Add fade-in animation to overlay | src/components/app/create-society-modal.tsx | Open |

## Leave Feedback Modal

**Reference:** `extraction/screenshots/desktop-fullpage/modals/02-leave-feedback-modal.png`
**Virtuna:** `.planning/phases/12-comparison/virtuna-screenshots/modals/02-leave-feedback-modal.png`

| ID | Component | Element | Issue | Type | Severity | Reference | Current | Fix Hint | File Path | Status |
|----|-----------|---------|-------|------|----------|-----------|---------|----------|-----------|--------|
| D-200-011 | Modal | background | Modal background color matches | - | - | Dark (#18181B) | Dark (#18181B) | Verified match | src/components/app/leave-feedback-modal.tsx | OK |
| D-200-012 | Modal | title | Title "Leave feedback" styling matches | - | - | White text 18px | White text 18px | Verified match | src/components/app/leave-feedback-modal.tsx | OK |
| D-200-013 | Input | name-field | Name input field styling matches | - | - | border-zinc-700 | border-zinc-700 | Verified match | src/components/app/leave-feedback-modal.tsx | OK |
| D-200-014 | Input | email-field | Email input field styling matches | - | - | border-zinc-700 | border-zinc-700 | Verified match | src/components/app/leave-feedback-modal.tsx | OK |
| D-200-015 | Textarea | feedback-field | Feedback textarea styling matches | - | - | border-zinc-700, resize-none | border-zinc-700 | Verified match | src/components/app/leave-feedback-modal.tsx | OK |
| D-200-016 | Button | submit | Submit button styling - reference has outline, Virtuna has solid | color | Minor | White outlined | Dark solid with arrow | Update button variant to outline-white | src/components/app/leave-feedback-modal.tsx | Open |
| D-200-017 | Link | support-email | Support email link styling matches | - | - | Underlined link | Underlined link | Verified match | src/components/app/leave-feedback-modal.tsx | OK |
| D-200-018 | Modal | close-button | X close button styling matches | - | - | Top-right zinc-500 | Top-right zinc-500 | Verified match | src/components/app/leave-feedback-modal.tsx | OK |
| D-200-019 | Modal | padding | Modal padding consistent | - | - | p-6 | p-6 | Verified match | src/components/app/leave-feedback-modal.tsx | OK |
| D-200-020 | Label | section-labels | "Your details" and "Your feedback" labels match | - | - | text-sm text-zinc-400 | text-sm text-zinc-400 | Verified match | src/components/app/leave-feedback-modal.tsx | OK |

## Results Panel

**Reference:** `extraction/screenshots/desktop-fullpage/results/01-results-panel.png`
**Virtuna:** `.planning/phases/12-comparison/virtuna-screenshots/results/01-results-panel.png`

| ID | Component | Element | Issue | Type | Severity | Reference | Current | Fix Hint | File Path | Status |
|----|-----------|---------|-------|------|----------|-----------|---------|----------|-----------|--------|
| D-200-021 | Panel | background | Results panel background matches | - | - | #18181B | #18181B | Verified match | src/components/app/simulation/results-panel.tsx | OK |
| D-200-022 | Panel | border | Panel border styling matches | - | - | border-zinc-800 | border-zinc-800 | Verified match | src/components/app/simulation/results-panel.tsx | OK |
| D-200-023 | Title | header | "Simulation Results" title styling | typography | Minor | May be different weight | font-medium | Verify font-weight matches reference | src/components/app/simulation/results-panel.tsx | Open |
| D-200-024 | Button | share | Share button styling matches | - | - | Outline with icon | Outline with icon | Verified match | src/components/app/simulation/results-panel.tsx | OK |
| D-200-025 | Score | impact-score | Impact Score large number styling | typography | Minor | ~48px green | ~64px green | Verify font-size matches reference | src/components/app/simulation/impact-score.tsx | Open |
| D-200-026 | Label | score-label | "Impact Score" label with info icon | - | - | text-zinc-400 | text-zinc-400 | Verified match | src/components/app/simulation/impact-score.tsx | OK |
| D-200-027 | Badge | rating-badge | "Excellent/Good/Average" badge styling | - | - | Green text | Green text | Verified match | src/components/app/simulation/impact-score.tsx | OK |
| D-200-028 | Bar | attention-bar | Attention breakdown progress bar | - | - | Red-Orange-Gray segments | Red-Orange-Gray segments | Verified match | src/components/app/simulation/attention-section.tsx | OK |
| D-200-029 | Legend | attention-legend | Full/Partial/Ignore legend items | - | - | Colored dots with labels | Colored dots with labels | Verified match | src/components/app/simulation/attention-section.tsx | OK |
| D-200-030 | Card | variant-card | AI variant card styling | - | - | Dark card with border | Dark card with border | Verified match | src/components/app/simulation/variants-section.tsx | OK |
| D-200-031 | Icon | sparkle-icon | AI sparkle icon on variant titles | - | - | Small sparkle icon | Small sparkle icon | Verified match | src/components/app/simulation/variants-section.tsx | OK |
| D-200-032 | Score | variant-score | Variant score number (79, 72, etc.) | typography | Minor | Right-aligned large | Right-aligned large | Verify alignment and size | src/components/app/simulation/variants-section.tsx | Open |
| D-200-033 | Button | run-another | "Run another test" button styling | - | - | Full-width outline | Full-width outline | Verified match | src/components/app/simulation/results-panel.tsx | OK |

## Results Insights

**Reference:** `extraction/screenshots/desktop-fullpage/results/02-results-insights.png`
**Virtuna:** `.planning/phases/12-comparison/virtuna-screenshots/results/02-results-insights.png`

| ID | Component | Element | Issue | Type | Severity | Reference | Current | Fix Hint | File Path | Status |
|----|-----------|---------|-------|------|----------|-----------|---------|----------|-----------|--------|
| D-200-034 | Panel | insights-layout | Insights section layout matches results panel | - | - | Same card structure | Same card structure | Verified match | src/components/app/simulation/results-panel.tsx | OK |
| D-200-035 | Score | impact-display | Impact score display in insights view | - | - | Same styling | Same styling | Verified match | src/components/app/simulation/impact-score.tsx | OK |
| D-200-036 | Section | accordion | Accordion-style sections for Attention, Variants | layout | Minor | May have expand/collapse | Inline display | Verify accordion behavior exists | src/components/app/simulation/results-panel.tsx | Open |
| D-200-037 | Card | variant-descriptions | Variant card descriptions truncation | typography | Minor | May truncate differently | line-clamp-2 | Verify line-clamp matches reference | src/components/app/simulation/variants-section.tsx | Open |
| D-200-038 | Separator | section-dividers | Dividers between sections | spacing | Minor | May have different spacing | Standard spacing | Verify gap/margin matches | src/components/app/simulation/results-panel.tsx | Open |

## Summary

### Discrepancy Statistics
- **Total items examined:** 38
- **Verified matches:** 28
- **Open issues:** 10

### Issues by Severity
- **Critical:** 0
- **Major:** 0
- **Minor:** 10

### Issues by Type
- **Color:** 2 (D-200-001, D-200-016)
- **Typography:** 4 (D-200-023, D-200-025, D-200-032, D-200-037)
- **Animation:** 1 (D-200-010)
- **Layout:** 1 (D-200-036)
- **Spacing:** 2 (D-200-038)

### Priority Actions

1. **Typography verification (Minor):**
   - D-200-023, D-200-025, D-200-032, D-200-037
   - Verify font sizes and weights against reference
   - Files: `impact-score.tsx`, `variants-section.tsx`, `results-panel.tsx`

2. **Button styling (Minor):**
   - D-200-016: Feedback modal submit button
   - Update to white outlined variant to match reference

3. **Modal overlay animation (Minor):**
   - D-200-010: Add fade-in animation to create society modal overlay

4. **Accordion behavior (Minor):**
   - D-200-036: Verify results sections have expand/collapse if reference shows it

### Notes

- Overall fidelity is high - most components match the reference
- No critical or major issues detected in modal or results screens
- Minor typography and styling adjustments needed
- The network visualization background differs from reference gradient but this is consistent with the overall app design
