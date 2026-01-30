# Phase 12: Comparison — Preparation Document

**Phase Goal:** Document every visual discrepancy between Virtuna and app.societies.io with v0 MCP-powered analysis

---

## Reference Screenshots Available

Location: `extraction/screenshots/`

### Organized Desktop (28 files)
```
desktop/
├── dashboard/       (4 files) - Default, loading, network states
├── forms/           (3 files) - TikTok empty/filled, Survey
├── history/         (2 files) - Empty, with items
├── modals/          (2 files) - Create society, Feedback
├── navigation/      (1 file)  - Sidebar
├── results/         (5 files) - Panel, insights, variants, editing
├── selectors/       (11 files) - Society, view, test type
└── settings/        (1 file)  - Default
```

### Raw Reference (132 files)
All form types, simulation states, detailed UI captures in `reference/`

---

## Comparison Methodology

For each screen/component:

### Step 1: Capture Virtuna Screenshot
```bash
# Navigate to same state in Virtuna clone
# Capture at same viewport (1440x900)
```

### Step 2: v0 MCP Analysis
Use v0 MCP tool with prompt:
```
Analyze these two screenshots. The first is the reference (app.societies.io),
the second is our clone (Virtuna).

List EVERY visual difference:
- Spacing (padding, margins, gaps)
- Colors (backgrounds, text, borders, shadows)
- Typography (font size, weight, line height, letter spacing)
- Layout (alignment, positioning, dimensions)
- Borders and shadows
- Icons and images
- Animation states (if visible)

For each difference, specify:
1. Element/area affected
2. Reference value (estimated)
3. Clone value (estimated)
4. Priority: critical/major/minor
```

### Step 3: Document in Discrepancy Report
Create structured report with:
- Screenshot pair
- v0 analysis
- Manual verification notes
- Categorized issues

---

## Screens to Compare

### Priority 1: Core Layout
| Screen | Reference File | Virtuna Route | Priority |
|--------|---------------|---------------|----------|
| Dashboard | `desktop/dashboard/01-dashboard-default.png` | `/app` | Critical |
| Sidebar | `desktop/navigation/sidebar-default.png` | `/app` | Critical |
| Network Viz | `desktop/dashboard/network-default.png` | `/app` | Major |

### Priority 2: Selectors
| Screen | Reference File | Virtuna Route | Priority |
|--------|---------------|---------------|----------|
| Society Selector | `desktop/selectors/02-society-selector-open.png` | Click selector | Critical |
| View Selector | `desktop/selectors/05-view-selector-open.png` | Click selector | Major |
| Test Type Selector | `desktop/selectors/08-test-type-selector.png` | Click "Create" | Critical |

### Priority 3: Forms
| Screen | Reference File | Virtuna Route | Priority |
|--------|---------------|---------------|----------|
| TikTok Form | `desktop/forms/01-tiktok-form-empty.png` | Select TikTok | Major |
| Survey Form | `desktop/forms/03-survey-form-empty.png` | Select Survey | Major |

### Priority 4: Results
| Screen | Reference File | Virtuna Route | Priority |
|--------|---------------|---------------|----------|
| Results Panel | `desktop/results/01-results-panel.png` | Run simulation | Critical |
| Variants | `desktop/results/04-variant-editing.png` | Click variant | Major |

### Priority 5: Modals
| Screen | Reference File | Virtuna Route | Priority |
|--------|---------------|---------------|----------|
| Create Society | `desktop/modals/01-create-society-modal.png` | Click "Create Target" | Major |
| Feedback | `desktop/modals/02-leave-feedback-modal.png` | Click "Leave Feedback" | Minor |

---

## Expected Deliverables

### Per Comparison
1. Side-by-side image (reference | clone)
2. v0 analysis output
3. Discrepancy list with priorities

### Phase Output
1. `12-COMPARISON-REPORT.md` - Full discrepancy catalog
2. `DISCREPANCIES.json` - Structured data for Phase 13
3. Screenshot pairs in `comparison/` folder

---

## Discrepancy Categories

| Category | Description | Example |
|----------|-------------|---------|
| `spacing` | Padding, margin, gap differences | "Card padding 16px vs 20px" |
| `color` | Color value differences | "Border #333 vs #444" |
| `typography` | Font size, weight, line height | "Title 18px vs 16px" |
| `layout` | Position, alignment, dimensions | "Button width 100% vs auto" |
| `border` | Border width, radius, style | "Radius 8px vs 12px" |
| `shadow` | Box shadow differences | "Shadow missing" |
| `animation` | Transition, timing differences | "Hover transition 200ms vs 300ms" |

---

## Priority Definitions

| Priority | Description | Action |
|----------|-------------|--------|
| **Critical** | Layout breaks, major visual mismatch | Must fix in Phase 13 |
| **Major** | Clearly visible difference | Should fix in Phase 13 |
| **Minor** | Subtle spacing/color | Fix if time permits |

---

## Tools Required

1. **Playwright MCP** - Capture Virtuna screenshots
2. **v0 MCP** - AI-powered visual comparison
3. **Read/Write tools** - Document findings

---

## Success Criteria

- [ ] All 15+ screens compared
- [ ] v0 analysis for each comparison
- [ ] Discrepancies categorized (spacing/color/typography/layout/animation)
- [ ] Discrepancies prioritized (critical/major/minor)
- [ ] Structured report ready for Phase 13

---

*Prepared: 2026-01-30*
