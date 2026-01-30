# Phase 12: Comparison - Research

**Researched:** 2026-01-30
**Domain:** Visual comparison, AI-powered image analysis, discrepancy documentation
**Confidence:** HIGH

## Summary

This research investigates how to implement comprehensive visual comparison between Virtuna and app.societies.io using v0 MCP-powered analysis. The goal is to document every visual discrepancy across all screens/components to guide Phase 13 refinement work.

The methodology combines Playwright MCP for screenshot capture with v0 MCP's image analysis capabilities. v0's `v0_generate_from_image` tool analyzes screenshots and extracts detailed styling specifications (colors, typography, spacing, borders, shadows). By analyzing both reference and clone screenshots, we can systematically identify and document discrepancies.

**Critical finding:** Multimodal AI models (including Claude and v0) excel at describing individual images but have limitations with pixel-level diff detection between image pairs. The recommended approach is to analyze each screenshot independently with v0 to extract styling specs, then compare the outputs programmatically or manually rather than asking AI to directly spot differences.

**Primary recommendation:** Use v0 MCP to extract detailed styling specifications from each screenshot independently, then compare the outputs to identify discrepancies. Document findings in structured markdown tables with global IDs (D-001, D-002...) for Phase 13 traceability.

## Standard Stack

The established tools for this domain:

### Core
| Tool | Purpose | Why Standard |
|------|---------|--------------|
| v0 MCP (`v0_generate_from_image`) | Extract styling specs from screenshots | Project-standard for UI analysis, outputs detailed CSS/Tailwind specs |
| v0 MCP (`v0_chat_complete`) | Clarify specific styling questions | Iterative refinement when specs unclear |
| Playwright MCP (`browser_take_screenshot`) | Capture Virtuna screenshots | Already used in Phase 11 extraction |
| Read/Write tools | Document findings | Standard markdown documentation |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| Playwright (`browser_navigate`) | Navigate to screens | Required to reach each screen state |
| Playwright (`browser_click`) | Open modals/dropdowns | Required for interactive states |
| Glob | Find reference screenshots | Locate extracted files |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| v0 analysis | Pixelmatch/Playwright snapshot | Pixel diff tools catch everything but produce noise (anti-aliasing, minor variations); v0 provides semantic understanding |
| v0 analysis | Claude Vision directly | v0 is optimized for UI analysis and outputs Tailwind/CSS specs; Claude Vision is more general-purpose |
| Manual comparison | Automated visual regression | Manual ensures 98% accuracy goal; automated tools have false positive/negative issues |

## Architecture Patterns

### Recommended Folder Structure
```
.planning/phases/12-comparison/
├── 12-RESEARCH.md                    # This file
├── 12-CONTEXT.md                     # User decisions (exists)
├── PHASE-12-PREP.md                  # Preparation doc (exists)
├── 12-01-PLAN.md                     # Plan: navigation, sidebar, dashboard
├── 12-02-PLAN.md                     # Plan: forms, selectors, dropdowns
├── 12-03-PLAN.md                     # Plan: modals, settings, overlays
├── 12-04-PLAN.md                     # Plan: consolidation and prioritization
├── DISCREPANCY-REPORT.md             # Main consolidated report
└── virtuna-screenshots/              # Captured Virtuna screenshots
    ├── dashboard/
    ├── selectors/
    ├── forms/
    ├── modals/
    └── results/
```

### Pattern 1: Independent Image Analysis
**What:** Analyze reference and clone screenshots separately with v0, then compare outputs
**When to use:** Always - this is more reliable than asking AI to diff images directly
**Example:**
```
# Step 1: Analyze reference screenshot
mcp__v0__v0_generate_from_image:
  imageUrl: "file:///path/to/reference/dashboard.png"
  prompt: "Extract exact styling specs: colors (hex), font sizes (px), spacing (px), border radius, shadows. Focus on sidebar, network viz, and context bar."

# Step 2: Analyze Virtuna screenshot
mcp__v0__v0_generate_from_image:
  imageUrl: "file:///path/to/virtuna/dashboard.png"
  prompt: "Extract exact styling specs: colors (hex), font sizes (px), spacing (px), border radius, shadows. Focus on sidebar, network viz, and context bar."

# Step 3: Compare v0 outputs and document discrepancies
# Manual comparison of the two v0 outputs
```

### Pattern 2: Focused Region Analysis
**What:** Crop or focus v0 prompts on specific components when full-page analysis misses details
**When to use:** When discrepancies are subtle or full-page analysis is too broad
**Example:**
```
mcp__v0__v0_generate_from_image:
  imageUrl: "file:///path/to/reference/society-selector-open.png"
  prompt: "Analyze ONLY the society card component (not the entire modal). Extract:
  - Card background color (hex)
  - Border color and width
  - Padding (all sides)
  - Border radius
  - Icon size
  - Text sizes (title, description)
  - Hover state styling if visible"
```

### Pattern 3: Discrepancy Documentation Format
**What:** Structured table format with global IDs for traceability
**When to use:** For all documented discrepancies
**Example:**
```markdown
## Dashboard Discrepancies

| ID | Component | Element | Issue | Type | Severity | Reference | Current | Fix Hint | File Path | Status |
|----|-----------|---------|-------|------|----------|-----------|---------|----------|-----------|--------|
| D-001 | Sidebar | nav-item | Font size mismatch | typography | Major | 14px | 16px | text-sm | src/components/app/sidebar.tsx:42 | Open |
| D-002 | Sidebar | background | Color mismatch | color | Major | #0f0f10 | #171717 | bg-[#0f0f10] | src/components/app/sidebar.tsx:15 | Open |
```

### Pattern 4: v0 Chat for Clarification
**What:** Use v0_chat_complete for follow-up questions when analysis is unclear
**When to use:** When v0_generate_from_image output needs clarification
**Example:**
```
mcp__v0__v0_chat_complete:
  messages: [
    { role: "user", content: "The reference sidebar uses background #0f0f10. What Tailwind class gives this exact color? Current class is bg-zinc-900 which gives #18181b." }
  ]
```

### Anti-Patterns to Avoid
- **Asking AI to directly diff two images:** Multimodal LLMs struggle with pixel-level comparison. They may miss subtle differences or hallucinate non-existent ones.
- **Skipping v0 analysis for "obvious" screens:** Even matching screens should be documented to confirm accuracy.
- **Vague discrepancy descriptions:** "Colors look different" is not actionable. "Background #0f0f10 vs #171717" is.
- **Mixing analysis and fixing:** Phase 12 is analysis only. No code changes.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Screenshot capture | Manual browser screenshots | Playwright MCP | Consistent viewport, automated capture |
| Style extraction | Manual inspection | v0 MCP generate_from_image | AI extracts comprehensive specs |
| Color comparison | Visual inspection | Hex code comparison | Humans miss subtle color differences |
| Spacing measurement | Browser dev tools | v0 extracted specs | v0 outputs precise pixel values |

**Key insight:** v0 MCP provides semantic understanding of UI components, not just pixel values. It can identify "this is a navigation item with these properties" rather than just "there are pixels here."

## Common Pitfalls

### Pitfall 1: AI Image Diffing Limitations
**What goes wrong:** Asking multimodal AI to "find all differences between these two images" produces incomplete or inaccurate results
**Why it happens:** LLMs are trained for image understanding, not visual regression testing. They may miss anti-aliasing, subtle color shifts, or 1-2px spacing differences.
**How to avoid:** Analyze each image independently with v0, then compare the structured outputs. The comparison happens at the text/spec level, not image level.
**Warning signs:** v0 says "these images look identical" when they're not, or flags differences that don't exist

### Pitfall 2: Screenshot Inconsistency
**What goes wrong:** Virtuna screenshots don't match reference viewport/state
**Why it happens:** Different viewport size, different scroll position, different UI state (modal open vs closed)
**How to avoid:** Use exact same viewport (1440x900), same scroll position, same UI state. Reference screenshots are in `extraction/screenshots/desktop-fullpage/`
**Warning signs:** Comparison shows layout differences that are actually viewport differences

### Pitfall 3: Subjective Categorization
**What goes wrong:** "Is this critical or major?" becomes inconsistent across screens
**Why it happens:** Without clear criteria, severity assignment is subjective
**How to avoid:** Follow CONTEXT.md criteria exactly:
- **Critical:** Layout breaks, missing/extra elements
- **Major:** Color, spacing, typography, animation differences
- **Minor:** 1-2px differences on decorative elements only
**Warning signs:** Similar issues categorized differently across screens

### Pitfall 4: Missing Interactive States
**What goes wrong:** Only default states compared, missing hover/focus/open states
**Why it happens:** Interactive states require additional screenshot captures
**How to avoid:** Reference screenshots include open states (selector-open.png, card-hover.png). Capture matching states in Virtuna.
**Warning signs:** Discrepancies only discovered when user interacts

### Pitfall 5: Over-documenting Dynamic Content
**What goes wrong:** Documenting differences in mock data as discrepancies
**Why it happens:** Different sample text, different placeholder images
**How to avoid:** Focus on styling, not content. "Button says 'Submit' vs 'Send'" is not a discrepancy. "Button padding is 16px vs 12px" is.
**Warning signs:** Report filled with content differences that aren't styling issues

## Code Examples

### Capture Virtuna Screenshot
```typescript
// Using Playwright MCP to capture Virtuna dashboard
mcp__playwright__browser_navigate({ url: "http://localhost:3000/dashboard" });
mcp__playwright__browser_resize({ width: 1440, height: 900 });
mcp__playwright__browser_take_screenshot({
  filename: "virtuna-dashboard-default.png",
  fullPage: true,
  type: "png"
});
```

### Analyze Screenshot with v0
```typescript
// Extract styling specs from screenshot
mcp__v0__v0_generate_from_image({
  imageUrl: "file:///path/to/virtuna-dashboard-default.png",
  prompt: `Analyze this UI screenshot and extract EXACT styling specifications for:

  1. SIDEBAR (left panel):
     - Width (px)
     - Background color (hex)
     - Border styling
     - Navigation item padding, font-size, colors
     - Section label styling

  2. NETWORK VISUALIZATION (center):
     - Dot colors (hex values)
     - Dot sizes (px range)
     - Connection line styling

  3. CONTEXT BAR (bottom):
     - Pill styling (border, background, padding)
     - Text styling (size, weight, color)

  Output as a structured list with exact values.`
});
```

### Open Modal and Capture
```typescript
// Open society selector modal
mcp__playwright__browser_click({
  element: "society selector trigger button",
  ref: "[data-testid='society-selector-trigger']"
});

// Wait for modal animation
// Then capture
mcp__playwright__browser_take_screenshot({
  filename: "virtuna-society-selector-open.png",
  type: "png"
});
```

### Discrepancy Table Template
```markdown
## [Screen Name] Discrepancies

**Reference:** `extraction/screenshots/desktop-fullpage/[category]/[file].png`
**Virtuna:** `.planning/phases/12-comparison/virtuna-screenshots/[category]/[file].png`

| ID | Component | Element | Issue | Type | Severity | Reference | Current | Fix Hint | File Path | Status |
|----|-----------|---------|-------|------|----------|-----------|---------|----------|-----------|--------|
| D-XXX | | | | | | | | | | Open |
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pixel-diff tools (Pixelmatch) | AI semantic analysis (v0) | 2024-2025 | Reduces noise, provides actionable specs |
| Manual screenshot comparison | Playwright MCP capture | 2024 | Consistent, repeatable captures |
| Spreadsheet discrepancy tracking | Markdown with global IDs | This project | Version-controlled, git-friendly |

**Important notes on multimodal AI limitations:**
- InfoQ research (2025) found that Claude and Gemini "fail directly" when asked to spot differences between two similar images
- Best practice is independent analysis of each image, then comparing structured outputs
- v0 is optimized for UI/component analysis, making it better suited than general-purpose vision models

## Open Questions

Things that couldn't be fully resolved:

1. **v0 MCP local file handling**
   - What we know: v0_generate_from_image takes imageUrl parameter
   - What's unclear: Whether file:// URLs work or if images need to be hosted
   - Recommendation: Test with first screenshot. If local files don't work, consider base64 encoding or temporary hosting. Could also use Read tool to view image then describe to v0.

2. **Animation/transition comparison**
   - What we know: Static screenshots can't capture animations
   - What's unclear: How to document timing/easing differences
   - Recommendation: Note animation-related discrepancies as "animation" type with text description of difference. Use video recordings from Phase 11 if available.

3. **Optimal batching for v0 analysis**
   - What we know: v0 can analyze full-page screenshots or focused regions
   - What's unclear: Whether component-focused analysis produces better results
   - Recommendation: Start with full-page analysis. If discrepancies seem incomplete, follow up with focused region analysis.

## Sources

### Primary (HIGH confidence)
- Phase 11 Research (11-RESEARCH.md) - Playwright screenshot patterns, viewport settings
- Phase 10 QA Plans (10-01-PLAN.md through 10-04-PLAN.md) - v0 MCP usage patterns
- Phase 10 Discrepancy Reports (discrepancies/*.md) - Documentation format examples
- 12-CONTEXT.md - User decisions on workflow and categorization

### Secondary (MEDIUM confidence)
- [InfoQ: Spotting Image Differences with AI](https://www.infoq.com/articles/spotting-image-differences-visual-software-testing-ai/) - AI limitations for visual diff
- [v0 Documentation](https://v0.app/docs) - v0 capabilities and image input
- [Playwright Visual Testing](https://playwright.dev/docs/test-snapshots) - Screenshot comparison thresholds

### Tertiary (LOW confidence)
- WebSearch results on visual regression testing best practices
- General multimodal AI capabilities research

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - v0 MCP and Playwright MCP already used successfully in Phases 10-11
- Architecture: HIGH - Follows established patterns from Phase 10 QA
- Pitfalls: HIGH - Based on documented AI limitations and Phase 10 learnings

**Research date:** 2026-01-30
**Valid until:** 2026-02-28 (30-day validity for stable workflow)

---

## Appendix: Reference Screenshot Inventory

### Available Reference Screenshots (desktop-fullpage/)
Total: 14 complete captures at 1440x900 with Version 2.1 visible

| Category | Files | Key Screens |
|----------|-------|-------------|
| Dashboard | 1 | Default state with network viz |
| Selectors | 6 | Society open/hover/menu, View open/role level, Test type |
| Forms | 3 | TikTok empty/filled, Survey empty |
| Modals | 2 | Create society, Leave feedback |
| Results | 2 | Results panel, Results with insights |

### Comparison Workflow Per Screen

1. **Locate reference:** `extraction/screenshots/desktop-fullpage/[category]/[file].png`
2. **Capture Virtuna:** Navigate to same state, capture at 1440x900
3. **Analyze reference with v0:** Extract styling specs
4. **Analyze Virtuna with v0:** Extract styling specs
5. **Compare outputs:** Identify discrepancies
6. **Document:** Create discrepancy table entries with global IDs
7. **Categorize:** Apply type (spacing/color/typography/layout/animation)
8. **Prioritize:** Apply severity (critical/major/minor) per CONTEXT.md criteria

### Estimated Comparisons

| Plan | Focus Area | Screens | Est. Discrepancies |
|------|------------|---------|-------------------|
| 12-01 | Navigation, sidebar, dashboard | 3-4 | Low (already QA'd in Phase 10) |
| 12-02 | Forms, selectors, dropdowns | 6-8 | Medium |
| 12-03 | Modals, settings, overlays | 4-5 | Medium |
| 12-04 | Consolidation | N/A | Aggregate all findings |
