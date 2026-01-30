# Phase 13 Execution Resume

> Created: 2026-01-30
> Purpose: Context restoration after /clear

## CRITICAL EXECUTION RULES

1. **NO SUBAGENTS** - Execute all plans directly, not via Task tool
2. **MANDATORY v0 MCP** - Every component fix must use v0_generate_from_image or v0_chat_complete
3. **Visual verification** - Compare each fix against reference screenshots
4. **Atomic commits** - One commit per discrepancy fixed

## v0 MCP Tools (Load First!)

Before using v0 MCP, run:
```
ToolSearch query="v0 generate" max_results=5
```

Then use:
- `mcp__v0__v0_generate_from_image` - Generate from screenshot
- `mcp__v0__v0_chat_complete` - Iterate/refine code

## Reference Screenshots

**Location:** `extraction/screenshots/desktop-fullpage/`

| Screenshot | Use For |
|------------|---------|
| `dashboard/01-dashboard-default.png` | Network viz, sidebar, context bar, header |
| `selectors/02-society-selector-open.png` | Society selector modal |
| `selectors/08-test-type-selector.png` | Test type selector |
| `forms/01-tiktok-form-empty.png` | TikTok form |
| `modals/01-create-society-modal.png` | Create society modal |

## 45 Discrepancies to Fix

### Wave 1: Critical (8 issues)

| ID | Component | Issue | File |
|----|-----------|-------|------|
| D-001 | Network Viz | Missing connection lines | network-visualization.tsx |
| D-002 | Network Viz | Wrong dot clustering | network-visualization.tsx |
| D-019 | Society Selector | Full modal vs dropdown | society-selector/ |
| D-020 | Society Selector | Missing Personal Societies section | society-selector/ |
| D-021 | Society Selector | Missing Target Societies section | society-selector/ |
| D-029 | Test Type Selector | Modal not appearing | test-type-selector/ |
| D-030 | Test Type Selector | Missing grid layout | test-type-selector/ |
| D-032 | TikTok Form | Form not visible | tiktok-form.tsx |
| D-035 | Survey Form | Form not visible | survey-form.tsx |

### Wave 2: Major (18 issues)

| ID | Component | Issue | File |
|----|-----------|-------|------|
| D-003 | Sidebar | Background color (#1a1a1a vs #0f0f10) | sidebar.tsx |
| D-004 | Sidebar | Section label styling | sidebar.tsx |
| D-005 | Sidebar | Dropdown styling | sidebar.tsx |
| D-008 | Sidebar | Nav items (Settings vs What's new) | sidebar.tsx |
| D-009 | Context Bar | Pill background | context-bar.tsx |
| D-013 | Header | Create button position/style | app-header.tsx |
| D-017 | Sidebar | Version label | sidebar.tsx |
| D-018 | Sidebar | Logo styling | sidebar.tsx |
| D-022 | Society Selector | Overlay missing | dialog.tsx |
| D-023 | Society Selector | Card layout | society-selector/ |
| D-025 | Society Card | Hover state | society-card.tsx |
| D-027 | Society Card | Three-dot menu | society-card.tsx |
| D-028 | Society Card | Context menu | dropdown-menu.tsx |
| D-031 | Test Type Selector | Category headers | test-type-selector/ |
| D-033 | TikTok Form | Action buttons | tiktok-form.tsx |
| D-034 | TikTok Form | Content display | tiktok-form.tsx |

### Wave 3: Minor (19 issues)

| ID | Component | Issue |
|----|-----------|-------|
| D-006 | Sidebar | Nav item padding |
| D-007 | Sidebar | Icon size/weight |
| D-010 | Context Bar | Pill text color |
| D-011 | Context Bar | Colored dot size |
| D-012 | Context Bar | Border radius |
| D-014 | Network Viz | Background color |
| D-015 | Network Viz | Dot colors |
| D-016 | Network Viz | Dot sizes |
| D-024 | Society Selector | Setup badge |
| D-026 | Society Card | Badge labels |
| D-036 | Modal | Backdrop styling |
| D-037 | Modal | Animation timing |
| D-038 | Modal | Submit button |
| D-039 | Results Panel | Header font weight |
| D-040 | Results Panel | Impact score size |
| D-041 | Results Panel | Variant score alignment |
| D-042 | Results Panel | Accordion behavior |
| D-043 | Results Panel | Description truncation |
| D-044 | Results Panel | Section dividers |

## Execution Workflow

For each discrepancy:

1. **Read reference screenshot**
   ```
   Read file_path="extraction/screenshots/desktop-fullpage/{category}/{file}.png"
   ```

2. **Generate fix with v0 MCP**
   ```
   mcp__v0__v0_generate_from_image
     imageUrl: file:///Users/davideloreti/virtuna-v1.1/extraction/screenshots/...
     model: v0-1.5-md (or v0-1.5-lg for complex)
     prompt: "Generate {component} matching this screenshot. Fix: {issue description}"
   ```

3. **Apply code changes**
   - Read current file
   - Edit with v0's generated code
   - Preserve existing functionality

4. **Visual verification**
   - npm run dev
   - Compare localhost:3000 with reference
   - Screenshot if needed

5. **Commit**
   ```
   git add {file}
   git commit -m "fix(13): {D-XXX} {brief description}"
   ```

## Start Command

After /clear, run:
```
/gsd:execute-phase 13
```

Or manually start with:
```
Read .planning/phases/13-refinement/RESUME.md
ToolSearch query="v0 generate" max_results=5
```

Then begin with D-001 (Network Visualization connection lines).

## Key Files

- Discrepancy Report: `.planning/phases/12-comparison/DISCREPANCY-REPORT.md`
- JSON Export: `.planning/phases/12-comparison/DISCREPANCIES.json`
- State: `.planning/STATE.md`
- Roadmap: `.planning/ROADMAP.md`
