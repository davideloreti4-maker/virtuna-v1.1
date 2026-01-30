# Consolidated Discrepancy Report

> Virtuna v1.2 Visual Comparison Analysis
> Phase 12 Consolidation
> Generated: 2026-01-30

## Executive Summary

**Reference:** app.societies.io (production)
**Clone:** Virtuna v1.2 (localhost:3000)
**Viewport:** 1440x900 (Desktop)
**Target:** 98%+ pixel accuracy

### Statistics

| Metric | Count |
|--------|-------|
| **Total Discrepancies** | 45 |
| **Critical** | 8 |
| **Major** | 18 |
| **Minor** | 19 |

### By Type

| Type | Count |
|------|-------|
| Layout | 18 |
| Color | 9 |
| Typography | 8 |
| Spacing | 6 |
| Animation | 2 |

### By Source Plan

| Plan | Component Focus | Open Issues |
|------|-----------------|-------------|
| 12-01 | Dashboard & Navigation | 18 |
| 12-02 | Forms & Selectors | 17 |
| 12-03 | Modals & Results | 10 |

---

## ID Mapping Reference

The following table maps temporary plan IDs to final sequential IDs:

| Final ID | Original ID | Component | Severity |
|----------|-------------|-----------|----------|
| D-001 | D-001-001 | Network Viz | Critical |
| D-002 | D-001-002 | Network Viz | Critical |
| D-003 | D-001-003 | Sidebar | Major |
| D-004 | D-001-004 | Sidebar | Major |
| D-005 | D-001-005 | Sidebar | Major |
| D-006 | D-001-006 | Sidebar | Minor |
| D-007 | D-001-007 | Sidebar | Minor |
| D-008 | D-001-008 | Sidebar | Major |
| D-009 | D-001-009 | Context Bar | Major |
| D-010 | D-001-010 | Context Bar | Minor |
| D-011 | D-001-011 | Context Bar | Minor |
| D-012 | D-001-012 | Context Bar | Minor |
| D-013 | D-001-013 | Header | Major |
| D-014 | D-001-014 | Network Viz | Minor |
| D-015 | D-001-015 | Network Viz | Minor |
| D-016 | D-001-016 | Network Viz | Minor |
| D-017 | D-001-017 | Sidebar | Major |
| D-018 | D-001-018 | Sidebar | Major |
| D-019 | D-100-001 | Society Selector | Critical |
| D-020 | D-100-002 | Society Selector | Critical |
| D-021 | D-100-003 | Society Selector | Critical |
| D-022 | D-100-004 | Society Selector | Major |
| D-023 | D-100-005 | Society Selector | Major |
| D-024 | D-100-006 | Society Selector | Minor |
| D-025 | D-100-007 | Society Card | Major |
| D-026 | D-100-008 | Society Card | Minor |
| D-027 | D-100-009 | Society Card | Major |
| D-028 | D-100-010 | Society Card | Major |
| D-029 | D-100-017 | Test Type Selector | Critical |
| D-030 | D-100-018 | Test Type Selector | Critical |
| D-031 | D-100-019 | Test Type Selector | Major |
| D-032 | D-100-020 | TikTok Form | Critical |
| D-033 | D-100-021 | TikTok Form | Major |
| D-034 | D-100-022 | TikTok Form | Major |
| D-035 | D-100-023 | Survey Form | Critical |
| D-036 | D-200-001 | Modal | Minor |
| D-037 | D-200-010 | Modal | Minor |
| D-038 | D-200-016 | Modal | Minor |
| D-039 | D-200-023 | Results Panel | Minor |
| D-040 | D-200-025 | Results Panel | Minor |
| D-041 | D-200-032 | Results Panel | Minor |
| D-042 | D-200-036 | Results Panel | Minor |
| D-043 | D-200-037 | Results Panel | Minor |
| D-044 | D-200-038 | Results Panel | Minor |
| D-045 | D-200-038 | Results Panel | Minor |

---

## Critical Issues (8)

These issues break functionality or significantly impact the user experience.

### D-001: Network Visualization - Missing Connection Lines

| Field | Value |
|-------|-------|
| **Original ID** | D-001-001 |
| **Component** | Network Visualization |
| **Element** | connection-lines |
| **Issue** | Missing connection lines between dots |
| **Type** | layout |
| **Reference** | Visible gray lines connecting dots |
| **Current** | No lines visible |
| **Fix Hint** | Add SVG line elements or Canvas path rendering |
| **File Path** | `src/components/app/network-visualization.tsx` |

### D-002: Network Visualization - Wrong Dot Clustering

| Field | Value |
|-------|-------|
| **Original ID** | D-001-002 |
| **Component** | Network Visualization |
| **Element** | dot-clustering |
| **Issue** | Dots too scattered, not clustered naturally |
| **Type** | layout |
| **Reference** | Clustered groups with clear connections |
| **Current** | Random scatter pattern |
| **Fix Hint** | Implement force-directed layout algorithm |
| **File Path** | `src/components/app/network-visualization.tsx` |

### D-019: Society Selector - Full Modal vs Dropdown

| Field | Value |
|-------|-------|
| **Original ID** | D-100-001 |
| **Component** | Society Selector |
| **Element** | Container |
| **Issue** | Full modal vs dropdown architecture mismatch |
| **Type** | layout |
| **Reference** | Full-page centered modal with overlay |
| **Current** | Simple dropdown in sidebar |
| **Fix Hint** | Implement Dialog component with centered modal layout |
| **File Path** | `src/components/society-selector/` |

### D-020: Society Selector - Missing Personal Societies Section

| Field | Value |
|-------|-------|
| **Original ID** | D-100-002 |
| **Component** | Society Selector |
| **Element** | Personal Societies |
| **Issue** | Missing section entirely |
| **Type** | layout |
| **Reference** | "Personal Societies" header with LinkedIn/X cards showing "Setup" badges |
| **Current** | Not implemented |
| **Fix Hint** | Add personal societies section with OAuth setup cards |
| **File Path** | `src/components/society-selector/` |

### D-021: Society Selector - Missing Target Societies Section

| Field | Value |
|-------|-------|
| **Original ID** | D-100-003 |
| **Component** | Society Selector |
| **Element** | Target Societies |
| **Issue** | Missing section entirely |
| **Type** | layout |
| **Reference** | "Target Societies" header with society cards (Zurich Founders, Startup Investors) |
| **Current** | Simple dropdown list |
| **Fix Hint** | Implement card grid with Create Target Society button |
| **File Path** | `src/components/society-selector/` |

### D-029: Test Type Selector - Modal Not Appearing

| Field | Value |
|-------|-------|
| **Original ID** | D-100-017 |
| **Component** | Test Type Selector |
| **Element** | Modal Container |
| **Issue** | Modal not appearing when triggered |
| **Type** | layout |
| **Reference** | Centered modal with "What would you like to simulate?" title |
| **Current** | No modal visible - just dashboard |
| **Fix Hint** | Verify test type modal opens on "Create a new test" click |
| **File Path** | `src/components/test-type-selector/` |

### D-030: Test Type Selector - Missing Grid Layout

| Field | Value |
|-------|-------|
| **Original ID** | D-100-018 |
| **Component** | Test Type Selector |
| **Element** | Grid Layout |
| **Issue** | Option grid missing entirely |
| **Type** | layout |
| **Reference** | 3-column grid of test type options (Survey, TikTok, Article, etc.) |
| **Current** | Not visible |
| **Fix Hint** | Implement grid layout with test type cards |
| **File Path** | `src/components/test-type-selector/` |

### D-032: TikTok Form - Form Not Visible

| Field | Value |
|-------|-------|
| **Original ID** | D-100-020 |
| **Component** | TikTok Form |
| **Element** | Form Container |
| **Issue** | Form not visible after navigation |
| **Type** | layout |
| **Reference** | Form panel visible with "Write your script..." placeholder |
| **Current** | No form visible - dashboard only |
| **Fix Hint** | Verify form panel opens after test type selection |
| **File Path** | `src/components/test-forms/tiktok-form.tsx` |

### D-035: Survey Form - Form Not Visible

| Field | Value |
|-------|-------|
| **Original ID** | D-100-023 |
| **Component** | Survey Form |
| **Element** | Form Container |
| **Issue** | Form not visible after navigation |
| **Type** | layout |
| **Reference** | Survey form with question input, options, add choice button |
| **Current** | No form visible - dashboard only |
| **Fix Hint** | Verify survey form opens after test type selection |
| **File Path** | `src/components/test-forms/survey-form.tsx` |

---

## Major Issues (18)

These issues are visibly noticeable and affect brand consistency.

### Dashboard & Navigation (Plan 01)

| ID | Component | Element | Issue | Type | File Path |
|----|-----------|---------|-------|------|-----------|
| D-003 | Sidebar | background-color | Background color mismatch (#1a1a1a vs #0f0f10) | color | `src/components/app/sidebar.tsx` |
| D-004 | Sidebar | section-label-style | "CURRENT SOCIETY" label styling differs | typography | `src/components/app/sidebar.tsx` |
| D-005 | Sidebar | society-dropdown | Dropdown styling differs | color | `src/components/app/sidebar.tsx` |
| D-008 | Sidebar | nav-items-list | Different nav items (Settings vs What's new) | layout | `src/components/app/sidebar.tsx` |
| D-009 | Context Bar | pill-background | Filter pill background differs | color | `src/components/app/context-bar.tsx` |
| D-013 | Header | create-test-button | "Create a new test" button position/style | layout | `src/components/app/app-header.tsx` |
| D-017 | Sidebar | version-label | Version label positioning (visible vs hidden) | layout | `src/components/app/sidebar.tsx` |
| D-018 | Sidebar | logo-icon | Logo styling differs ("N" vs "A") | typography | `src/components/app/sidebar.tsx` |

### Forms & Selectors (Plan 02)

| ID | Component | Element | Issue | Type | File Path |
|----|-----------|---------|-------|------|-----------|
| D-022 | Society Selector | Background | Overlay missing on modal | color | `src/components/ui/dialog.tsx` |
| D-023 | Society Selector | Card Layout | Card styling missing | spacing | `src/components/society-selector/` |
| D-025 | Society Card | Hover State | No hover interaction on cards | animation | `src/components/society-selector/society-card.tsx` |
| D-027 | Society Card | Three-dot Menu | Menu trigger missing | layout | `src/components/society-selector/society-card.tsx` |
| D-028 | Society Card | Menu Items | Context menu missing | layout | `src/components/ui/dropdown-menu.tsx` |
| D-031 | Test Type Selector | Category Headers | Section headers missing | typography | `src/components/test-type-selector/` |
| D-033 | TikTok Form | Action Buttons | Bottom toolbar missing | layout | `src/components/test-forms/tiktok-form.tsx` |
| D-034 | TikTok Form | Content Display | Content not showing in form | layout | `src/components/test-forms/tiktok-form.tsx` |

---

## Minor Issues (19)

These are subtle differences (1-2px, slight color variations) that don't significantly impact UX.

### Dashboard & Navigation (Plan 01)

| ID | Component | Element | Issue | Type | File Path |
|----|-----------|---------|-------|------|-----------|
| D-006 | Sidebar | nav-item-padding | Navigation item spacing differs | spacing | `src/components/app/sidebar.tsx` |
| D-007 | Sidebar | nav-item-icons | Icon size/weight differs | typography | `src/components/app/sidebar.tsx` |
| D-010 | Context Bar | pill-text-color | Pill text color differs | color | `src/components/app/context-bar.tsx` |
| D-011 | Context Bar | colored-dot-size | Colored indicator dots in pills | spacing | `src/components/app/context-bar.tsx` |
| D-012 | Context Bar | pill-border-radius | Border radius differs | spacing | `src/components/app/context-bar.tsx` |
| D-014 | Network Viz | background-color | Main area background differs | color | `src/components/app/network-visualization.tsx` |
| D-015 | Network Viz | dot-colors | Dot color palette differs slightly | color | `src/components/app/network-visualization.tsx` |
| D-016 | Network Viz | dot-sizes | Dot size variation differs | spacing | `src/components/app/network-visualization.tsx` |

### Forms & Selectors (Plan 02)

| ID | Component | Element | Issue | Type | File Path |
|----|-----------|---------|-------|------|-----------|
| D-024 | Society Selector | Setup Badge | Orange badge missing on personal society cards | color | `src/components/ui/badge.tsx` |
| D-026 | Society Card | Badge Labels | "Custom"/"Example" badges missing | layout | `src/components/society-selector/society-card.tsx` |

### Modals & Results (Plan 03)

| ID | Component | Element | Issue | Type | File Path |
|----|-----------|---------|-------|------|-----------|
| D-036 | Modal | backdrop | Background styling differs (purple gradient vs black dots) | color | `src/components/app/create-society-modal.tsx` |
| D-037 | Modal | animation | Modal overlay animation timing (instant vs 200ms fade) | animation | `src/components/app/create-society-modal.tsx` |
| D-038 | Modal | submit-button | Submit button styling (outline vs solid) | color | `src/components/app/leave-feedback-modal.tsx` |
| D-039 | Results Panel | header | "Simulation Results" title font weight | typography | `src/components/app/simulation/results-panel.tsx` |
| D-040 | Results Panel | impact-score | Impact Score font size (48px vs 64px) | typography | `src/components/app/simulation/impact-score.tsx` |
| D-041 | Results Panel | variant-score | Variant score number alignment/size | typography | `src/components/app/simulation/variants-section.tsx` |
| D-042 | Results Panel | accordion | Accordion expand/collapse behavior | layout | `src/components/app/simulation/results-panel.tsx` |
| D-043 | Results Panel | variant-descriptions | Variant card description truncation | typography | `src/components/app/simulation/variants-section.tsx` |
| D-044 | Results Panel | section-dividers | Dividers between sections spacing | spacing | `src/components/app/simulation/results-panel.tsx` |

---

## Component Impact Summary

### High Priority Components

| Component | File Path | Critical | Major | Minor | Total |
|-----------|-----------|----------|-------|-------|-------|
| Network Visualization | `src/components/app/network-visualization.tsx` | 2 | 0 | 4 | 6 |
| Society Selector | `src/components/society-selector/` | 3 | 3 | 2 | 8 |
| Test Type Selector | `src/components/test-type-selector/` | 2 | 1 | 0 | 3 |
| TikTok Form | `src/components/test-forms/tiktok-form.tsx` | 1 | 2 | 0 | 3 |
| Sidebar | `src/components/app/sidebar.tsx` | 0 | 6 | 2 | 8 |

### Medium Priority Components

| Component | File Path | Critical | Major | Minor | Total |
|-----------|-----------|----------|-------|-------|-------|
| Context Bar | `src/components/app/context-bar.tsx` | 0 | 1 | 4 | 5 |
| Society Card | `src/components/society-selector/society-card.tsx` | 0 | 3 | 1 | 4 |
| Results Panel | `src/components/app/simulation/results-panel.tsx` | 0 | 0 | 4 | 4 |

### Low Priority Components

| Component | File Path | Critical | Major | Minor | Total |
|-----------|-----------|----------|-------|-------|-------|
| Survey Form | `src/components/test-forms/survey-form.tsx` | 1 | 0 | 0 | 1 |
| Header | `src/components/app/app-header.tsx` | 0 | 1 | 0 | 1 |
| Create Society Modal | `src/components/app/create-society-modal.tsx` | 0 | 0 | 2 | 2 |
| Leave Feedback Modal | `src/components/app/leave-feedback-modal.tsx` | 0 | 0 | 1 | 1 |
| Impact Score | `src/components/app/simulation/impact-score.tsx` | 0 | 0 | 1 | 1 |
| Variants Section | `src/components/app/simulation/variants-section.tsx` | 0 | 0 | 2 | 2 |

---

## Recommended Fix Order for Phase 13

### Wave 1: Critical Functionality (8 issues)

1. **Network Visualization (D-001, D-002)** - Core visual element
2. **Society Selector (D-019, D-020, D-021)** - Major architectural rework
3. **Test Type Selector (D-029, D-030)** - Enables form testing
4. **Form Visibility (D-032, D-035)** - Unblocks form refinement

### Wave 2: Major Visual Issues (18 issues)

1. **Sidebar styling (D-003, D-004, D-005, D-008, D-017, D-018)** - 6 issues
2. **Society Card interactions (D-025, D-027, D-028)** - 3 issues
3. **Context Bar pills (D-009)** - 1 issue
4. **Test Type headers (D-031)** - 1 issue
5. **Form components (D-022, D-023, D-033, D-034)** - 4 issues
6. **Header button (D-013)** - 1 issue

### Wave 3: Minor Polish (19 issues)

All minor issues can be addressed in a final polish pass focusing on:
- Typography adjustments (font sizes, weights)
- Spacing refinements (padding, margins, dot sizes)
- Color fine-tuning (backgrounds, borders)
- Animation timing

---

## Architectural Notes

### Society Selector Requires Rework

The reference implementation uses a full modal pattern with:
- Personal Societies section (OAuth setup cards for LinkedIn/X)
- Target Societies section (custom society cards with menu)
- Create Target Society button

Virtuna currently uses a simple dropdown. This requires:
1. New Dialog/Modal component
2. Personal Societies integration (OAuth flow)
3. Target Societies grid layout
4. Society card component with hover/menu states

### Test Type Selector Investigation Needed

The Playwright captures didn't trigger the test type modal. Possible causes:
1. Modal not implemented
2. Click selectors don't match UI elements
3. State management prevents display

**Recommendation:** Manual verification of test creation flow before Phase 13.

---

## Source Reports

- Plan 01: `.planning/phases/12-comparison/discrepancies/dashboard-navigation.md`
- Plan 02: `.planning/phases/12-comparison/discrepancies/forms-selectors.md`
- Plan 03: `.planning/phases/12-comparison/discrepancies/modals-results.md`
