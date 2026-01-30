# Forms & Selectors Discrepancies

**Plan:** 12-02
**Date:** 2026-01-30
**Comparison:** app.societies.io (reference) vs Virtuna (localhost:3000)

## Summary

- **Total discrepancies:** 23
- **Critical:** 6 | **Major:** 10 | **Minor:** 7

---

## Society Selector

**Reference:** `extraction/screenshots/desktop-fullpage/selectors/02-society-selector-open.png`
**Virtuna:** `.planning/phases/12-comparison/virtuna-screenshots/selectors/02-society-selector-open.png`

| ID | Component | Element | Issue | Type | Severity | Reference | Current | Fix Hint | File Path | Status |
|----|-----------|---------|-------|------|----------|-----------|---------|----------|-----------|--------|
| D-100-001 | Society Selector | Container | Full modal vs dropdown | layout | Critical | Full-page centered modal with overlay | Simple dropdown in sidebar | Implement Dialog component with centered modal layout | `src/components/society-selector/` | Open |
| D-100-002 | Society Selector | Personal Societies | Missing section | layout | Critical | "Personal Societies" header with LinkedIn/X cards showing "Setup" badges | Not implemented | Add personal societies section with OAuth setup cards | `src/components/society-selector/` | Open |
| D-100-003 | Society Selector | Target Societies | Missing section | layout | Critical | "Target Societies" header with society cards (Zurich Founders, Startup Investors) | Simple dropdown list | Implement card grid with Create Target Society button | `src/components/society-selector/` | Open |
| D-100-004 | Society Selector | Background | Overlay missing | color | Major | Dark overlay on background with network graph dimmed | No overlay, graph fully visible | Add bg-black/60 backdrop with DialogOverlay | `src/components/ui/dialog.tsx` | Open |
| D-100-005 | Society Selector | Card Layout | Card styling missing | spacing | Major | Cards with border, rounded corners, icon, title, description | Simple text list items | Implement card component with icon, title, desc layout | `src/components/society-selector/` | Open |
| D-100-006 | Society Selector | Setup Badge | Orange badge missing | color | Minor | Orange "Setup" badge pill on personal society cards | Not implemented | Add Badge component with bg-orange-500 rounded-full | `src/components/ui/badge.tsx` | Open |

---

## Society Card Hover

**Reference:** `extraction/screenshots/desktop-fullpage/selectors/03-society-card-hover.png`
**Virtuna:** `.planning/phases/12-comparison/virtuna-screenshots/selectors/03-society-card-hover.png`

| ID | Component | Element | Issue | Type | Severity | Reference | Current | Fix Hint | File Path | Status |
|----|-----------|---------|-------|------|----------|-----------|---------|----------|-----------|--------|
| D-100-007 | Society Card | Hover State | No hover interaction | animation | Major | Card has subtle border highlight on hover | No cards exist to hover | Implement hover:border-orange-500/50 transition | `src/components/society-selector/society-card.tsx` | Open |
| D-100-008 | Society Card | Badge Labels | "Custom"/"Example" badges missing | layout | Minor | Badge labels (Custom, Example) in top-left corner | Not implemented | Add conditional badge based on society.type | `src/components/society-selector/society-card.tsx` | Open |

---

## Society Card Menu

**Reference:** `extraction/screenshots/desktop-fullpage/selectors/04-society-card-menu.png`
**Virtuna:** `.planning/phases/12-comparison/virtuna-screenshots/selectors/04-society-card-menu.png`

| ID | Component | Element | Issue | Type | Severity | Reference | Current | Fix Hint | File Path | Status |
|----|-----------|---------|-------|------|----------|-----------|---------|----------|-----------|--------|
| D-100-009 | Society Card | Three-dot Menu | Menu trigger missing | layout | Major | Three-dot vertical icon in top-right of card | Not implemented | Add DropdownMenu with MoreVertical icon | `src/components/society-selector/society-card.tsx` | Open |
| D-100-010 | Society Card | Menu Items | Context menu missing | layout | Major | Dropdown with Edit, Duplicate, Delete options | Not implemented | Implement DropdownMenuContent with action items | `src/components/ui/dropdown-menu.tsx` | Open |

---

## View Selector

**Reference:** `extraction/screenshots/desktop-fullpage/selectors/05-view-selector-open.png`
**Virtuna:** `.planning/phases/12-comparison/virtuna-screenshots/selectors/05-view-selector-open.png`

| ID | Component | Element | Issue | Type | Severity | Reference | Current | Fix Hint | File Path | Status |
|----|-----------|---------|-------|------|----------|-----------|---------|----------|-----------|--------|
| D-100-011 | View Selector | Dropdown Position | Correct positioning | layout | Minor | Dropdown appears below trigger | Similar positioning | Verified working | `src/components/view-selector/` | OK |
| D-100-012 | View Selector | Menu Items | Options present | layout | Minor | Country, City, Generation, Role Level, Sector, Role Area | Same options visible | Verified working | `src/components/view-selector/` | OK |
| D-100-013 | View Selector | Check Icon | Selected indicator | spacing | Minor | Checkmark icon on selected item (Country) | Checkmark visible on Country | Verified working | `src/components/view-selector/` | OK |
| D-100-014 | View Selector | Color Dots | Role Level dots | color | Minor | Colored dots (blue, pink, green, orange) next to Role Level | Dots visible on Role Level item | Verify dot colors match exactly | `src/components/view-selector/` | Verify |
| D-100-015 | View Selector | Add Button | Plus icon position | spacing | Minor | Plus (+) icon for adding views | Plus icon visible in header | Verify icon alignment | `src/components/view-selector/` | OK |

---

## View Role Level

**Reference:** `extraction/screenshots/desktop-fullpage/selectors/06-view-role-level.png`
**Virtuna:** `.planning/phases/12-comparison/virtuna-screenshots/selectors/06-view-role-level.png`

| ID | Component | Element | Issue | Type | Severity | Reference | Current | Fix Hint | File Path | Status |
|----|-----------|---------|-------|------|----------|-----------|---------|----------|-----------|--------|
| D-100-016 | View Selector | Role Level Selected | State maintained | layout | Minor | View selector shows dropdown still open after selection | Dropdown still open showing options | May need to close on selection | `src/components/view-selector/` | Verify |

---

## Test Type Selector

**Reference:** `extraction/screenshots/desktop-fullpage/selectors/08-test-type-selector.png`
**Virtuna:** `.planning/phases/12-comparison/virtuna-screenshots/selectors/08-test-type-selector.png`

| ID | Component | Element | Issue | Type | Severity | Reference | Current | Fix Hint | File Path | Status |
|----|-----------|---------|-------|------|----------|-----------|---------|----------|-----------|--------|
| D-100-017 | Test Type Selector | Modal Container | Modal not appearing | layout | Critical | Centered modal with "What would you like to simulate?" title | No modal visible - just dashboard | Verify test type modal opens on "Create a new test" click | `src/components/test-type-selector/` | Open |
| D-100-018 | Test Type Selector | Grid Layout | Option grid missing | layout | Critical | 3-column grid of test type options (Survey, TikTok, Article, etc.) | Not visible | Implement grid layout with test type cards | `src/components/test-type-selector/` | Open |
| D-100-019 | Test Type Selector | Category Headers | Section headers missing | typography | Major | "SOCIAL MEDIA POSTS", "COMMUNICATION" section headers | Not visible | Add text-xs text-muted-foreground category labels | `src/components/test-type-selector/` | Open |

---

## TikTok Form (Empty)

**Reference:** `extraction/screenshots/desktop-fullpage/forms/01-tiktok-form-empty.png`
**Virtuna:** `.planning/phases/12-comparison/virtuna-screenshots/forms/01-tiktok-form-empty.png`

| ID | Component | Element | Issue | Type | Severity | Reference | Current | Fix Hint | File Path | Status |
|----|-----------|---------|-------|------|----------|-----------|---------|----------|-----------|--------|
| D-100-020 | TikTok Form | Form Container | Form not visible | layout | Critical | Form panel visible with "Write your script..." placeholder | No form visible - dashboard only | Verify form panel opens after test type selection | `src/components/test-forms/tiktok-form.tsx` | Open |
| D-100-021 | TikTok Form | Action Buttons | Bottom toolbar missing | layout | Major | "TikTok Script", "Upload Images", "Help Me Edit", "Simulate" buttons | Not visible | Implement form footer with action buttons | `src/components/test-forms/tiktok-form.tsx` | Open |

---

## TikTok Form (Filled)

**Reference:** `extraction/screenshots/desktop-fullpage/forms/02-tiktok-form-filled.png`
**Virtuna:** `.planning/phases/12-comparison/virtuna-screenshots/forms/02-tiktok-form-filled.png`

| ID | Component | Element | Issue | Type | Severity | Reference | Current | Fix Hint | File Path | Status |
|----|-----------|---------|-------|------|----------|-----------|---------|----------|-----------|--------|
| D-100-022 | TikTok Form | Content Display | Content not showing | layout | Major | Form shows script content in textarea | Form not visible | Verify form receives and displays input | `src/components/test-forms/tiktok-form.tsx` | Open |

---

## Survey Form

**Reference:** `extraction/screenshots/desktop-fullpage/forms/03-survey-form-empty.png`
**Virtuna:** `.planning/phases/12-comparison/virtuna-screenshots/forms/03-survey-form-empty.png`

| ID | Component | Element | Issue | Type | Severity | Reference | Current | Fix Hint | File Path | Status |
|----|-----------|---------|-------|------|----------|-----------|---------|----------|-----------|--------|
| D-100-023 | Survey Form | Form Container | Form not visible | layout | Critical | Survey form with question input, options, add choice button | No form visible - dashboard only | Verify survey form opens after test type selection | `src/components/test-forms/survey-form.tsx` | Open |

---

## Analysis Notes

### Critical Issues (6)
The most significant discrepancies are in the **Society Selector** and **Test Type Selector** components:

1. **Society Selector Architecture (D-100-001 to D-100-003):** The reference uses a full modal pattern with distinct sections for Personal Societies (OAuth setup) and Target Societies (custom/example societies). Virtuna currently implements a simple dropdown. This requires significant architectural work.

2. **Test Type Selector (D-100-017, D-100-018):** The reference shows a centered modal grid for selecting test types. The Virtuna capture suggests this modal may not be implemented or not triggering correctly.

3. **Form Panels (D-100-020, D-100-023):** Forms are not appearing in Virtuna captures. This could be a navigation/state issue where forms don't open after test type selection.

### Working Components
The **View Selector** (D-100-011 to D-100-016) appears to be well-implemented with correct:
- Dropdown positioning
- Menu items and options
- Selected state indication (checkmark)
- Role Level color dots

### Recommended Priority
1. Fix test type selector modal to enable form testing
2. Implement society selector modal with full architecture
3. Add missing card hover/menu interactions
4. Fine-tune styling discrepancies (badges, colors, spacing)

---

## Screenshot Capture Notes

The Virtuna screenshots show that clicking "Create a new test" button and test type options did not successfully navigate to the form views. This suggests either:
1. The test type selector modal is not implemented
2. The click selectors in the test script didn't match the actual UI elements
3. State management prevents form display

**Recommendation:** Manually verify the test creation flow in Virtuna and update selectors in the capture script accordingly.
