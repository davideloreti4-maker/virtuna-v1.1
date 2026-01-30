# Phase 12 v2 - Resume Context

**Created:** 2026-01-31
**Purpose:** Context handoff for fresh session

## What We're Doing

**Phase 12: Comparison v2** — Exhaustive visual comparison using Playwright + v0 MCP for 99% clone accuracy.

## Key Decisions (from 12-CONTEXT-v2.md)

### Capture
- All app routes, every interactive state
- Desktop 1440x900 only
- Component-level close-ups

### v0 MCP Usage
- Side-by-side image analysis for EVERY comparison
- Comprehensive analysis (colors hex, spacing px, typography, layout, shadows, borders)
- Structured JSON output with CSS fix suggestions
- **CRITICAL:** v0 MCP must be used for every single comparison

### Documentation
- Pixel-perfect specs (exact values)
- Annotated screenshots with highlighted differences
- Organized by component (SIDEBAR-001, FORM-001, etc.)

### Element Tracking
- Additions (Virtuna-only elements): Flag for removal
- Missing (Societies-only elements): Flag as critical

### Workflow
- Live capture + immediate v0 comparison
- Sequential single agent
- Use existing Phase 11 reference screenshots

## Reference Screenshots Location

```
extraction/screenshots/
├── ref-01-society-selector-*.png (3 files)
├── ref-02-dashboard-*.png (3 files)
├── ref-03-test-type-selector*.png (2 files)
├── ref-04-tiktok-form.png
├── ref-05-view-selector-dropdown.png
├── ref-06-feedback-modal.png
├── ref-07-create-society-modal.png
├── ref-08-mobile-dashboard.png
└── desktop-fullpage/
    ├── dashboard/01-dashboard-default.png
    ├── forms/01-tiktok-form-empty.png, 02-filled.png, 03-survey.png
    ├── modals/01-create-society.png, 02-leave-feedback.png
    ├── results/01-results-panel.png, 02-insights.png
    └── selectors/02-society-open.png, 03-hover.png, 04-menu.png, 05-view.png, 06-role.png, 08-test-type.png
```

Total: 210 reference screenshots

## v2 Output Directory

```
.planning/phases/12-comparison/v2/
├── screenshots/      # Virtuna captures
├── comparisons/      # v0 analysis JSON files
├── annotated/        # Difference-highlighted images
├── 12-CONTEXT-v2.md  # Decisions document
└── RESUME.md         # This file
```

## Next Steps After /clear

1. Start dev server: `npm run dev` (in background)
2. Load v0 MCP tool: `ToolSearch query: "select:mcp__v0__v0_generate_from_image"`
3. Load Playwright MCP: `ToolSearch query: "+playwright screenshot"`
4. Begin systematic comparison:
   - Start with dashboard (most visible)
   - Capture Virtuna screenshot via Playwright
   - Send both (Virtuna + reference) to v0 MCP
   - Document every difference in structured JSON
   - Continue through all components

## v0 MCP Prompt Template

```
Compare these two images pixel-by-pixel:
- Image 1: Reference (app.societies.io)
- Image 2: Clone (Virtuna localhost)

List EVERY visual difference in JSON format:
{
  "component": "sidebar",
  "differences": [
    {
      "id": "SIDEBAR-001",
      "element": "background",
      "type": "color",
      "severity": "major",
      "reference": "#0f0f10",
      "current": "#1a1a1a",
      "fix": "Change bg-[#1a1a1a] to bg-[#0f0f10] in sidebar.tsx"
    }
  ]
}

Analyze: colors (hex), spacing (px), typography (font/size/weight), layout, shadows, borders, animations.
Flag missing elements as critical. Flag extra elements for removal.
```

## Component Comparison Order

1. **Dashboard** - ref-02-dashboard-complete.png
2. **Sidebar** - crop from dashboard
3. **Network Visualization** - crop from dashboard
4. **Society Selector** - ref-01-society-selector-modal.png
5. **View Selector** - ref-05-view-selector-dropdown.png
6. **Test Type Selector** - ref-03-test-type-selector.png
7. **TikTok Form** - ref-04-tiktok-form.png
8. **Survey Form** - desktop-fullpage/forms/03-survey-form-empty.png
9. **Results Panel** - desktop-fullpage/results/01-results-panel.png
10. **Create Society Modal** - ref-07-create-society-modal.png
11. **Leave Feedback Modal** - ref-06-feedback-modal.png
12. **Settings** - need to capture reference

---

**Ready to execute after /clear**
